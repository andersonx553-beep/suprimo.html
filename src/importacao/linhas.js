// Reconstrói linhas e células a partir dos trechos de texto com coordenadas (x, y) que o pdfjs entrega.

/**
 * @typedef {Object} Trecho  pedaço de texto do PDF; y cresce para baixo, em pontos
 * @property {number} p página (1...)  @property {number} x  @property {number} x2  @property {number} y  @property {number} h  @property {string} texto
 *
 * @typedef {Object} Celula @property {number} x @property {number} x2 @property {number} h @property {string} texto
 * @typedef {Object} Linha  @property {number} p @property {number} y @property {Celula[]} celulas @property {string} texto
 */

const TOLERANCIA_Y = 3;       // trechos com y parecido estão na mesma linha (fontes diferentes variam ~1 pt)
const GAP_COLADO = 0.5;       // menos que isso: letras do mesmo termo ("con" + "fi" + "rmação")
const GAP_COLUNA = 6;         // a partir disso: outra coluna/célula

/** @param {Trecho[]} trechos @returns {Linha[]} em ordem de página e de cima para baixo */
export function montarLinhas(trechos) {
  const validos = trechos.filter((t) => t.texto.trim() !== "");
  const ordenados = [...validos].sort((a, b) => a.p - b.p || a.y - b.y || a.x - b.x);
  /** @type {{p:number, y:number, trechos:Trecho[]}[]} */
  const grupos = [];
  for (const t of ordenados) {
    const g = grupos.find((x) => x.p === t.p && Math.abs(x.y - t.y) <= TOLERANCIA_Y);
    if (g) g.trechos.push(t); else grupos.push({ p: t.p, y: t.y, trechos: [t] });
  }
  grupos.sort((a, b) => a.p - b.p || a.y - b.y);
  return grupos.map((g) => {
    const itens = g.trechos.sort((a, b) => a.x - b.x);
    /** @type {Celula[]} */
    const celulas = [];
    for (const t of itens) {
      const ultima = celulas.at(-1);
      const gap = ultima ? t.x - ultima.x2 : Infinity;
      if (ultima && gap < GAP_COLUNA) {
        ultima.texto += (gap < GAP_COLADO || /\s$/.test(ultima.texto) || /^\s/.test(t.texto) ? "" : " ") + t.texto;
        ultima.x2 = Math.max(ultima.x2, t.x2);
        ultima.h = Math.max(ultima.h, t.h);
      } else {
        celulas.push({ x: t.x, x2: t.x2, h: t.h, texto: t.texto });
      }
    }
    for (const c of celulas) c.texto = c.texto.replace(/\s+/g, " ").trim();
    const limpas = celulas.filter((c) => c.texto);
    return { p: g.p, y: g.y, celulas: limpas, texto: limpas.map((c) => c.texto).join("  ") };
  }).filter((l) => l.celulas.length);
}
