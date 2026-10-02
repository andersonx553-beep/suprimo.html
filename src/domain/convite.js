// Mensagem de solicitação de proposta a partir do modelo dos Ajustes. Variáveis entre chaves: {fornecedor}.
import { numeroBr, dataBr } from "../lib/formato.js";

export const MODELO_PADRAO = `Olá, {fornecedor}! Tudo bem?

Aqui é {solicitante}, da {empresa}. Estamos cotando os itens abaixo e gostaríamos de receber a sua proposta:

{itens}

Local de entrega: {entrega}
Prazo para envio da proposta: {prazo}

Por gentileza, informe preço unitário, frete, prazo de entrega, condição de pagamento e validade da proposta.

Referência: {codigo}
Obrigado(a)!`;

export const VARIAVEIS = ["fornecedor", "solicitante", "empresa", "itens", "entrega", "prazo", "codigo"];

export const textoDosItens = (cot) => cot.itens
  .map((i) => `- ${numeroBr(i.quantidade)} ${i.unidade} ${i.descricao}${i.especificacao ? ` (${i.especificacao})` : ""}`).join("\n");

/** @param {string} modelo */
export function montarMensagem(modelo, { cotacao, fornecedor, ajustes }) {
  const valores = {
    fornecedor: fornecedor?.nome ?? "{fornecedor}",
    solicitante: cotacao.solicitante || ajustes.solicitante || "a equipe de compras",
    empresa: ajustes.empresa?.nome || "nossa empresa",
    itens: textoDosItens(cotacao) || "(itens a definir)",
    entrega: cotacao.destino || ajustes.destinoPadrao || "a combinar",
    prazo: cotacao.prazoPropostas ? dataBr(cotacao.prazoPropostas) : "o quanto antes",
    codigo: cotacao.numero,
  };
  return modelo.replace(/\{(\w+)\}/g, (inteiro, k) => (k in valores ? valores[k] : inteiro));
}

export function linkWhatsapp(telefone, texto) {
  let d = String(telefone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export const linkEmail = (email, assunto, texto) =>
  email ? `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}` : null;

export const linkMaps = (consulta) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
