// Fila "precisa de ação" do topo de Cotações, do mais urgente para o menos urgente.
import { diasEntre } from "../lib/formato.js";

/** @typedef {{cotacaoId:string, numero:string, titulo:string, aba:string, tom:'vermelho'|'ambar', motivo:string, detalhe:string, urgencia:number}} ItemFila */

/** @returns {ItemFila[]} */
export function montarFila(cotacoes, fornecedores, hoje) {
  const nome = (id) => fornecedores.get(id)?.nome ?? "Fornecedor";
  const fila = [];
  for (const c of cotacoes) {
    const base = { cotacaoId: c.id, numero: c.numero, titulo: c.titulo };
    if (c.status === "aguardando_propostas") {
      if (c.prazoPropostas) {
        const d = diasEntre(hoje, c.prazoPropostas);
        if (d < 0) fila.push({ ...base, aba: "propostas", tom: "vermelho", urgencia: 1000 - d, motivo: "Prazo vencido", detalhe: `${-d} ${-d === 1 ? "dia" : "dias"} de atraso para receber propostas` });
        else if (d <= 1) fila.push({ ...base, aba: "propostas", tom: "ambar", urgencia: 600 - d, motivo: d === 0 ? "Vence hoje" : "Vence amanhã", detalhe: "Prazo para receber propostas" });
      }
      for (const v of c.convites) {
        if (v.situacao !== "enviado") continue;
        const d = Math.max(0, diasEntre(v.enviadoEm.slice(0, 10), hoje));
        fila.push({ ...base, aba: "fornecedores", tom: "ambar", urgencia: 300 + d, motivo: "Sem resposta", detalhe: `${nome(v.fornecedorId)}, solicitado há ${d} ${d === 1 ? "dia" : "dias"}` });
      }
    }
    if (c.status === "em_analise") fila.push({ ...base, aba: "decisao", tom: "ambar", urgencia: 200, motivo: "Esperando decisão", detalhe: `${c.propostas.length} ${c.propostas.length === 1 ? "proposta" : "propostas"} para decidir` });
  }
  return fila.sort((a, b) => b.urgencia - a.urgencia);
}
