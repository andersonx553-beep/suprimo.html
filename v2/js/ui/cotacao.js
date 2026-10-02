// Tela da cotação aberta: cabeçalho, ação da etapa e as 5 abas.
import { esc } from "./util.js";
import { icone } from "./icones.js";
import { aviso } from "./util.js";
import * as repos from "../dados/repos.js";
import { compararCotacao, chaveItem } from "../dominio/mapa.js";
import { PROXIMO, TOM, CANCELADA } from "../dominio/status.js";
import { dataBr, diasEntre, hojeIso } from "../dominio/formato.js";
import { renderItens, ligarItens } from "./abas/itens.js";
import { renderConvidados, ligarConvidados } from "./abas/convidados.js";
import { renderPropostas, ligarPropostas } from "./abas/propostas.js";
import { renderMapa } from "./abas/mapa.js";
import { renderDecisao, ligarDecisao, resumoDecisao } from "./abas/decisao.js";
import { renderFolha } from "./folha-impressao.js";

export const etiqueta = (status) => `<span class="carimbo carimbo-${TOM[status] || "neutro"}">${esc(status)}</span>`;

const ABAS = [
  { id: "itens", nome: "Itens", n: (c) => c.itens.length },
  { id: "convidados", nome: "Fornecedores convidados", curto: "Convidados", n: (c) => c.convites.length },
  { id: "propostas", nome: "Propostas", n: (c) => c.propostas.length },
  { id: "mapa", nome: "Mapa comparativo", curto: "Mapa" },
  { id: "decisao", nome: "Decisão" },
];

export async function abrirCotacao(id, aba, raiz, { ir }) {
  let cot = await repos.cotacoes.obter(id);
  if (!cot) { raiz.innerHTML = `<div class="vazio"><p>Cotação não encontrada.</p><a class="btn" href="#/cotacoes">Ver cotações</a></div>`; return; }
  aba = ABAS.some((a) => a.id === aba) ? aba : "mapa";

  const [lista, ajustes, ultimo] = await Promise.all([repos.fornecedores.listar(), repos.ajustes.obter(), repos.precos.ultimoPorItem()]);
  const forn = new Map(lista.map((f) => [f.id, f]));
  const res = compararCotacao(cot, { minPropostas: ajustes.minPropostas, ultimoPreco: ultimo });

  const salvar = async (fn, { redesenhar = true } = {}) => {
    fn(cot);
    await repos.cotacoes.salvar(cot);
    if (redesenhar) abrirCotacao(id, aba, raiz, { ir });
  };
  const ctx = { cot, res, forn, ajustes, ultimo, salvar, ir: (a) => ir(`#/cotacao/${id}/${a}`) };

  ctx.aprovar = async (dados, aprovada) => {
    const r = resumoDecisao(ctx);
    if (aprovada && !r.completo) { aviso("Escolha o vencedor antes de registrar a aprovação."); return; }
    if (!dados.por) { aviso("Informe quem decidiu."); return; }
    await salvar(async (c) => {
      c.decisao.aprovacao = { estado: aprovada ? "aprovada" : "recusada", ...dados };
      c.status = aprovada ? "Aprovada" : "Em análise";
    }, { redesenhar: false });
    if (aprovada) {
      const itens = r.tipo === "unico"
        ? cot.itens.map((item, i) => ({ item, cel: r.col.celulas[i], f: r.col.fornecedorId }))
        : r.div.escolhas.map((e) => ({ item: e.item, cel: { estado: "ok", preco: e.preco }, f: e.fornecedorId }));
      await repos.precos.registrar(itens.filter((x) => x.cel.estado === "ok").map((x) => ({
        chave: chaveItem(x.item), preco: x.cel.preco, fornecedorId: x.f, data: dados.data || hojeIso(), cotacao: cot.numero,
      })));
    }
    ir(`#/cotacao/${id}/decisao`);
    abrirCotacao(id, "decisao", raiz, { ir });
  };

  const prox = PROXIMO[cot.status];
  const prazo = cot.prazoPropostas ? diasEntre(hojeIso(), cot.prazoPropostas) : null;
  const prazoTxt = prazo == null ? "" : prazo < 0 ? `<span class="vencido">propostas até ${dataBr(cot.prazoPropostas)} (vencido)</span>` : `propostas até ${dataBr(cot.prazoPropostas)}`;

  raiz.innerHTML = `
    <nav class="trilha" aria-label="Você está em"><a href="#/cotacoes">Cotações</a>${icone("seta", 12)}<span class="mono">${esc(cot.numero)}</span></nav>
    <header class="cab-cotacao">
      <div class="cab-titulo">
        <span class="codigo mono">${esc(cot.numero)}</span>
        ${etiqueta(cot.status)}
        ${cot.exemplo ? `<span class="carimbo carimbo-exemplo" title="Dados de exemplo">Exemplo</span>` : ""}
        <h1>${esc(cot.titulo)}</h1>
      </div>
      <div class="cab-meta muted">Criada em ${dataBr(cot.criadaEm)} · ${prazoTxt} · ${cot.itens.length} itens · ${cot.propostas.length} propostas</div>
      <div class="cab-acoes">
        ${prox ? `<button class="btn btn-principal" data-acao="proximo">${esc(prox.rotulo)}</button>` : ""}
        ${cot.status !== CANCELADA && cot.status !== "Recebida" ? `<button class="btn btn-sutil" data-acao="cancelar">Cancelar cotação</button>` : ""}
      </div>
    </header>
    <div class="abas" role="tablist">
      ${ABAS.map((a) => `<a role="tab" href="#/cotacao/${id}/${a.id}" aria-selected="${a.id === aba}" class="aba">${a.curto ? `<span class="so-largo">${a.nome}</span><span class="so-estreito">${a.curto}</span>` : a.nome}${a.n ? `<span class="cont mono">${a.n(cot)}</span>` : ""}</a>`).join("")}
    </div>
    <section class="painel" id="painel" role="tabpanel"></section>
    <div id="folha" class="folha" aria-hidden="true">${renderFolha(ctx)}</div>`;

  raiz.querySelector('.aba[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  const painel = raiz.querySelector("#painel");
  const renders = { itens: renderItens, convidados: renderConvidados, propostas: renderPropostas, mapa: renderMapa, decisao: renderDecisao };
  const ligadores = { itens: ligarItens, convidados: ligarConvidados, propostas: ligarPropostas, decisao: ligarDecisao };
  painel.innerHTML = renders[aba](ctx);
  ligadores[aba]?.(painel, ctx);

  painel.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => ctx.ir(b.dataset.ir)));
  raiz.querySelectorAll('[data-acao="imprimir"]').forEach((b) => b.addEventListener("click", () => window.print()));
  raiz.querySelector('[data-acao="proximo"]')?.addEventListener("click", () => {
    if (prox.aba) return ctx.ir(prox.aba);
    salvar((c) => { c.status = prox.para; });
  });
  raiz.querySelector('[data-acao="cancelar"]')?.addEventListener("click", () => {
    if (confirm(`Cancelar a cotação ${cot.numero}?`)) salvar((c) => { c.status = CANCELADA; });
  });
}
