// Dinheiro em centavos inteiros. Nada de ponto flutuante nas contas.

/** "18,90" → 1890; "1.250,5" → 125050; vazio ou inválido → null. */
export function lerCentavos(texto) {
  if (typeof texto === "number") return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  let s = String(texto ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Total de uma linha: preço unitário em centavos × quantidade (aceita quantidade decimal). */
export const totalLinha = (centavos, quantidade) => Math.round(centavos * quantidade);
