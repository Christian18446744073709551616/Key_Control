// server.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Para ES Modules: pegar caminho da pasta atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis do arquivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para aceitar JSON
app.use(express.json());

// 🔹 Servir arquivos estáticos (index.html, app.js, database.js, style.css)
app.use(express.static(path.join(__dirname, "public")));

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔹 Rota de teste (opcional)
app.get("/teste", async (req, res) => {
  const { data, error } = await supabase.from("Controle_chave").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/index", (req, res) => {
  // Envia o arquivo HTML da página de histórico
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Rota para a página de histórico
app.get("/historico", (req, res) => {
  // Envia o arquivo HTML da página de histórico
  res.sendFile(path.join(__dirname, "public", "historico.html"));
});

// 🔹 Rota `/config` para o frontend buscar as chaves anon
app.get("/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY // só a anon key
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
