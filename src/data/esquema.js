// Esquema versionado. Mudou o formato dos dados? Aumente VERSAO_ATUAL e escreva a migração (n → n+1).
// As migrações valem para o que está no IndexedDB e para backups antigos importados.
import { MODELO_PADRAO } from "../domain/convite.js";

export const VERSAO_ATUAL = 1;

export const AJUSTES_PADRAO = Object.freeze({
  empresa: { nome: "", cnpj: "" },
  solicitante: "",
  destinoPadrao: "",
  modeloMensagem: MODELO_PADRAO,
  minPropostas: 3,
  prazoRespostaDias: 3,
  contadorCotacao: 0,
});

/** Cada chave é a versão de origem; a função devolve os dados na versão seguinte. */
export const MIGRACOES = {
  // 1: (dados) => ({ ...dados, cotacoes: dados.cotacoes.map(...) }),  ← modelo para a próxima mudança
};

/**
 * Leva `dados` da versão em que estão até `alvo`.
 * @param {{versaoEsquema?:number}} dados
 * @returns {object} dados migrados, com `versaoEsquema` atualizada
 */
export function migrar(dados, migracoes = MIGRACOES, alvo = VERSAO_ATUAL) {
  let versao = Number.isInteger(dados.versaoEsquema) ? dados.versaoEsquema : 1;
  if (versao > alvo) throw new Error(`Estes dados são de uma versão mais nova do Suprimo (esquema ${versao}). Atualize o Suprimo e tente de novo.`);
  let atual = dados;
  while (versao < alvo) {
    const passo = migracoes[versao];
    if (!passo) throw new Error(`Não há migração do esquema ${versao} para ${versao + 1}.`);
    atual = passo(atual);
    versao += 1;
    atual = { ...atual, versaoEsquema: versao };
  }
  return { ...atual, versaoEsquema: versao };
}

const ehLista = Array.isArray;
const ehTexto = (v) => typeof v === "string";

/** @returns {string[]} problemas encontrados (vazio = estrutura válida) */
export function validarEstrutura(d) {
  const erros = [];
  if (!d || typeof d !== "object") return ["O arquivo está vazio ou não é um backup."];
  if (d.sistema !== "suprimo") erros.push("Este arquivo não é um backup do Suprimo.");
  if (!ehLista(d.cotacoes)) erros.push("Faltam as cotações no arquivo.");
  if (!ehLista(d.fornecedores)) erros.push("Faltam os fornecedores no arquivo.");
  if (erros.length) return erros;
  d.cotacoes.forEach((c, i) => {
    const onde = `Cotação ${c?.numero ?? i + 1}`;
    if (!c || !ehTexto(c.id) || !ehTexto(c.numero)) return erros.push(`${onde}: sem identificação.`);
    if (!ehLista(c.itens) || !ehLista(c.convites) || !ehLista(c.propostas)) erros.push(`${onde}: itens, convites ou propostas ausentes.`);
    for (const p of c.propostas ?? []) {
      for (const [itemId, e] of Object.entries(p.precos ?? {})) {
        if (!Number.isInteger(e?.centavos)) erros.push(`${onde}: preço inválido no item ${itemId} (precisa estar em centavos inteiros).`);
      }
    }
  });
  d.fornecedores.forEach((f, i) => { if (!f || !ehTexto(f.id) || !ehTexto(f.nome)) erros.push(`Fornecedor ${i + 1}: sem identificação ou nome.`); });
  return erros.slice(0, 5);
}

/**
 * Lê o texto de um backup: valida, migra e devolve os dados prontos. Lança Error com mensagem em português.
 * @param {string} texto
 */
export function lerBackup(texto, migracoes = MIGRACOES, alvo = VERSAO_ATUAL) {
  let bruto;
  try { bruto = JSON.parse(texto); } catch { throw new Error("O arquivo não é um JSON válido. Escolha um backup exportado pelo Suprimo."); }
  const erros = validarEstrutura(bruto);
  if (erros.length) throw new Error(erros.join(" "));
  const dados = migrar(bruto, migracoes, alvo);
  return { ...dados, ajustes: { ...AJUSTES_PADRAO, ...(dados.ajustes ?? {}) } };
}

/** Monta o objeto de backup a partir do estado atual. */
export function montarBackup({ cotacoes, fornecedores, ajustes }, agora = new Date().toISOString()) {
  return { sistema: "suprimo", versaoEsquema: VERSAO_ATUAL, exportadoEm: agora, ajustes, fornecedores, cotacoes };
}
