// Desempenho do fornecedor: convites, respostas e vitórias (em cotações decididas ou concluídas).

export function vencedoresDaCotacao(cot) {
  if (!cot.decisao || !["decidida", "concluida"].includes(cot.status)) return new Set();
  const d = cot.decisao;
  const ids = d.modo === "porItem" ? Object.values(d.porItem ?? {}) : [d.propostaId];
  return new Set(ids.map((id) => cot.propostas.find((p) => p.id === id)?.fornecedorId).filter(Boolean));
}

export function desempenho(fornecedorId, cotacoes) {
  let convites = 0, respostas = 0, vitorias = 0;
  for (const c of cotacoes) {
    const convite = c.convites.find((v) => v.fornecedorId === fornecedorId);
    const proposta = c.propostas.some((p) => p.fornecedorId === fornecedorId);
    if (!convite) continue;
    convites++;
    if (convite.situacao === "respondeu" || proposta) respostas++;
    if (vencedoresDaCotacao(c).has(fornecedorId)) vitorias++;
  }
  return { convites, respostas, vitorias };
}
