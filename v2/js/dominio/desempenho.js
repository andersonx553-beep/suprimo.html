// Desempenho do fornecedor: convites, respostas e vitórias nas cotações aprovadas.
const aprovada = (c) => c.decisao?.aprovacao?.estado === "aprovada";

export function vencedoresDaCotacao(cot) {
  if (!aprovada(cot)) return new Set();
  const d = cot.decisao;
  if (d.modo === "porItem") {
    return new Set(Object.values(d.porItem || {}).map((pid) => cot.propostas.find((p) => p.id === pid)?.fornecedorId).filter(Boolean));
  }
  const p = cot.propostas.find((x) => x.id === d.propostaId);
  return new Set(p ? [p.fornecedorId] : []);
}

export function desempenho(fornecedorId, cotacoes) {
  let convites = 0, respostas = 0, vitorias = 0;
  for (const c of cotacoes) {
    const convite = c.convites.find((v) => v.fornecedorId === fornecedorId);
    const proposta = c.propostas.some((p) => p.fornecedorId === fornecedorId);
    if (!convite && !proposta) continue;
    convites++;
    if (convite?.respondeu || proposta) respostas++;
    if (vencedoresDaCotacao(c).has(fornecedorId)) vitorias++;
  }
  return { convites, respostas, vitorias };
}
