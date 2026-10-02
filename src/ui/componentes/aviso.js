// Aviso rápido no pé da tela (role=status, lido por leitores de tela).
let temporizador;
export function avisar(texto, { rotulo, aoClicar } = {}) {
  let el = document.getElementById("aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "aviso"; el.className = "aviso"; el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.replaceChildren(document.createTextNode(texto));
  if (rotulo) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = rotulo; b.addEventListener("click", () => { aoClicar?.(); el.dataset.visivel = "false"; });
    el.append(b);
  }
  el.dataset.visivel = "true";
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.dataset.visivel = "false"; }, 4200);
}
