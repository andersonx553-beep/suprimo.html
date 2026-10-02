// Último preço pago de cada item, tirado das cotações concluídas.
import { chaveItem } from "./mapa.js";

/**
 * @param {import('./tipos.js').Cotacao[]} cotacoes
 * @returns {Map<string,{centavos:number, data:string, fornecedorId:string, numero:string}>}
 */
export function ultimosPrecosPagos(cotacoes) {
  const mapa = new Map();
  const concluidas = cotacoes.filter((c) => c.status === "concluida" && c.decisao).sort((a, b) => (a.concluidaEm || "").localeCompare(b.concluidaEm || ""));
  for (const c of concluidas) {
    for (const item of c.itens) {
      const propostaId = c.decisao.modo === "porItem" ? c.decisao.porItem?.[item.id] : c.decisao.propostaId;
      const p = c.propostas.find((x) => x.id === propostaId);
      const e = p?.precos?.[item.id];
      if (e && Number.isInteger(e.centavos)) mapa.set(chaveItem(item.descricao), { centavos: e.centavos, data: c.concluidaEm || c.criadaEm, fornecedorId: p.fornecedorId, numero: c.numero });
    }
  }
  return mapa;
}
