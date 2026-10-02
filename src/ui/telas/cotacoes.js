// Tela inicial: no topo só o que precisa de ação; abaixo, todas as cotações com busca e filtro de status.
import { html, montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { dataBr, hoje } from "../../lib/formato.js";
import { montarFila } from "../../domain/fila.js";
import { LISTA_STATUS, rotuloStatus } from "../../domain/status.js";
import { semAcento } from "../../domain/mapa.js";
import { linkCotacao, ir } from "../roteador.js";
import { etiquetaStatus, estadoVazio } from "../componentes/pecas.js";
import { abrirDialogo } from "../componentes/dialogo.js";
import { avisar } from "../componentes/aviso.js";

// Busca e filtro lembrados enquanto a página estiver aberta.
const filtro = { busca: "", status: "" };

function textoBusca(c, forn) {
  return semAcento([c.numero, c.titulo, ...c.itens.map((i) => i.descricao), ...c.convites.map((v) => forn.get(v.fornecedorId)?.nome ?? "")].join(" ")).toLowerCase();
}

export function telaCotacoes(raiz, { store }) {
  const { cotacoes } = store.estado;
  const forn = store.fornecedoresPorId();
  const fila = montarFila(cotacoes, forn, hoje());

  const abrirNova = () => abrirDialogo({
    titulo: "Nova cotação", subtitulo: "Dá um nome que você reconheça na lista. O resto você preenche depois.",
    corpo: html`<form id="fn" class="formulario"><label class="campo-rotulado">Título<input class="campo" name="titulo" placeholder="Ex.: Material elétrico do galpão 2" required autofocus></label></form>`,
    rodape: html`<button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-criar>${icone("mais", 16)}Criar cotação</button>`,
    aoAbrir: (dlg) => {
      const f = dlg.querySelector("#fn");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      const criar = (e) => { e?.preventDefault(); if (!f.reportValidity()) return; const c = store.criarCotacao({ titulo: f.titulo.value.trim() }); dlg.close(); ir(linkCotacao(c.numero, "itens")); };
      f.addEventListener("submit", criar);
      dlg.querySelector("[data-criar]").addEventListener("click", criar);
    },
  });

  const cabecalho = html`
    <header class="pagina__cab">
      <div><p class="pagina__sobre">Processos de compra</p><h1 class="pagina__titulo">Cotações</h1></div>
      <button class="botao botao--destaque" data-nova>${icone("mais", 16)}Nova cotação</button>
    </header>`;

  if (!cotacoes.length) {
    montar(raiz, html`${cabecalho}<section class="cartao">${estadoVazio({ icone: "cotacoes", titulo: "Nenhuma cotação ainda",
      texto: "Crie a primeira, adicione os itens e convide fornecedores. Quer ver o mapa comparativo antes? Carregue a demonstração.",
      acoes: html`<button class="botao botao--primario" data-nova>${icone("mais", 16)}Criar cotação</button><button class="botao" data-demo>Carregar demonstração</button>` })}</section>`);
    raiz.querySelectorAll("[data-nova]").forEach((b) => b.addEventListener("click", abrirNova));
    raiz.querySelector("[data-demo]").addEventListener("click", async () => { const c = await store.carregarExemplo(); avisar("Demonstração carregada. Os dados de exemplo estão marcados."); ir(linkCotacao(c.numero, "mapa")); });
    return () => {};
  }

  montar(raiz, html`
    ${cabecalho}
    ${fila.length ? html`
      <section class="cartao fila" aria-labelledby="fila-t">
        <h2 id="fila-t" class="cartao__titulo">Precisa de você <span class="contador">${fila.length}</span></h2>
        <ul class="fila__lista">${fila.map((i) => html`
          <li><a class="fila__item" href="${linkCotacao(i.numero, i.aba)}" data-tom="${i.tom}">
            <span class="selo" data-tom="${i.tom === "vermelho" ? "perigo" : "ambar"}">${i.motivo}</span>
            <span class="fila__cot"><span class="mono">${i.numero}</span> ${i.titulo}</span>
            <span class="fila__detalhe">${i.detalhe}</span>${icone("seta", 16)}</a></li>`)}</ul>
      </section>` : html`<p class="fila-vazia">${icone("ok", 16)}Nada esperando por você agora.</p>`}
    <section class="cartao" aria-labelledby="lista-t">
      <div class="lista__cab"><h2 id="lista-t" class="cartao__titulo">Todas as cotações <span class="contador" data-total></span></h2>
        <div class="lista__filtros">
          <label class="busca">${icone("lupa", 16)}<span class="sr-only">Buscar cotação</span><input class="campo" type="search" data-busca placeholder="Número, item ou fornecedor" value="${filtro.busca}"></label>
          <label><span class="sr-only">Filtrar por status</span><select class="campo" data-status><option value="">Todos os status</option>${[...LISTA_STATUS].map((s) => html`<option value="${s}" ${s === filtro.status ? "selected" : ""}>${rotuloStatus(s)}</option>`)}</select></label>
        </div></div>
      <div class="tabela-quadro tabela-quadro--solto"><table class="tabela tabela--lista">
        <thead><tr><th>Número</th><th>Cotação</th><th>Status</th><th class="tabela__num">Itens</th><th class="tabela__num">Propostas</th><th>Prazo</th></tr></thead>
        <tbody data-corpo></tbody></table></div>
    </section>`);

  const corpo = raiz.querySelector("[data-corpo]"), total = raiz.querySelector("[data-total]");
  const desenhar = () => {
    const q = semAcento(filtro.busca).toLowerCase().trim();
    const vistas = cotacoes.filter((c) => (!filtro.status || c.status === filtro.status) && (!q || textoBusca(c, forn).includes(q)))
      .sort((a, b) => b.numero.localeCompare(a.numero));
    total.textContent = vistas.length === cotacoes.length ? String(cotacoes.length) : `${vistas.length} de ${cotacoes.length}`;
    montar(corpo, vistas.length ? html`${vistas.map((c) => html`
      <tr><td data-rotulo="Número"><a class="mono tabela__link" href="${linkCotacao(c.numero, c.status === "em_analise" ? "mapa" : "itens")}">${c.numero}</a></td>
        <td data-rotulo="Cotação"><a class="tabela__link" href="${linkCotacao(c.numero, c.status === "em_analise" ? "mapa" : "itens")}">${c.titulo}</a>${c.exemplo ? html` <span class="selo" data-tom="neutro">Exemplo</span>` : ""}</td>
        <td data-rotulo="Status">${etiquetaStatus(c.status)}</td>
        <td class="tabela__num" data-rotulo="Itens">${c.itens.length}</td><td class="tabela__num" data-rotulo="Propostas">${c.propostas.length}/${c.convites.length}</td>
        <td class="mono" data-rotulo="Prazo">${dataBr(c.prazoPropostas)}</td></tr>`)}`
      : html`<tr><td colspan="6" class="tabela__vazio">Nenhuma cotação encontrada. Limpe a busca ou o filtro.</td></tr>`);
  };
  raiz.querySelector("[data-busca]").addEventListener("input", (e) => { filtro.busca = e.target.value; desenhar(); });
  raiz.querySelector("[data-status]").addEventListener("change", (e) => { filtro.status = e.target.value; desenhar(); });
  raiz.querySelectorAll("[data-nova]").forEach((b) => b.addEventListener("click", abrirNova));
  desenhar();
  return () => {};
}
