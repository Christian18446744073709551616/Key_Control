// app.js
import { initSupabase, getChaves, addChave, devolverChave, listenChaves } from "./database.js";

const tabela = document.getElementById("tabelaChaves");
const form = document.getElementById("formChave");
const inputNome = document.getElementById("pegou");
const seletor = document.getElementById("seletorNomes");

// Função auxiliar: retorna a data atual em São Paulo no formato YYYY-MM-DD
function getHojeSP() {
  const agora = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(agora); // exemplo: 2025-09-08
}





// Renderizar tabela apenas com registros de hoje
async function render() {
  const hojeSP = getHojeSP();
  const data = await getChaves();

  tabela.innerHTML = "";
  data
    .filter(r => {
      // Converte retirada_hora para data local SP
      const retirada = new Date(r.retirada_hora);
      const retiradaSP = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(retirada);
      return retiradaSP === hojeSP;
    })
    .forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.pegou}</td>
        <td>${r.chave}</td>
        <td>${new Date(r.retirada_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
        <td>${r.devolvido ? "Sim" : "Não"}</td>
        <td>${r.entregue_hora ? new Date(r.entregue_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-"}</td>
        <td>
          ${!r.devolvido 
            ? `<button class="btn devolver" data-id="${r.id}">Devolver</button>` 
            : ""}
        </td>
      `;
      tabela.appendChild(tr);
    });

  // Adiciona evento nos botões devolver
  document.querySelectorAll(".devolver").forEach(btn => {
    btn.addEventListener("click", async () => {
      await devolverChave(btn.dataset.id);
    });
  });
   // 🔹 Auto scroll para o final
  if (tabela.lastElementChild) {
    tabela.lastElementChild.scrollIntoView({ behavior: "smooth" });
  }
}

// Carregar nomes do localStorage
function carregarNomes() {
  const nomes = JSON.parse(localStorage.getItem("nomes")) || [];
  seletor.innerHTML = `<option value="">-- Escolha um nome --</option>`;
  nomes.forEach(nome => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    seletor.appendChild(opt);
  });
  seletor.addEventListener("change", () => {
    if (seletor.value !== "") {
      inputNome.value = seletor.value;
    }
  });
}

// Formulário para pegar chave
form.addEventListener("submit", async e => {
  e.preventDefault();
  const typekey = document.getElementById("typekey").value; 
  const nome = inputNome.value.trim();

  if (nome === "" || typekey === "") return;

  // Salvar nome no localStorage
  let nomes = JSON.parse(localStorage.getItem("nomes")) || [];
  if (!nomes.includes(nome)) {
    nomes.push(nome);
    localStorage.setItem("nomes", JSON.stringify(nomes));
    carregarNomes();
  }

  // Adicionar chave no banco
  await addChave(nome, typekey);

  inputNome.value = "";
  document.getElementById("typekey").value = "";
  document.getElementById("seletorNomes").value = "";
});




// ===== Reset automático à meia-noite de SP =====
function agendarReset() {
  const agora = new Date();
  const tzOffsetSP = -3 * 60; // UTC-3 para São Paulo (ajusta conforme horário de verão se precisar)
  const spAgora = new Date(agora.getTime() + (tzOffsetSP - agora.getTimezoneOffset()) * 60000);

  const proximaMeiaNoite = new Date(spAgora);
  proximaMeiaNoite.setHours(24, 0, 0, 0);

  const msAteMeiaNoite = proximaMeiaNoite - spAgora;
  setTimeout(() => {
    render(); // limpa e mostra só o novo dia
    agendarReset(); // agenda de novo
  }, msAteMeiaNoite);
}


async function main() {
  await initSupabase();   // 🔹 garante que o Supabase foi inicializado
  carregarNomes();        // só roda depois do initSupabase
  listenChaves(render);   // idem
  render();               // idem
  agendarReset();         // idem
}

main();