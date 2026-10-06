// Decisão: total da compra, quando a justificativa é obrigatória e o que falta para registrar.
import { calcularDivisao } from "./mapa.js";

/**
 * @param {ReturnType<import('./mapa.js').compararCotacao>} res
 * @param {import('./tipos.js').Decisao|null} decisao
 */
export function resumirDecisao(res, decisao) {
  if (!decisao) return { completo: false, custoTotal: 0, fornecedores: [], divisao: null, coluna: null };
  if (decisao.modo === "porItem") {
    const divisao = calcularDivisao(res, decisao.porItem);
    const completo = divisao.faltaEscolher === 0 && divisao.escolhas.length > 0 && !divisao.fretePendente;
    return { completo, custoTotal: divisao.custoTotal, fornecedores: divisao.fretes.map((f) => f.fornecedorId), divisao, coluna: null };
  }
  const coluna = res.colunas.find((c) => c.propostaId === decisao.propostaId) ?? null;
  // Compra de um fornecedor só: ele precisa ter cotado tudo na unidade pedida.
  const completo = !!coluna && !coluna.incompleta && !coluna.unidadeDiferente && !coluna.fretePendente;
  return { completo, custoTotal: coluna?.custoTotal ?? 0, fornecedores: coluna ? [coluna.fornecedorId] : [], divisao: null, coluna };
}

/** A justificativa é obrigatória quando a escolha não é o menor custo total entre as propostas completas. */
export function justificativaObrigatoria(res, decisao) {
  const resumo = resumirDecisao(res, decisao);
  if (!resumo.completo) return false;
  const sugerida = res.colunas.find((c) => c.sugerida);
  if (!sugerida) return true;
  return resumo.custoTotal > sugerida.custoTotal || (decisao.modo === "unico" && decisao.propostaId !== sugerida.propostaId && resumo.custoTotal !== sugerida.custoTotal);
}

/** @returns {string[]} problemas que impedem registrar a decisão (vazio = pode registrar) */
export function problemasDaDecisao(res, decisao) {
  const problemas = [];
  const resumo = resumirDecisao(res, decisao);
  if (resumo.coluna?.fretePendente || resumo.divisao?.fretePendente) {
    problemas.push("Confirme o valor do frete de cada fornecedor escolhido; se estiver incluso, informe R$ 0,00.");
  }
  if (!resumo.completo) {
    if (!problemas.length) problemas.push(decisao?.modo === "porItem" ? "Escolha o fornecedor de todos os itens." : "Escolha um fornecedor que tenha cotado todos os itens.");
  }
  if (justificativaObrigatoria(res, decisao) && !String(decisao?.justificativa ?? "").trim()) {
    problemas.push("Escreva a justificativa: a escolha não é o menor custo total.");
  }
  return problemas;
}
