// chat.js
import { initSupabase } from "./database.js";

const chatBox = document.getElementById("chatBox");
const inputNome = document.getElementById("nome");
const inputMensagem = document.getElementById("mensagem");
const enviarBtn = document.getElementById("enviar");
const supabase =  await initSupabase();;
// Mostrar mensagem no chat
function addMensagem(msg) {
  const div = document.createElement("div");
  div.textContent = `${msg.nome}: ${msg.conteudo}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Carregar mensagens antigas
export async function carregarMensagens() {
  let { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) console.error(error);
  else {
    chatBox.innerHTML = "";
    data.forEach(addMensagem);
  }
}

// Escutar mensagens em tempo real
export function listenMensagens() {
  supabase.channel("chat-room")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        addMensagem(payload.new);
      }
    )
    .subscribe();
}

// Enviar mensagem
export async function enviarMensagem() {
  const nome = inputNome.value || "Anônimo";
  const conteudo = inputMensagem.value;

  if (conteudo.trim() === "") return;

  const { error } = await supabase.from("messages").insert([
    { nome, conteudo }
  ]);

  if (error) console.error(error);
  inputMensagem.value = "";
}

// Eventos de clique
if (enviarBtn) {
  enviarBtn.onclick = enviarMensagem;
}
