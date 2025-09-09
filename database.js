
import { createClient } from "https://esm.sh/@supabase/supabase-js";



// const supabase = createClient(
//  'https://dmaqzgkqevphgitmvvlg.supabase.co',
// 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYXF6Z2txZXZwaGdpdG12dmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NDE5ODIsImV4cCI6MjA3MjQxNzk4Mn0.xVX4iPIVjn-uB2efG8XJy_0pPBR9TXPclkkwIlEPm5A'
// );

const supabase = createClient(
 SUPABASE_URL,
 SUPABASE_KEY
);

// Buscar todas as chaves
export async function getChaves() {
    const { data, error } = await supabase
      .from("Controle_chave")
      .select("*")
      .order("id", { ascending: true });
    if (error) console.error(error);
    return data || [];

  }


  
  // Inserir nova retirada
  export async function addChave(nome,typekey) {


    if (!typekey || typekey.trim() === "" ) {
        console.log("Chave vazia, não será inserida");
        return;
      }
       
    const { error } = await supabase
      .from("Controle_chave")
      .insert([{pegou: nome , chave: typekey , devolvido: 'False' }]);
    if (error) console.error(error);



   
  }
  
  // Devolver chave
  export async function devolverChave(id) {
    const { error } = await supabase
      .from("Controle_chave")
      .update({ devolvido: true, entregue_hora: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error(error);
  }






  // gera diagnostico
  async function gerarDiagnosticoEPublicar() {
  const { data: registros, error } = await supabase
    .from("Controle_chave")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  const diagnostico = {};

  registros.forEach(r => {
    const nome = r.pegou;
    if (!diagnostico[nome]) {
      diagnostico[nome] = {
        dias: {},
        chaves: {}
      };
    }

    const dia = new Date(r.retirada_hora).toISOString().split("T")[0];

    // Contagem de chaves
    diagnostico[nome].chaves[r.chave] =
      (diagnostico[nome].chaves[r.chave] || 0) + 1;

    // Contagem de retiradas por dia + tempo
    if (!diagnostico[nome].dias[dia]) {
      diagnostico[nome].dias[dia] = { retiradas: 0, totalHoras: 0 };
    }
    diagnostico[nome].dias[dia].retiradas++;

    if (r.devolvido && r.entregue_hora) {
      const retirada = new Date(r.retirada_hora);
      const entrega = new Date(r.entregue_hora);
      const diffHoras = (entrega - retirada) / (1000 * 60 * 60);
      diagnostico[nome].dias[dia].totalHoras += diffHoras;
    }
  });

  // Montar resultados finais
  const resultados = [];
  for (const nome in diagnostico) {
    const diasOrdenados = Object.entries(diagnostico[nome].dias)
      .sort((a, b) => b[1].retiradas - a[1].retiradas);

    const diaMaisRetiradas =
      diasOrdenados.length > 0 ? diasOrdenados[0][0] : null;
    const tempoTotalHoras =
      diaMaisRetiradas ? diasOrdenados[0][1].totalHoras : 0;

    const chaveMaisRetirada = Object.entries(diagnostico[nome].chaves)
      .sort((a, b) => b[1] - a[1])[0][0];

    resultados.push({
      pessoa: nome,
      dia_mais_retiradas: diaMaisRetiradas,
      tempo_total_horas: tempoTotalHoras,
      chave_mais_retirada: chaveMaisRetirada
    });
  }

  // Apagar diagnósticos antigos para não acumular
  await supabase.from("diagnostico_chaves").delete().neq("id", 0);

  // Inserir novos
  const { error: insertError } = await supabase
    .from("diagnostico_chaves")
    .insert(resultados);

  if (insertError) {
    console.error("Erro ao salvar diagnóstico:", insertError);
  } else {
    console.log("Diagnóstico atualizado!");
  }
}

  // Realtime listener
  export function listenChaves(callback) {
    supabase
      .channel("chaves-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "Controle_chave" }, () => {
        callback();
       gerarDiagnosticoEPublicar(); // gera e salva diagnóstico
      })
      .subscribe();
  }


 

