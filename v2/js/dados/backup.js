// Backup em JSON. Não leva chaves de API nem os arquivos anexados (PDF e imagens ficam só neste navegador).
import { armazenamento as arm } from "./armazenamento.js";

export function exportarBackup() {
  const { chaves, ...ajustes } = arm.ler("ajustes", {});
  return JSON.stringify({
    sistema: "suprimo", versao: "2.2", geradoEm: new Date().toISOString(),
    ajustes, cotacoes: arm.ler("cotacoes", []), fornecedores: arm.ler("fornecedores", []), precos: arm.ler("precos", []),
  }, null, 2);
}

export function importarBackup(texto) {
  let d;
  try { d = JSON.parse(texto); } catch { throw new Error("O arquivo não é um JSON válido."); }
  if (d?.sistema !== "suprimo" || !Array.isArray(d.cotacoes) || !Array.isArray(d.fornecedores)) throw new Error("Este arquivo não é um backup do Suprimo.");
  arm.gravar("cotacoes", d.cotacoes);
  arm.gravar("fornecedores", d.fornecedores);
  arm.gravar("precos", Array.isArray(d.precos) ? d.precos : []);
  if (d.ajustes && typeof d.ajustes === "object") { const { chaves, ...a } = d.ajustes; arm.gravar("ajustes", a); }
  arm.gravar("iniciado", true);
}

export function apagarExemplos() {
  arm.gravar("cotacoes", arm.ler("cotacoes", []).filter((c) => !c.exemplo));
  arm.gravar("fornecedores", arm.ler("fornecedores", []).filter((f) => !f.exemplo));
  arm.gravar("precos", arm.ler("precos", []).filter((p) => !p.exemplo));
}
