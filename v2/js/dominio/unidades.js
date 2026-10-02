// Unidades de medida: normalização para comparar "UN", "und" e "unidade" como a mesma coisa.
const ALIAS = {
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un", "pç": "un", pc: "un", pca: "un", "peça": "un", "peças": "un", pecas: "un", peca: "un",
  m: "m", mt: "m", mts: "m", metro: "m", metros: "m",
  kg: "kg", quilo: "kg", quilos: "kg", g: "g",
  l: "l", lt: "l", litro: "l", litros: "l",
  cx: "cx", caixa: "cx", caixas: "cx",
  rl: "rl", rolo: "rl", rolos: "rl",
  pct: "pct", pacote: "pct", pacotes: "pct",
  par: "par", pares: "par",
  jg: "jg", jogo: "jg", jogos: "jg",
  kit: "kit", kits: "kit",
  br: "br", barra: "br", barras: "br",
  sc: "sc", saco: "sc", sacos: "sc",
  gl: "gl", "galão": "gl", galao: "gl", "galões": "gl",
  lata: "lata", latas: "lata",
  "m2": "m²", "m²": "m²", "m3": "m³", "m³": "m³",
};

export const ehUnidade = (t) => Object.hasOwn(ALIAS, String(t).toLowerCase().replace(/\.$/, ""));

/** Forma canônica da unidade ("Und." → "un"). Texto desconhecido volta em minúsculas. */
export function normalizarUn(u) {
  const k = String(u ?? "").trim().toLowerCase().replace(/\.$/, "");
  return Object.hasOwn(ALIAS, k) ? ALIAS[k] : k;
}
