import { esc } from "../util.js";
import { icone } from "../icones.js";
import { num } from "../../dominio/formato.js";
import { lerListaColada } from "../../dominio/lista-colada.js";

export function renderItens({ cot }) {
  const dados = `<div class="campos dados-cot"><label>Título<input data-dado="titulo" value="${esc(cot.titulo)}"></label>
    <label>Prazo das propostas<input type="date" data-dado="prazoPropostas" value="${esc(cot.prazoPropostas)}"></label>
    <label>Solicitante<input data-dado="solicitante" value="${esc(cot.solicitante)}"></label></div>`;
  const linhas = cot.itens.map((i, n) => `<tr>
    <td class="num mono">${n + 1}</td>
    <td>${esc(i.descricao)}</td>
    <td class="num mono">${num(i.qtd)}</td><td class="mono">${esc(i.un)}</td>
    <td class="muted">${esc(i.spec || "")}</td>
    <td class="acao"><button class="btn-icone" data-remover-item="${i.id}" aria-label="Remover item ${esc(i.descricao)}">${icone("lixeira", 16)}</button></td></tr>`).join("");
  return `
    ${dados}
    <div class="tabela-quadro"><table class="tabela tabela-lista">
      <thead><tr><th class="num">#</th><th>Descrição</th><th class="num">Qtd</th><th>Un</th><th>Especificação</th><th></th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="6" class="vazio-linha">Nenhum item. Cole uma lista abaixo.</td></tr>`}</tbody></table></div>
    <div class="colar">
      <label for="lista-colada">Colar lista de itens</label>
      <textarea id="lista-colada" rows="4" placeholder="20 tomada 20A&#10;100 m cabo 2,5 mm²&#10;10 cx parafuso M6"></textarea>
      <div id="previa-lista" class="previa"></div>
      <button class="btn btn-principal" data-acao="adicionar-lista" disabled>${icone("mais", 16)}Adicionar à cotação</button>
    </div>`;
}

export function ligarItens(raiz, { cot, salvar }) {
  raiz.querySelectorAll("[data-dado]").forEach((el) => el.addEventListener("change", () => salvar((c) => { c[el.dataset.dado] = el.value.trim(); })));
  const area = raiz.querySelector("#lista-colada");
  const previa = raiz.querySelector("#previa-lista");
  const botao = raiz.querySelector('[data-acao="adicionar-lista"]');
  let lidos = [];
  area.addEventListener("input", () => {
    lidos = lerListaColada(area.value);
    botao.disabled = !lidos.length;
    previa.innerHTML = lidos.length
      ? `<table class="tabela"><tbody>${lidos.map((i) => `<tr class="${i.conferir ? "conferir" : ""}"><td class="num mono">${num(i.qtd)}</td><td class="mono">${esc(i.un)}</td><td>${esc(i.descricao)}</td><td class="muted">${i.conferir ? "sem quantidade: conferir" : ""}</td></tr>`).join("")}</tbody></table>`
      : "";
  });
  botao.addEventListener("click", () => salvar((c) => {
    for (const i of lidos) c.itens.push({ id: "it-" + Math.random().toString(36).slice(2, 8), descricao: i.descricao, qtd: i.qtd, un: i.un, spec: "" });
  }));
  raiz.querySelectorAll("[data-remover-item]").forEach((b) => b.addEventListener("click", () => salvar((c) => {
    c.itens = c.itens.filter((i) => i.id !== b.dataset.removerItem);
    c.propostas.forEach((p) => delete p.precos[b.dataset.removerItem]);
  })));
}
