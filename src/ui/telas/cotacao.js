// Tela de uma cotação: cabeçalho, ação da etapa e as 5 abas.
import { html, montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { dataBr, hoje } from "../../lib/formato.js";
import { compararCotacao } from "../../domain/mapa.js";
import { proximoPasso, voltar, estaEncerrada, rotuloStatus } from "../../domain/status.js";
import { ultimosPrecosPagos } from "../../domain/precos.js";
import { linkCotacao, ir, ABAS } from "../roteador.js";
import { etiquetaStatus, estadoVazio } from "../componentes/pecas.js";
import { abrirDialogo, confirmar } from "../componentes/dialogo.js";
import { folhaImpressao } from "../componentes/folha-impressao.js";
import { avisar } from "../componentes/aviso.js";
import { abaItens, ligarItens } from "./abas/itens.js";
import { abaFornecedores, ligarFornecedores } from "./abas/fornecedores.js";
import { abaPropostas, ligarPropostas } from "./abas/propostas.js";
import { abaMapa } from "./abas/mapa.js";
import { abaDecisao, ligarDecisao } from "./abas/decisao.js";

const ROTULOS = { itens: "Itens", fornecedores: "Fornecedores e envio", propostas: "Propostas", mapa: "Mapa comparativo", decisao: "Decisão" };
const CURTOS = { fornecedores: "Fornecedores", mapa: "Mapa" };

/** Cada aba tem o miolo (HTML) e, se precisar, a ligação dos eventos. */
const ABAS_UI = { itens: [abaItens, ligarItens], fornecedores: [abaFornecedores, ligarFornecedores], propostas: [abaPropostas, ligarPropostas], mapa: [abaMapa, null], decisao: [abaDecisao, ligarDecisao] };

function concluida(cot, aba) {
  return { itens: cot.itens.length > 0, fornecedores: cot.convites.length > 0, propostas: cot.propostas.length > 0, mapa: cot.propostas.length > 0, decisao: cot.status === "decidida" || cot.status === "concluida" }[aba];
}
const contagem = (cot, aba) => ({ itens: cot.itens.length, fornecedores: cot.convites.length, propostas: cot.propostas.length })[aba];

/** @returns {() => void} limpeza */
export function telaCotacao(raiz, { store, rota }) {
  const cot = store.cotacao(rota.numero);
  if (!cot) {
    montar(raiz, estadoVazio({ icone: "cotacoes", titulo: "Cotação não encontrada", texto: `Não existe ${rota.numero} neste navegador.`, acoes: html`<a class="botao botao--primario" href="#/cotacoes">Ver cotações</a>` }));
    return () => {};
  }
  const forn = store.fornecedoresPorId();
  const ajustes = store.estado.ajustes;
  const ultimo = ultimosPrecosPagos(store.estado.cotacoes);
  const res = compararCotacao(cot, { hoje: hoje(), minPropostas: ajustes.minPropostas, ultimoPreco: ultimo });
  const ctx = { cot, res, forn, ajustes, ultimo, store };
  const passo = proximoPasso(cot.status);
  const encerrada = estaEncerrada(cot.status);
  const [conteudoAba, ligarAba] = ABAS_UI[rota.aba];
  const base = (aba) => linkCotacao(cot.numero, aba);

  montar(raiz, html`
    <a class="voltar" href="#/cotacoes">${icone("voltar", 16)}Cotações</a>
    <section class="cartao cotacao">
      <header class="cotacao__cab">
        <div class="cotacao__titulos">
          <p class="cotacao__codigo"><span class="mono">${cot.numero}</span> · criada em ${dataBr(cot.criadaEm)} ${etiquetaStatus(cot.status)}${cot.exemplo ? html` <span class="selo" data-tom="neutro">Exemplo</span>` : ""}</p>
          <h1 class="cotacao__titulo">${cot.titulo}</h1>
        </div>
        <div class="cotacao__acoes">
          ${passo && passo.aba !== rota.aba ? html`<button class="botao botao--primario" data-passo>${passo.rotulo}${icone("seta", 16)}</button>` : ""}
          <button class="botao-icone botao-icone--caixa" data-editar aria-label="Editar dados da cotação" title="Editar dados">${icone("editar")}</button>
          <button class="botao-icone botao-icone--caixa" data-duplicar aria-label="Duplicar cotação" title="Duplicar">${icone("duplicar")}</button>
          ${cot.status === "cancelada" ? html`<button class="botao" data-voltar>Reativar como rascunho</button>` : html`<button class="botao-icone botao-icone--caixa" data-cancelar aria-label="Cancelar cotação" title="Cancelar cotação">${icone("fechar")}</button>`}
        </div>
      </header>
      <dl class="dados">
        <div><dt>Solicitante</dt><dd>${cot.solicitante || "—"}</dd></div>
        <div><dt>Destino</dt><dd>${cot.destino || "—"}</dd></div>
        <div><dt>Prazo para propostas</dt><dd class="mono" data-vencido="${String(cot.prazoPropostas && cot.prazoPropostas < hoje() && cot.status === "aguardando_propostas")}">${dataBr(cot.prazoPropostas)}</dd></div>
        ${cot.observacoes ? html`<div class="dados__obs"><dt>Observações</dt><dd>${cot.observacoes}</dd></div>` : ""}
      </dl>
      ${encerrada ? html`<p class="faixa" data-tom="neutro">${icone("info", 16)}<span>Cotação ${rotuloStatus(cot.status).toLowerCase()}: itens e propostas ficam travados.${voltar(cot.status) && cot.status !== "cancelada" ? " Reabra a análise na aba Decisão para mudar." : ""}</span></p>` : ""}
      <nav class="abas" role="tablist" aria-label="Etapas da cotação">
        ${ABAS.map((aba, i) => html`
          <a class="aba" role="tab" href="${base(aba)}" aria-selected="${String(aba === rota.aba)}" data-feita="${String(!!concluida(cot, aba))}">
            <span class="aba__num">${concluida(cot, aba) && aba !== rota.aba ? icone("ok", 12) : i + 1}</span>
            <span>${CURTOS[aba] ? html`<span class="so-largo">${ROTULOS[aba]}</span><span class="so-estreito">${CURTOS[aba]}</span>` : ROTULOS[aba]}</span>
            ${contagem(cot, aba) != null ? html`<span class="aba__cont">${contagem(cot, aba)}</span>` : ""}
          </a>`)}
      </nav>
      <div class="painel" role="tabpanel" id="painel">${conteudoAba(ctx)}</div>
    </section>
    <div class="folha" aria-hidden="true">${folhaImpressao(ctx)}</div>`);

  raiz.querySelector('.aba[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  const painel = raiz.querySelector("#painel");
  const limparAba = ligarAba?.(painel, ctx);
  raiz.querySelectorAll('[data-acao="imprimir"]').forEach((b) => b.addEventListener("click", () => window.print()));

  raiz.querySelector("[data-passo]")?.addEventListener("click", () => {
    if (passo.aba) return ir(base(passo.aba));
    store.atualizarCotacao(cot.id, (c) => { c.status = passo.para; if (passo.para === "concluida") c.concluidaEm = new Date().toISOString(); });
    if (passo.para === "em_analise") ir(base("mapa"));
  });
  raiz.querySelector("[data-voltar]")?.addEventListener("click", () => store.atualizarCotacao(cot.id, (c) => { c.status = voltar(c.status); }));
  raiz.querySelector("[data-duplicar]").addEventListener("click", () => {
    const copia = store.duplicarCotacao(cot.id);
    avisar(`${copia.numero} criada a partir desta.`);
    ir(linkCotacao(copia.numero, "itens"));
  });
  raiz.querySelector("[data-cancelar]")?.addEventListener("click", async () => {
    if (await confirmar({ titulo: `Cancelar ${cot.numero}?`, texto: "A cotação fica guardada como cancelada e pode ser reativada depois.", rotulo: "Cancelar cotação", perigo: true })) {
      store.atualizarCotacao(cot.id, (c) => { c.status = "cancelada"; });
    }
  });
  raiz.querySelector("[data-editar]").addEventListener("click", () => dialogoDados(store, cot));
  return () => limparAba?.();
}

function dialogoDados(store, cot) {
  abrirDialogo({
    titulo: "Dados da cotação",
    corpo: html`<form id="fd" class="formulario">
      <label class="campo-rotulado">Título<input class="campo" name="titulo" value="${cot.titulo}" required></label>
      <div class="formulario__grade formulario__grade--2">
        <label class="campo-rotulado">Solicitante<input class="campo" name="solicitante" value="${cot.solicitante}"></label>
        <label class="campo-rotulado">Prazo para propostas<input class="campo" type="date" name="prazoPropostas" value="${cot.prazoPropostas}"></label>
      </div>
      <label class="campo-rotulado">Destino (local de entrega)<input class="campo" name="destino" value="${cot.destino}"></label>
      <label class="campo-rotulado">Observações<textarea class="campo" name="observacoes" rows="3">${cot.observacoes}</textarea></label>
    </form>`,
    rodape: html`<button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-salvar>Salvar</button>`,
    aoAbrir: (dlg) => {
      const f = dlg.querySelector("#fd");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      dlg.querySelector("[data-salvar]").addEventListener("click", () => {
        if (!f.reportValidity()) return;
        store.atualizarCotacao(cot.id, (c) => Object.assign(c, { titulo: f.titulo.value.trim(), solicitante: f.solicitante.value.trim(), prazoPropostas: f.prazoPropostas.value, destino: f.destino.value.trim(), observacoes: f.observacoes.value.trim() }));
        dlg.close();
      });
    },
  });
}
