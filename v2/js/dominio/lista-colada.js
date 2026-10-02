// Leitor da lista colada: "20 tomada 20A", "100 m cabo 2,5 mm²" → itens com quantidade, unidade e descrição.
import { ehUnidade, normalizarUn } from "./unidades.js";

function lerQuantidade(t) {
  // "1.000" é mil; "2,5" e "2.5" são decimais.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t.replace(",", "."));
}

/**
 * Cada linha vira { qtd, un, descricao, conferir }.
 * `conferir` é verdadeiro quando a linha não começava com quantidade (assumimos 1 un).
 */
export function lerListaColada(texto) {
  const itens = [];
  for (const bruta of String(texto ?? "").split(/\r?\n/)) {
    let linha = bruta.trim().replace(/^[-*•–]\s*/, "");
    if (!linha) continue;

    const m = linha.match(/^(\d+(?:[.,]\d+)*)\s*(?:x\s+|×\s*)?(.*)$/i);
    if (!m || !m[2].trim()) {
      itens.push({ qtd: 1, un: "un", descricao: linha, conferir: true });
      continue;
    }
    const qtd = lerQuantidade(m[1]);
    let resto = m[2].trim();
    let un = "un";
    const partes = resto.split(/\s+/);
    if (partes.length > 1 && ehUnidade(partes[0])) {
      un = normalizarUn(partes[0]);
      resto = partes.slice(1).join(" ").replace(/^de\s+/i, "");
    }
    itens.push({ qtd, un, descricao: resto, conferir: !Number.isFinite(qtd) || qtd <= 0 });
  }
  return itens;
}
