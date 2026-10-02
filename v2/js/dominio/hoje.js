// Fila "Hoje": o que precisa de ação, do mais urgente para o menos urgente.
import { diasEntre, dataBr } from "./formato.js";

export function montarFila(cotacoes, fornecedores, hoje) {
  const nome = (id) => fornecedores.get(id)?.nome ?? "Fornecedor";
  const fila = [];
  for (const c of cotacoes) {
    const base = { cotacaoId: c.id, numero: c.numero, titulo: c.titulo };
    if (c.status === "Aguardando propostas") {
      if (c.prazoPropostas) {
        const d = diasEntre(hoje, c.prazoPropostas);
        if (d < 0) fila.push({ ...base, aba: "propostas", tom: "ruim", urgencia: 1000 - d, motivo: "Prazo vencido", detalhe: `Propostas até ${dataBr(c.prazoPropostas)} (${-d} ${-d === 1 ? "dia" : "dias"} de atraso)` });
        else if (d <= 1) fila.push({ ...base, aba: "propostas", tom: "espera", urgencia: 600 - d, motivo: d === 0 ? "Vence hoje" : "Vence amanhã", detalhe: `Propostas até ${dataBr(c.prazoPropostas)}` });
      }
      for (const v of c.convites) {
        if (!v.enviadoEm || v.respondeu) continue;
        const d = diasEntre(v.enviadoEm, hoje);
        fila.push({ ...base, aba: "convidados", tom: "espera", urgencia: 300 + d, motivo: "Sem resposta", detalhe: `${nome(v.fornecedorId)}, convidado há ${d} ${d === 1 ? "dia" : "dias"}` });
      }
    }
    if (c.status === "Em análise") fila.push({ ...base, aba: "mapa", tom: "espera", urgencia: 100, motivo: "Em análise", detalhe: `${c.propostas.length} propostas para comparar` });
    if (c.status === "Aguardando aprovação") fila.push({ ...base, aba: "decisao", tom: "espera", urgencia: 400, motivo: "Aguardando o chefe", detalhe: "Registre a aprovação ou a recusa" });
    if (c.status === "Comprada" && c.entregaPrevista && c.entregaPrevista < hoje) {
      const d = diasEntre(c.entregaPrevista, hoje);
      fila.push({ ...base, aba: "decisao", tom: "ruim", urgencia: 900 + d, motivo: "Entrega atrasada", detalhe: `Previsto para ${dataBr(c.entregaPrevista)} (${d} ${d === 1 ? "dia" : "dias"} de atraso)` });
    }
  }
  return fila.sort((a, b) => b.urgencia - a.urgencia);
}
