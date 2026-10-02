// Tema: "auto" segue o aparelho; "claro" e "escuro" fixam. A escolha fica no localStorage (preferência deste navegador).
const CHAVE = "suprimo:tema";

export function temaEscolhido() {
  try { return localStorage.getItem(CHAVE) || "auto"; } catch { return "auto"; }
}
export function aplicarTema(tema) {
  if (tema === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = tema;
  try { localStorage.setItem(CHAVE, tema); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
/** Tema que está valendo agora, resolvendo "auto". */
export const temaEfetivo = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro");
