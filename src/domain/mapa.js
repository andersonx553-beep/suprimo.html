// Regras do mapa comparativo. Funções puras: recebem a cotação e devolvem o resultado; a tela só mostra.
import { normalizarUnidade } from "./unidades.js";
import { totalLinha } from "./dinheiro.js";

export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Chave que liga o item ao histórico de preços pagos. */
export const chaveItem = (descricao) => semAcento(descricao).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * @typedef {Object} Celula
 * @property {string} itemId
 * @property {'ok'|'naoCotou'|'unidadeDivergente'} estado
 * @property {number} [centavos]      preço unitário
 * @property {number} [total]         preço × quantidade
 * @property {string} [unidade]       unidade cotada, quando diverge
 * @property {boolean} [menor]        menor preço da linha
 * @property {{ultimo:number, fracao:number}} [altaSobreUltimo]
 *
 * @typedef {Object} Coluna
 * @property {string} propostaId @property {string} fornecedorId
 * @property {Celula[]} celulas
 * @property {number} subtotal @property {number} freteCentavos @property {number} custoTotal
 * @property {number|null} prazoEntregaDias @property {string} pagamento @property {string} validade
 * @property {boolean} incompleta @property {boolean} unidadeDiferente @property {boolean} vencida
 * @property {boolean} elegivel @property {boolean} sugerida
 */

/**
 * @param {import('./tipos.js').Cotacao} cotacao
 * @param {{hoje:string, minPropostas?:number, ultimoPreco?:Map<string,{centavos:number}>, limiteAlta?:number}} opcoes
 */
export function compararCotacao(cotacao, { hoje, minPropostas = 3, ultimoPreco = new Map(), limiteAlta = 0.15 }) {
  const itens = cotacao.itens ?? [];
  const propostas = cotacao.propostas ?? [];

  /** @type {Coluna[]} */
  const colunas = propostas.map((p) => {
    const celulas = itens.map((item) => celulaDe(p, item, ultimoPreco, limiteAlta));
    const subtotal = celulas.reduce((s, c) => s + (c.estado === "ok" ? c.total : 0), 0);
    const naoCotou = celulas.filter((c) => c.estado === "naoCotou").length;
    const divergentes = celulas.filter((c) => c.estado === "unidadeDivergente").length;
    const frete = p.freteCentavos || 0;
    return {
      propostaId: p.id,
      fornecedorId: p.fornecedorId,
      celulas,
      subtotal,
      freteCentavos: frete,
      custoTotal: subtotal + frete,
      prazoEntregaDias: p.prazoEntregaDias ?? null,
      pagamento: [p.pagamento?.texto, p.pagamento?.dias != null ? `${p.pagamento.dias} dias` : ""].filter(Boolean).join(" · "),
      validade: p.validade || "",
      incompleta: naoCotou > 0,
      unidadeDiferente: divergentes > 0,
      vencida: !!p.validade && p.validade < hoje,
      elegivel: itens.length > 0 && naoCotou === 0 && divergentes === 0,
      sugerida: false,
    };
  });

  // Menor preço de cada linha entre as células comparáveis (só vale com pelo menos duas).
  const linhas = itens.map((item, i) => {
    const comparaveis = colunas.map((c) => c.celulas[i]).filter((c) => c.estado === "ok");
    const menorPreco = comparaveis.length >= 2 ? Math.min(...comparaveis.map((c) => c.centavos)) : null;
    if (menorPreco != null) comparaveis.forEach((c) => { c.menor = c.centavos === menorPreco; });
    return { item, menorPreco };
  });

  // Sugestão: menor custo total entre as completas; empate vai para o menor prazo de entrega.
  const candidatas = colunas.filter((c) => c.elegivel)
    .sort((a, b) => a.custoTotal - b.custoTotal || (a.prazoEntregaDias ?? Infinity) - (b.prazoEntregaDias ?? Infinity));
  const sugestaoId = candidatas[0]?.propostaId ?? null;
  colunas.forEach((c) => { c.sugerida = c.propostaId === sugestaoId; });

  return { linhas, colunas, sugestaoId, minPropostas, poucasPropostas: propostas.length < minPropostas };
}

function celulaDe(proposta, item, ultimoPreco, limiteAlta) {
  const e = proposta.precos?.[item.id];
  if (!e || !Number.isInteger(e.centavos)) return { itemId: item.id, estado: "naoCotou" };
  const unidade = e.unidade || item.unidade;
  if (normalizarUnidade(unidade) !== normalizarUnidade(item.unidade)) {
    return { itemId: item.id, estado: "unidadeDivergente", centavos: e.centavos, unidade };
  }
  const celula = { itemId: item.id, estado: "ok", centavos: e.centavos, total: totalLinha(e.centavos, item.quantidade) };
  const ultimo = ultimoPreco.get(chaveItem(item.descricao))?.centavos;
  if (ultimo > 0 && e.centavos > ultimo * (1 + limiteAlta)) celula.altaSobreUltimo = { ultimo, fracao: e.centavos / ultimo - 1 };
  return celula;
}

/**
 * Compra dividida: um fornecedor por item. O frete de cada fornecedor envolvido entra uma vez.
 * Uma proposta incompleta pode ganhar os itens que cotou.
 * @param {ReturnType<typeof compararCotacao>} resultado
 * @param {Object<string,string>} porItem id do item → id da proposta
 */
export function calcularDivisao(resultado, porItem) {
  const escolhas = [];
  const fretes = new Map();
  let totalItens = 0;
  let faltaEscolher = 0;
  resultado.linhas.forEach(({ item }, i) => {
    const col = resultado.colunas.find((c) => c.propostaId === porItem?.[item.id]);
    const cel = col?.celulas[i];
    if (!cel || cel.estado !== "ok") { faltaEscolher++; return; }
    totalItens += cel.total;
    escolhas.push({ item, propostaId: col.propostaId, fornecedorId: col.fornecedorId, centavos: cel.centavos, total: cel.total });
    fretes.set(col.propostaId, { propostaId: col.propostaId, fornecedorId: col.fornecedorId, freteCentavos: col.freteCentavos });
  });
  const listaFretes = [...fretes.values()];
  const totalFrete = listaFretes.reduce((s, f) => s + f.freteCentavos, 0);
  return { escolhas, fretes: listaFretes, totalItens, totalFrete, custoTotal: totalItens + totalFrete, faltaEscolher };
}

/** Ponto de partida da compra dividida: o menor preço comparável de cada item. */
export function melhorPorItem(resultado) {
  const porItem = {};
  resultado.linhas.forEach(({ item }, i) => {
    let melhor = null;
    for (const c of resultado.colunas) {
      const cel = c.celulas[i];
      if (cel.estado === "ok" && (!melhor || cel.centavos < melhor.centavos)) melhor = { centavos: cel.centavos, propostaId: c.propostaId };
    }
    if (melhor) porItem[item.id] = melhor.propostaId;
  });
  return porItem;
}
