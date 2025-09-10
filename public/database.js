import { createClient } from "https://esm.sh/@supabase/supabase-js";

let supabase; // variavel global
// Função para garantir que o supabase foi inicializado

function getSupabase() {
  if (!supabase) throw new Error("Supabase ainda não inicializado. Chame initSupabase() antes.");
  return supabase;
}


export async function initSupabase() {
  const res = await fetch("/config");
  if (!res.ok) throw new Error("Não foi possível carregar a configuração do Supabase");
  const config = await res.json();

  supabase = createClient(config.supabaseUrl, config.supabaseKey);
  return supabase;
}



export async function getChaves() {
  const client = getSupabase();
  const { data, error } = await client
    .from("Controle_chave")
    .select("*")
    .order("id", { ascending: true });
  if (error) console.error(error);
  return data || [];
}

// Mesma lógica para as outras funções
export async function addChave(nome, typekey) {
  const client = getSupabase();
  if (!typekey || typekey.trim() === "") return;
  const { error } = await client
    .from("Controle_chave")
    .insert([{ pegou: nome, chave: typekey, devolvido: false }]);
  if (error) console.error(error);
}

export async function devolverChave(id) {
  const client = getSupabase();
  const { error } = await client
    .from("Controle_chave")
    .update({ devolvido: true, entregue_hora: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(error);
}

export function listenChaves(callback) {
  const client = getSupabase();
  client
    .channel("chaves-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "Controle_chave" },
      () => {
        callback();
        gerarDiagnosticoEPublicar();
      }
    )
    .subscribe();

    
}
