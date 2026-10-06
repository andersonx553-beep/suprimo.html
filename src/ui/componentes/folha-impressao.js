// Mapa para impressão/PDF. A assinatura do síndico aprova a cotação selecionada;
// o pedido ao fornecedor ocorre depois, fora do Suprimo.
import { html } from "../../lib/html.js";
import { reais, dataBr, hoje, numeroBr } from "../../lib/formato.js";
import { resumirDecisao } from "../../domain/decisao.js";
import { tabelaMapa, avisosDoMapa } from "./tabela-mapa.js";

export function folhaImpressao({ cot, res, forn, ajustes }) {
  const resumo = resumirDecisao(res, cot.decisao);
  const registrada = ["decidida", "concluida"].includes(cot.status) && resumo.completo;
  const nome = (id) => forn.get(id)?.nome ?? "Fornecedor";
  let decisao = html`<p class="folha__nota">RASCUNHO: fornecedor ainda não selecionado para aprovação. Registre a escolha na aba Decisão antes de colher a assinatura.</p>`;
  if (registrada && cot.decisao.modo === "unico") {
    const col = resumo.coluna;
    decisao = html`<p><strong>Fornecedor selecionado para aprovação do síndico: ${nome(col.fornecedorId)}</strong></p>
      <p>Itens ${reais(col.subtotal)} · desconto ${reais(col.descontoCentavos)} · frete ${reais(col.freteCentavos)} · <strong>total ${reais(resumo.custoTotal)}</strong></p>
      <p>Pagamento: ${col.pagamento || "não informado"} · Validade: ${col.validade ? dataBr(col.validade) : col.validadeTexto || "não informada"}${col.freteTexto ? html` · Condição de frete: ${col.freteTexto}` : ""}</p>`;
  } else if (registrada) {
    decisao = html`<p><strong>Fornecedores selecionados por item</strong> · total ${reais(resumo.custoTotal)} (frete de cada fornecedor incluído)</p>
      <ul>${resumo.divisao.escolhas.map((e) => html`<li>${e.item.descricao} (${numeroBr(e.item.quantidade)} ${e.item.unidade}): ${nome(e.fornecedorId)}, ${reais(e.centavos)} por unidade · ${reais(e.total)} no item</li>`)}</ul>`;
  }
  const originais = cot.propostas.filter((p) => p.orcamento?.itens?.length);
  return html`
    <header class="folha__cab">
      <div><strong>${ajustes.empresa?.nome || "Almoxarifado"}</strong>${ajustes.empresa?.cnpj ? html` · ${ajustes.empresa.cnpj}` : ""}<h1>Mapa comparativo para aprovação do síndico</h1></div>
      <dl><dt>Cotação</dt><dd>${cot.numero}</dd><dt>Emitido em</dt><dd>${dataBr(hoje())}</dd></dl>
    </header>
    <p class="folha__titulo">${cot.titulo}${cot.exemplo ? " (EXEMPLO)" : ""} · Solicitante: ${cot.solicitante || ajustes.solicitante || "—"}${cot.destino ? html` · Destino: ${cot.destino}` : ""}</p>
    ${avisosDoMapa(res).map((a) => html`<p class="folha__aviso">${a}</p>`)}
    ${res.colunas.length ? tabelaMapa(res, forn) : html`<p class="folha__nota">Nenhuma proposta lançada.</p>`}
    ${originais.length ? html`<section class="folha__originais"><h2>Descrições conforme os orçamentos recebidos</h2>
      <p class="folha__nota">Confirme a equivalência técnica entre marcas e modelos antes de aprovar. Valores comparados por item da cotação após conferência.</p>
      ${originais.map((p) => html`<div class="folha__origem"><strong>${nome(p.fornecedorId)} · orçamento ${p.orcamento.numero || "sem número"}</strong>
        <ol>${p.orcamento.itens.map((it) => html`<li>${it.descricao} · ${numeroBr(it.quantidade ?? 0)} ${it.unidade ?? ""} · ${reais(it.unitarioCentavos)} / un.</li>`)}</ol></div>`)}</section>` : ""}
    <section class="folha__decisao"><h2>Seleção para aprovação</h2>${decisao}${registrada && cot.decisao?.justificativa ? html`<p><strong>Justificativa:</strong> ${cot.decisao.justificativa}</p>` : ""}</section>
    ${registrada ? html`<section class="folha__aprovacao">
      <p>Ao assinar, aprovo a cotação e o(s) fornecedor(es) selecionado(s) acima. O pedido será feito pelo responsável ao fornecedor, fora do Suprimo.</p>
      <div class="folha__assinaturas"><div><span></span>Nome do síndico</div><div><span></span>Assinatura do síndico</div><div><span></span>Data</div></div>
    </section>` : ""}`;
}
