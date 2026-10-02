// Formatação e leitura de números, datas e dinheiro (pt-BR).
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export const brl = (n) => (n == null || n === "" || Number.isNaN(Number(n)) ? "—" : moeda.format(Number(n)));
export const brlCentavos = (c) => moeda.format(c / 100);
export const num = (n) => decimal.format(Number(n));

/** Lê "18,90", "1.250,5" ou "18.9" e devolve número, ou null se vazio/inválido. */
export function lerNumero(texto) {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  let s = String(texto ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const isoDe = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const hojeIso = () => isoDe(new Date());
export const somarDias = (iso, dias) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return isoDe(d);
};
export const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
export const diasEntre = (deIso, ateIso) =>
  Math.round((new Date(ateIso + "T12:00:00") - new Date(deIso + "T12:00:00")) / 86400000);
