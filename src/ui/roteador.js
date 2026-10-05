// Roteamento por hash: #/cotacoes · #/cotacoes/COT-0001/mapa · #/fornecedores · #/ajustes. Voltar e avançar do navegador funcionam.
export const ABAS = ["itens", "fornecedores", "propostas", "mapa", "decisao"];

/** @returns {{area:'cotacoes'|'fornecedores'|'ajustes', numero:string|null, aba:string}}  aba "importar" é a tela de importar orçamento */
export function lerRota(hash = location.hash) {
  const [area, numero, aba] = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (area === "fornecedores" || area === "ajustes") return { area, numero: null, aba: "" };
  return { area: "cotacoes", numero: numero || null, aba: aba === "importar" ? "importar" : ABAS.includes(aba) ? aba : "itens" };
}

export const linkCotacao = (numero, aba = "itens") => `#/cotacoes/${encodeURIComponent(numero)}/${aba}`;
export const linkImportar = (numero) => `#/cotacoes/${encodeURIComponent(numero)}/importar`;
export const ir = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = hash; };
