// Diálogo com <dialog>: o navegador prende o foco e fecha com Esc. Aqui só montamos o miolo e limpamos ao fechar.
import { html, montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";

/**
 * @param {{titulo:string, subtitulo?:string, corpo:any, rodape?:any, largo?:boolean, aoAbrir?:(dlg:HTMLDialogElement)=>void, aoFechar?:()=>void}} opcoes
 * @returns {HTMLDialogElement}
 */
export function abrirDialogo({ titulo, subtitulo = "", corpo, rodape = null, largo = false, aoAbrir, aoFechar }) {
  const dlg = document.createElement("dialog");
  dlg.className = `dialogo${largo ? " dialogo--largo" : ""}`;
  const idTitulo = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  dlg.setAttribute("aria-labelledby", idTitulo);
  montar(dlg, html`
    <form method="dialog" class="dialogo__cab">
      <div><h2 id="${idTitulo}" class="dialogo__titulo">${titulo}</h2>${subtitulo ? html`<p class="dialogo__sub">${subtitulo}</p>` : ""}</div>
      <button class="botao-icone" value="fechar" aria-label="Fechar">${icone("fechar")}</button>
    </form>
    <div class="dialogo__corpo">${corpo}</div>
    ${rodape ? html`<div class="dialogo__rodape">${rodape}</div>` : ""}`);
  document.body.append(dlg);
  dlg.addEventListener("close", () => { aoFechar?.(); dlg.remove(); });
  // Clique fora do painel fecha.
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  aoAbrir?.(dlg);
  return dlg;
}

/** Confirmação com texto claro. Resolve true se o usuário confirmar. */
export function confirmar({ titulo, texto, rotulo = "Confirmar", perigo = false }) {
  return new Promise((resolver) => {
    let resposta = false;
    abrirDialogo({
      titulo, corpo: html`<p>${texto}</p>`,
      rodape: html`<button class="botao" data-fechar>Cancelar</button><button class="botao ${perigo ? "botao--perigo" : "botao--primario"}" data-ok>${rotulo}</button>`,
      aoAbrir: (dlg) => {
        dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
        dlg.querySelector("[data-ok]").addEventListener("click", () => { resposta = true; dlg.close(); });
      },
      aoFechar: () => resolver(resposta),
    });
  });
}
