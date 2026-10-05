// Liga cada item do orçamento a um item da cotação por semelhança de descrição. É só sugestão: a pessoa confere na tela.
import { semAcento } from "../domain/mapa.js";

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "em", "a", "o", "um", "uma", "x"]);
const tokens = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9/,.\s-]/g, " ").split(/\s+/).map((t) => t.replace(/^[-.,]+|[-.,]+$/g, "")).filter((t) => t && !PALAVRAS_VAZIAS.has(t));

/** 0 a 1: quanto as duas descrições se parecem (palavras em comum, medidas e números pesam mais). */
export function semelhanca(a, b) {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let comum = 0, peso = 0, total = 0;
  for (const t of new Set([...ta, ...tb])) {
    const w = /\d/.test(t) ? 2 : 1;
    total += w;
    if (ta.has(t) && tb.has(t)) { comum += w; peso += w; }
  }
  return peso / total;
}

export const LIMIAR = 0.5;

/**
 * Para cada linha do orçamento, o id do item da cotação que mais se parece, sem repetir item.
 * @returns {(string|null)[]} null quando nada se parece o bastante
 */
export function sugerirCorrespondencias(itensOrcamento, itensCotacao) {
  const pares = [];
  itensOrcamento.forEach((o, i) => itensCotacao.forEach((c) => {
    const s = semelhanca(o.descricao, c.descricao);
    if (s >= LIMIAR) pares.push({ i, id: c.id, s });
  }));
  pares.sort((a, b) => b.s - a.s);
  const resultado = Array(itensOrcamento.length).fill(null);
  const usados = new Set();
  for (const p of pares) {
    if (resultado[p.i] || usados.has(p.id)) continue;
    resultado[p.i] = p.id; usados.add(p.id);
  }
  return resultado;
}
