// Números e datas no formato brasileiro, para a leitura de orçamentos.

const DINHEIRO = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})(?!\d)/;

/** "R$ 1.765,90" → 176590. Só aceita valor com vírgula e dois decimais: "1.000 L" não é dinheiro. */
export function lerDinheiro(texto) {
  const m = String(texto ?? "").match(DINHEIRO);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "")) * 100 + Number(m[2]);
}

/** Todos os valores em R$ de um texto, na ordem em que aparecem. */
export function todosDinheiros(texto) {
  return [...String(texto ?? "").matchAll(new RegExp(DINHEIRO.source, "g"))].map((m) => Number(m[1].replace(/\./g, "")) * 100 + Number(m[2]));
}

/** Quantidade: "20" → 20, "2,5" → 2.5, "1.000" → 1000. */
export function lerQuantidade(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  if (/^\d+(,\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d+\.\d+$/.test(t)) return Number(t);
  return null;
}

const DATA = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/;
/** "05/10/2026" → "2026-10-05"; devolve null se a data não existir no calendário. */
export function lerData(texto) {
  const m = String(texto ?? "").match(DATA);
  if (!m) return null;
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mes = Number(m[2]), dia = Number(m[1]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export const semAcentoMaiusculo = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
