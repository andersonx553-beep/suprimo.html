export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function baixarArquivo(nome, texto, tipo = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let timer;
export function aviso(texto) {
  let el = document.getElementById("aviso");
  if (!el) { el = document.createElement("div"); el.id = "aviso"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("visivel"), 3200);
}
