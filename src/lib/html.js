// Gabarito de HTML que escapa tudo por padrão: só vira HTML o que passou por `html` ou `bruto`.
class HtmlSeguro {
  /** @param {string} texto */
  constructor(texto) { this.texto = texto; }
  toString() { return this.texto; }
}

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

function converter(valor) {
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(converter).join("");
  if (valor == null || valor === false) return "";
  return escapar(valor);
}

/** Marca um texto como HTML já seguro (use só com conteúdo escrito no código, como SVG de ícones). */
export const bruto = (texto) => new HtmlSeguro(String(texto));

/** Template tag: `html\`<p>${nome}</p>\`` escapa `nome`; fragmentos `html` aninhados passam direto. */
export function html(partes, ...valores) {
  let saida = partes[0];
  valores.forEach((v, i) => { saida += converter(v) + partes[i + 1]; });
  return new HtmlSeguro(saida);
}

/** @param {Element} el @param {HtmlSeguro} conteudo */
export function montar(el, conteudo) { el.innerHTML = conteudo.texto; }
