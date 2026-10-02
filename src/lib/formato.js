// Formatação em pt-BR: moeda a partir de centavos, números e datas ISO.
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** @param {number|null|undefined} centavos */
export const reais = (centavos) => (centavos == null ? "—" : moeda.format(centavos / 100));
export const numeroBr = (n) => numero.format(n);
export const percentualBr = (fracao) => percentual.format(fracao);

/** Valor para campo de edição, sem o "R$": 1890 → "18,90". */
export const reaisCampo = (centavos) => (centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

export const dataBr = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const dataHoraBr = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${dataBr(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const isoData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoje = () => isoData(new Date());
export const somarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return isoData(d);
};
/** Dias de `de` até `ate` (negativo se `ate` é anterior). */
export const diasEntre = (de, ate) => Math.round((new Date(`${ate}T12:00:00`) - new Date(`${de}T12:00:00`)) / 86400000);
