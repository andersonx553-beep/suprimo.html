import { esc } from "./util.js";
import { etiqueta } from "./cotacao.js";
import * as repos from "../dados/repos.js";
import { dataBr, hojeIso, somarDias } from "../dominio/formato.js";
import { icone } from "./icones.js";
import { STATUS, CANCELADA } from "../dominio/status.js";

export async function abrirLista(raiz) {
  const lista = await repos.cotacoes.listar();
  const forn = new Map((await repos.fornecedores.listar()).map((f) => [f.id, f]));
  let filtro = "";
  let busca = "";
  const desenhar = () => {
    const q = busca.toLowerCase();
    const vis = lista.filter((c) => (!filtro || c.status === filtro) && (!q ||
      [c.numero, c.titulo, ...c.itens.map((i) => i.descricao), ...c.convites.map((v) => forn.get(v.fornecedorId)?.nome || "")].join(" ").toLowerCase().includes(q)));
    raiz.querySelector("tbody").innerHTML = vis.map((c) => `<tr class="clicavel" data-id="${c.id}">
      <td class="mono"><a href="#/cotacao/${c.id}/mapa">${esc(c.numero)}</a></td><td>${esc(c.titulo)}</td><td>${etiqueta(c.status)}</td>
      <td class="num mono">${c.itens.length}</td><td class="num mono">${c.propostas.length}</td><td class="mono">${dataBr(c.prazoPropostas)}</td></tr>`).join("")
      || `<tr><td colspan="6" class="vazio-linha">${lista.length ? "Nenhuma cotação neste filtro." : "Nenhuma cotação. Crie a primeira acima."}</td></tr>`;
  };
  raiz.innerHTML = `
    <header class="cab-simples"><h1>Cotações</h1></header>
    <form class="nova" id="nova"><input id="nova-titulo" placeholder="Título da nova cotação, ex.: Material elétrico do galpão" aria-label="Título da nova cotação" required>
      <button class="btn btn-principal">${icone("mais", 16)}Criar cotação</button></form>
    <div class="filtros"><input type="search" id="busca" placeholder="Buscar por número, item ou fornecedor" aria-label="Buscar">
      <select id="filtro" aria-label="Status"><option value="">Todos os status</option>${[...STATUS, CANCELADA].map((s) => `<option>${s}</option>`).join("")}</select></div>
    <div class="tabela-quadro"><table class="tabela tabela-lista"><thead><tr><th>Número</th><th>Cotação</th><th>Status</th><th class="num">Itens</th><th class="num">Propostas</th><th>Prazo</th></tr></thead><tbody></tbody></table></div>`;
  raiz.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  raiz.querySelector("#filtro").addEventListener("change", (e) => { filtro = e.target.value; desenhar(); });
  raiz.addEventListener("click", (e) => { const tr = e.target.closest("tr.clicavel"); if (tr && !e.target.closest("a")) location.hash = `#/cotacao/${tr.dataset.id}/mapa`; });
  raiz.querySelector("#nova").addEventListener("submit", async (e) => {
    e.preventDefault();
    const aj = await repos.ajustes.obter();
    const n = Math.max(0, ...lista.map((c) => Number(c.numero.replace(/\D/g, "")) || 0)) + 1;
    const c = { id: "cot-" + Date.now().toString(36), numero: "COT-" + String(n).padStart(4, "0"), titulo: raiz.querySelector("#nova-titulo").value.trim(),
      status: "Rascunho", criadaEm: hojeIso(), prazoPropostas: somarDias(hojeIso(), aj.prazoPadraoDias), solicitante: aj.solicitante || "",
      itens: [], convites: [], propostas: [], decisao: { modo: "unico", propostaId: "", porItem: {}, justificativa: "", aprovacao: null } };
    await repos.cotacoes.salvar(c);
    location.hash = `#/cotacao/${c.id}/itens`;
  });
  desenhar();
}
