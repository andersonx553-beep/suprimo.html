// Mensagem de convite (WhatsApp e e-mail) montada a partir do modelo dos Ajustes.
import { num, dataBr } from "./formato.js";

export function listaDeItens(cotacao) {
  return cotacao.itens.map((i) => `- ${num(i.qtd)} ${i.un} ${i.descricao}${i.spec ? " (" + i.spec + ")" : ""}`).join("\n");
}

export function montarMensagem(modelo, { cotacao, fornecedor, ajustes }) {
  const valores = {
    fornecedor: fornecedor.nome,
    solicitante: cotacao.solicitante || ajustes.solicitante || "o almoxarifado",
    empresa: ajustes.empresa?.nome || "",
    numero: cotacao.numero,
    itens: listaDeItens(cotacao),
    prazo: dataBr(cotacao.prazoPropostas),
  };
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, k) => valores[k] ?? "").replace(/ +\n/g, "\n");
}

export function linkWhatsapp(telefone, texto) {
  let d = String(telefone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export function linkEmail(email, assunto, texto) {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
}
