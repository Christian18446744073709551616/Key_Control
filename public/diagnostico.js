import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIGURE AQUI (ou importe do seu database.js) ----------
const supabase = createClient(
  'https://dmaqzgkqevphgitmvvlg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYXF6Z2txZXZwaGdpdG12dmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NDE5ODIsImV4cCI6MjA3MjQxNzk4Mn0.xVX4iPIVjn-uB2efG8XJy_0pPBR9TXPclkkwIlEPm5A'
);

// ---------- Helpers ----------
function ymdLocal(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Dado "YYYY-MM-DD" (dia local), retorna {startISO,endISO} em UTC
function getUTCRangeForLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  // cria Date no fuso local (meio-noite local)
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { startISO: startLocal.toISOString(), endISO: endLocal.toISOString() };
}

// Converte timestamp (string) para YYYY-MM-DD no fuso de São Paulo (para agrupar)
function toLocalYMD(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
}

// ---------- DOM ----------
const filtroDia = document.getElementById("filtroDia");
const btnDia = document.getElementById("buscarDia");
const tabelaDia = document.querySelector("#tabelaDia tbody");

const filtroPessoa = document.getElementById("filtroPessoa");
const btnPessoa = document.getElementById("buscarPessoa");
const tabelaPessoa = document.querySelector("#tabelaPessoa tbody");

const chaveMaisUsadaEl = document.getElementById("chaveMaisUsada");
const diaMaisMovimentadoEl = document.getElementById("diaMaisMovimentado");
const usoPorChaveEl = document.getElementById("usoPorChave");

// define input com hoje (local) ao carregar
document.addEventListener("DOMContentLoaded", () => {
  if (filtroDia && !filtroDia.value) {
    filtroDia.value = ymdLocal(new Date());
  }
});

// ---------- Preencher tabela genérica ----------
function preencherTabela(tabela, dados) {
  tabela.innerHTML = "";
  dados.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(r.retirada_hora).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
      <td>${r.pegou ?? "-"}</td>
      <td>${r.chave ?? "-"}</td>
      <td>${new Date(r.retirada_hora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
      <td>${r.entregue_hora ? new Date(r.entregue_hora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-"}</td>
    `;
    tabela.appendChild(tr);
  });
}

// ---------- Estatísticas de janela (últimos N dias) ----------
async function calcularEstatisticasJanela(daysWindow = 30) {
  // Janela local: do início do dia (daysWindow-1) até hoje (local)
  const hoje = new Date();
  const endLocal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
  const startLocal = new Date(endLocal);
  startLocal.setDate(endLocal.getDate() - (daysWindow - 1));

  const startISO = startLocal.toISOString();
  const endISO = endLocal.toISOString();

  const { data: rows, error } = await supabase
    .from("Controle_chave")
    .select("retirada_hora, chave")
    .gte("retirada_hora", startISO)
    .lte("retirada_hora", endISO);

  if (error) {
    console.error("Erro ao calcular estatísticas da janela:", error);
    return { diaMaisMovimentado: null, chaveMaisUsadaEmUmDia: null };
  }

  if (!rows || rows.length === 0) {
    return { diaMaisMovimentado: null, chaveMaisUsadaEmUmDia: null };
  }

  // 1) Dia com mais movimentações
  const countByDay = {};
  // 2) Chave usada por dia -> { chave: { 'YYYY-MM-DD': count } }
  const chaveDiaCounts = {};

  rows.forEach(r => {
    const ymd = toLocalYMD(r.retirada_hora);
    countByDay[ymd] = (countByDay[ymd] || 0) + 1;

    const chave = r.chave ?? "—";
    chaveDiaCounts[chave] = chaveDiaCounts[chave] || {};
    chaveDiaCounts[chave][ymd] = (chaveDiaCounts[chave][ymd] || 0) + 1;
  });

  // dia com mais movimentações
  const diaEntries = Object.entries(countByDay);
  const diaMaisMov = diaEntries.sort((a, b) => b[1] - a[1])[0]; // [ymd, count]
  const diaMaisMovimentado = diaMaisMov ? { date: diaMaisMov[0], count: diaMaisMov[1] } : null;

  // chave mais usada em um único dia (max count across chaveDiaCounts)
  let chaveMaisUsadaEmUmDia = null; // {chave, date, count}
  for (const [chave, days] of Object.entries(chaveDiaCounts)) {
    for (const [day, count] of Object.entries(days)) {
      if (!chaveMaisUsadaEmUmDia || count > chaveMaisUsadaEmUmDia.count) {
        chaveMaisUsadaEmUmDia = { chave, date: day, count };
      }
    }
  }

  return { diaMaisMovimentado, chaveMaisUsadaEmUmDia };
}

// ---------- Handler: Buscar por dia ----------
btnDia.addEventListener("click", async () => {
  const selecionado = filtroDia.value;
  if (!selecionado) return;

  // converte dia local (YYYY-MM-DD) para intervalo UTC correspondente ao dia em SP
  const { startISO, endISO } = getUTCRangeForLocalDate(selecionado);

  const { data, error } = await supabase
    .from("Controle_chave")
    .select("*")
    .gte("retirada_hora", startISO)
    .lte("retirada_hora", endISO);

  if (error) {
    console.error("Erro filtro dia:", error);
    return;
  }

  // preencher tabela do dia
  preencherTabela(tabelaDia, data || []);

  // popular seletor de pessoas com campo correto 'pegou'
  const nomes = [...new Set((data || []).map(r => r.pegou || "").filter(Boolean))];
  filtroPessoa.innerHTML = `<option value="">-- Selecione uma pessoa --</option>`;
  nomes.forEach(nome => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    filtroPessoa.appendChild(opt);
  });

  // Atualizar estatísticas baseadas no dia selecionado
  if (!data || data.length === 0) {
    chaveMaisUsadaEl.textContent = "Chave mais usada: -";
  } else {
    // chave mais usada no dia
    const counts = {};
    data.forEach(r => counts[r.chave ?? "—"] = (counts[r.chave ?? "—"] || 0) + 1);
    const [chave, qtd] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    chaveMaisUsadaEl.textContent = `Chave mais usada: ${chave} (${qtd}x)`;
  }

  // calcula estatísticas em janela (ex.: 30 dias) e atualiza os outros dois campos
  const { diaMaisMovimentado, chaveMaisUsadaEmUmDia } = await calcularEstatisticasJanela(30);

  if (diaMaisMovimentado) {
    const localDate = new Date(`${diaMaisMovimentado.date}T12:00:00`).toLocaleDateString("pt-BR");
    diaMaisMovimentadoEl.textContent = `Dia com mais movimentações: ${localDate} (${diaMaisMovimentado.count} registros)`;
  } else {
    diaMaisMovimentadoEl.textContent = "Dia com mais movimentações: -";
  }

  if (chaveMaisUsadaEmUmDia) {
    const localDate = new Date(`${chaveMaisUsadaEmUmDia.date}T12:00:00`).toLocaleDateString("pt-BR");
    usoPorChaveEl.textContent = `Chave mais usada em um único dia: ${chaveMaisUsadaEmUmDia.chave} — ${chaveMaisUsadaEmUmDia.count}x em ${localDate}`;
  } else {
    usoPorChaveEl.textContent = "Chave mais usada em um único dia: -";
  }

  // limpa resultado pessoa anterior
  tabelaPessoa.innerHTML = "";
});

// ---------- Handler: Buscar por pessoa (chave mais usada + tempo médio) ----------
btnPessoa.addEventListener("click", async () => {
  const selecionado = filtroDia.value;
  const pessoa = filtroPessoa.value;
  if (!selecionado || !pessoa) return;

  const { startISO, endISO } = getUTCRangeForLocalDate(selecionado);

  const { data, error } = await supabase
    .from("Controle_chave")
    .select("*")
    .eq("pegou", pessoa)
    .gte("retirada_hora", startISO)
    .lte("retirada_hora", endISO);

  if (error) {
    console.error("Erro filtro pessoa:", error);
    return;
  }

  if (!data || data.length === 0) {
    tabelaPessoa.innerHTML = "<tr><td colspan='5'>Nenhum registro</td></tr>";
    return;
  }

  // contagem por chave e tempos (horas)
  const contagemChaves = {};
  const temposChaves = {};

  data.forEach(r => {
    const chave = r.chave ?? "—";
    contagemChaves[chave] = (contagemChaves[chave] || 0) + 1;

    if (r.devolvido && r.entregue_hora) {
      const retirada = new Date(r.retirada_hora);
      const entrega = new Date(r.entregue_hora);
      const diffHoras = (entrega - retirada) / (1000 * 60 * 60);
      if (!temposChaves[chave]) temposChaves[chave] = [];
      temposChaves[chave].push(diffHoras);
    }
  });



  const entries = Object.entries(contagemChaves);
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [chaveMaisUsada, qtd] = sorted[0];

  let tempoMedio = "-";
  if (temposChaves[chaveMaisUsada] && temposChaves[chaveMaisUsada].length > 0) {
    const arr = temposChaves[chaveMaisUsada];
    const media = arr.reduce((s, v) => s + v, 0) / arr.length;
    tempoMedio = media.toFixed(2) + "h";
  } else {
    tempoMedio = "Sem registro de devolução";
  }

  tabelaPessoa.innerHTML = `
    <tr>
      <td>${new Date(`${selecionado}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
      <td>${pessoa}</td>
      <td>${chaveMaisUsada}</td>
      <td>${qtd}x</td>
      <td>${tempoMedio}</td>
    </tr>
  `;
});
