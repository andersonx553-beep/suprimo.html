import { esc } from "./util.js";
import * as repos from "../dados/repos.js";
import { montarFila } from "../dominio/hoje.js";
import { hojeIso } from "../dominio/formato.js";

export async function abrirHoje(raiz) {
  const [cots, forns] = await Promise.all([repos.cotacoes.listar(), repos.fornecedores.listar()]);
  const fila = montarFila(cots, new Map(forns.map((f) => [f.id, f])), hojeIso());
  raiz.innerHTML = `
    <header class="cab-simples"><h1>Hoje</h1></header>
    ${fila.length ? `<div class="tabela-quadro"><table class="tabela tabela-lista"><thead><tr><th>Situação</th><th>Cotação</th><th>Detalhe</th><th></th></tr></thead><tbody>
      ${fila.map((i) => `<tr class="clicavel" data-href="#/cotacao/${i.cotacaoId}/${i.aba}">
        <td><span class="carimbo carimbo-${i.tom === "ruim" ? "ruim" : "espera"}">${esc(i.motivo)}</span></td>
        <td><a href="#/cotacao/${i.cotacaoId}/${i.aba}"><span class="mono">${esc(i.numero)}</span> ${esc(i.titulo)}</a></td>
        <td class="muted">${esc(i.detalhe)}</td><td class="acao"><a class="btn btn-peq" href="#/cotacao/${i.cotacaoId}/${i.aba}">Abrir</a></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="vazio"><p>Nada esperando por você.</p><a class="btn" href="#/cotacoes">Ver cotações</a></div>`}`;
  raiz.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = tr.dataset.href; }));
}
