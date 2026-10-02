// Duplicar cotação: copia os itens e os fornecedores convidados; propostas e decisão ficam para trás.
/**
 * @param {import('./tipos.js').Cotacao} origem
 * @param {{id:string, numero:string, agora:string, hoje:string, novoId:()=>string, prazoPropostas:string}} novo
 * @returns {import('./tipos.js').Cotacao}
 */
export function duplicarCotacao(origem, { id, numero, agora, novoId, prazoPropostas }) {
  return {
    id, numero,
    titulo: `${origem.titulo} (cópia)`,
    solicitante: origem.solicitante, destino: origem.destino, observacoes: origem.observacoes,
    prazoPropostas, status: "rascunho", criadaEm: agora, atualizadaEm: agora, concluidaEm: "",
    itens: origem.itens.map((i) => ({ ...i, id: novoId() })),
    convites: origem.convites.map((c) => ({ id: novoId(), fornecedorId: c.fornecedorId, situacao: "nao_enviado", enviadoEm: "", canal: "" })),
    propostas: [], decisao: null,
  };
}
