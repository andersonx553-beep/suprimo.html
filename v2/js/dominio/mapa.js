// Regras do mapa comparativo. Funções puras: recebem a cotação e devolvem o resultado, sem tocar na tela.
import { normalizarUn } from "./unidades.js";
import { hojeIso } from "./formato.js";

const cent = (n) => Math.round(Number(n) * 100);

export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Chave que liga o item da cotação ao histórico de preços. */
export const chaveItem = (item) => item.chave || semAcento(item.descricao).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * @param cotacao  { itens:[{id,descricao,qtd,un}], propostas:[{id,fornecedorId,precos:{[itemId]:{preco,un?}},frete,prazoEntrega,pagamento,validade}] }
 * @param opcoes   { hoje:'AAAA-MM-DD', minPropostas, ultimoPreco:{[chave]:preco}, limiteAlta:0.15 }
 */
export function compararCotacao(cotacao, { hoje = hojeIso(), minPropostas = 3, ultimoPreco = {}, limiteAlta = 0.15 } = {}) {
  const itens = cotacao.itens || [];
  const propostas = cotacao.propostas || [];

  const colunas = propostas.map((p) => {
    const celulas = itens.map((item) => {
      const e = p.precos?.[item.id];
      const preco = e?.preco;
      if (preco == null || preco === "" || !Number.isFinite(Number(preco))) return { itemId: item.id, estado: "naoCotou" };
      const unidadeProposta = e.un || item.un;
      if (normalizarUn(unidadeProposta) !== normalizarUn(item.un)) {
        return { itemId: item.id, estado: "unidadeDivergente", preco: Number(preco), unidade: unidadeProposta };
      }
      const celula = { itemId: item.id, estado: "ok", preco: Number(preco), total: Math.round(cent(preco) * item.qtd) };
      const ultimo = ultimoPreco[chaveItem(item)];
      if (ultimo > 0 && Number(preco) > ultimo * (1 + limiteAlta)) {
        celula.altaSobreUltimo = { ultimo, percentual: Number(preco) / ultimo - 1 };
      }
      return celula;
    });

    const ok = celulas.filter((c) => c.estado === "ok");
    const subtotal = ok.reduce((s, c) => s + c.total, 0);
    const frete = p.frete == null || p.frete === "" ? 0 : cent(p.frete);
    const naoCotou = celulas.filter((c) => c.estado === "naoCotou").length;
    const divergentes = celulas.filter((c) => c.estado === "unidadeDivergente").length;
    return {
      propostaId: p.id,
      fornecedorId: p.fornecedorId,
      celulas,
      subtotal,
      frete,
      custoTotal: subtotal + frete,
      prazoEntrega: p.prazoEntrega ?? null,
      pagamento: p.pagamento || "",
      validade: p.validade || "",
      naoCotou,
      divergentes,
      incompleta: naoCotou > 0,
      vencida: !!p.validade && p.validade < hoje,
      // Só entra na sugestão quem cotou todos os itens, na unidade pedida.
      elegivel: itens.length > 0 && naoCotou === 0 && divergentes === 0,
      sugerida: false,
    };
  });

  // Menor preço unitário de cada linha, entre as células comparáveis (precisa de pelo menos duas).
  const linhas = itens.map((item, i) => {
    const comparaveis = colunas.map((c) => c.celulas[i]).filter((c) => c.estado === "ok");
    const menor = comparaveis.length >= 2 ? Math.min(...comparaveis.map((c) => c.preco)) : null;
    if (menor != null) comparaveis.forEach((c) => { c.menor = c.preco === menor; });
    return { item, menorPreco: menor };
  });

  const candidatas = colunas.filter((c) => c.elegivel).sort((a, b) => a.custoTotal - b.custoTotal || (a.prazoEntrega ?? 1e9) - (b.prazoEntrega ?? 1e9));
  const sugestaoId = candidatas[0]?.propostaId ?? null;
  colunas.forEach((c) => { c.sugerida = c.propostaId === sugestaoId; });

  return {
    linhas,
    colunas,
    sugestaoId,
    minPropostas,
    poucasPropostas: propostas.length < minPropostas,
  };
}

/** Compra dividida: um fornecedor por item. O frete de cada fornecedor escolhido conta uma vez. */
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
    escolhas.push({ item, propostaId: col.propostaId, fornecedorId: col.fornecedorId, preco: cel.preco, total: cel.total });
    fretes.set(col.propostaId, { propostaId: col.propostaId, fornecedorId: col.fornecedorId, frete: col.frete });
  });
  const listaFretes = [...fretes.values()];
  const totalFrete = listaFretes.reduce((s, f) => s + f.frete, 0);
  return { escolhas, fretes: listaFretes, totalItens, totalFrete, custoTotal: totalItens + totalFrete, faltaEscolher };
}

/** Menor preço de cada item entre as propostas comparáveis: ponto de partida da compra dividida. */
export function melhorPorItem(resultado) {
  const porItem = {};
  resultado.linhas.forEach(({ item }, i) => {
    let melhor = null;
    for (const c of resultado.colunas) {
      const cel = c.celulas[i];
      if (cel.estado === "ok" && (!melhor || cel.preco < melhor.preco)) melhor = { preco: cel.preco, propostaId: c.propostaId };
    }
    if (melhor) porItem[item.id] = melhor.propostaId;
  });
  return porItem;
}
