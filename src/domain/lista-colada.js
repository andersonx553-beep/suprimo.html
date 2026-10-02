// Leitor da lista colada: "20 tomada 20A", "100 m cabo 2,5 mm²", "cimento CP II 50kg - 30 sc".
import { ehUnidade, normalizarUnidade } from "./unidades.js";

/** @typedef {{quantidade:number, unidade:string, descricao:string, conferir:boolean}} ItemLido */

const lerQuantidade = (t) => (/^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, "")) : Number(t.replace(",", ".")));
const NUM = "(\\d+(?:[.,]\\d+)*)";

/**
 * Cada linha vira um item. `conferir` marca o que o sistema não conseguiu ler com segurança
 * (linha sem quantidade: assume 1 un).
 * @param {string} texto
 * @returns {ItemLido[]}
 */
export function lerListaColada(texto) {
  const itens = [];
  for (const bruta of String(texto ?? "").split(/\r?\n/)) {
    const linha = bruta.trim().replace(/^[-*•–]\s*/, "");
    if (!linha) continue;

    // "quantidade [unidade] descrição": 20 tomada 20A · 100 m cabo · 10 caixas de parafuso · 5x disjuntor
    let m = linha.match(new RegExp(`^${NUM}\\s*(?:x\\s+|×\\s*)?(.+)$`, "i"));
    if (m) {
      const partes = m[2].trim().split(/\s+/);
      let unidade = "un";
      let descricao = m[2].trim();
      if (partes.length > 1 && ehUnidade(partes[0])) {
        unidade = normalizarUnidade(partes[0]);
        descricao = partes.slice(1).join(" ").replace(/^de\s+/i, "");
      }
      itens.push({ quantidade: lerQuantidade(m[1]), unidade, descricao, conferir: false });
      continue;
    }

    // "descrição - quantidade [unidade]": cimento CP II 50kg - 30 sc
    m = linha.match(new RegExp(`^(.+?)\\s+[-–:]\\s*${NUM}\\s*([\\p{L}²³.]+)?\\s*$`, "iu"));
    if (m) {
      const unidadeLida = m[3] && ehUnidade(m[3]) ? normalizarUnidade(m[3]) : null;
      if (unidadeLida || !m[3]) {
        itens.push({ quantidade: lerQuantidade(m[2]), unidade: unidadeLida ?? "un", descricao: m[1].trim(), conferir: false });
        continue;
      }
    }

    itens.push({ quantidade: 1, unidade: "un", descricao: linha, conferir: true });
  }
  return itens;
}
