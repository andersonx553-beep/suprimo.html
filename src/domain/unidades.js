// Unidades: "Und.", "un" e "unidade" são a mesma coisa na hora de comparar.
const SINONIMOS = {
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un", "pç": "un", pc: "un", "peça": "un", "peças": "un", peca: "un", pecas: "un",
  m: "m", mt: "m", mts: "m", metro: "m", metros: "m",
  kg: "kg", quilo: "kg", quilos: "kg", g: "g", t: "t",
  l: "l", lt: "l", litro: "l", litros: "l",
  cx: "cx", caixa: "cx", caixas: "cx",
  rl: "rl", rolo: "rl", rolos: "rl",
  pct: "pct", pacote: "pct", pacotes: "pct",
  par: "par", pares: "par", jg: "jg", jogo: "jg", kit: "kit", kits: "kit",
  br: "br", barra: "br", barras: "br",
  sc: "sc", saco: "sc", sacos: "sc",
  gl: "gl", "galão": "gl", galao: "gl", bd: "bd", balde: "bd", fd: "fd", fardo: "fd",
  lata: "lata", latas: "lata", ch: "ch", chapa: "ch", mil: "mil", dia: "dia", "mês": "mês", mes: "mês", h: "h", sv: "sv", vb: "vb",
  m2: "m²", "m²": "m²", m3: "m³", "m³": "m³",
};

const chave = (u) => String(u ?? "").trim().toLowerCase().replace(/\.$/, "");
export const ehUnidade = (texto) => Object.hasOwn(SINONIMOS, chave(texto));

/** Forma canônica da unidade; texto desconhecido volta em minúsculas. */
export function normalizarUnidade(u) {
  const k = chave(u);
  return Object.hasOwn(SINONIMOS, k) ? SINONIMOS[k] : k;
}
