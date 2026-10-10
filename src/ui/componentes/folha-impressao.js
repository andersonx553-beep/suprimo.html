// Mapa Aquaville para impressão/PDF em uma página A4 paisagem.
// A assinatura do síndico aprova a cotação; o pedido é feito depois, fora do Suprimo.
import { html } from "../../lib/html.js";
import { reais, dataBr, hoje, numeroBr } from "../../lib/formato.js";
import { resumirDecisao } from "../../domain/decisao.js";
import { tabelaMapa, avisosDoMapa } from "./tabela-mapa.js";

const SOLICITANTE_PADRAO = "Condomínio Edifício Aqua Ville";
const DESTINO_PADRAO = "Av. Mar Mediterrâneo, 202 - Porto das Dunas, Aquiraz/CE";

export function folhaImpressao({ cot, res, forn, ajustes }) {
  const resumo = resumirDecisao(res, cot.decisao);
  const registrada = ["decidida", "concluida"].includes(cot.status) && resumo.completo;
  const nome = (id) => forn.get(id)?.nome ?? "Fornecedor";
  const solicitante = ajustes.empresa?.nome || SOLICITANTE_PADRAO;
  const cotacaoFeitaPor = cot.solicitante || ajustes.solicitante || "";
  const destino = cot.destino || ajustes.destinoPadrao || DESTINO_PADRAO;
  const pagamento = registrada
    ? cot.decisao.modo === "unico" ? resumo.coluna?.pagamento || "não informado" : "Conforme fornecedores e itens escolhidos no mapa comparativo"
    : "A definir após escolha da proposta";
  const escala = Math.min(1, 22 / Math.max(cot.itens.length, 22), 3 / Math.max(res.colunas.length, 3));
  const avisos = avisosDoMapa(res);
  const originais = cot.propostas.filter((p) => p.orcamento?.itens?.length);
  let decisao = html`<p class="folha__rascunho"><strong>RASCUNHO</strong> · Selecione uma proposta na aba Decisão antes de colher a aprovação.</p>`;

  if (registrada && cot.decisao.modo === "unico") {
    const col = resumo.coluna;
    decisao = html`
      <div class="folha__decisao-destaque"><strong>Fornecedor indicado para aprovação: ${nome(col.fornecedorId)}</strong><strong>Total final: ${reais(resumo.custoTotal)}</strong></div>
      <p>Itens ${reais(col.subtotal)} · desconto ${reais(col.descontoCentavos)} · frete ${col.fretePendente ? "a confirmar" : reais(col.freteCentavos)}${col.freteTexto ? ` (${col.freteTexto})` : ""}</p>
      <p>Entrega ${col.prazoEntregaDias != null ? `${numeroBr(col.prazoEntregaDias)} ${col.prazoEntregaDias === 1 ? "dia" : "dias"}` : "não informada"} · Validade ${col.validade ? dataBr(col.validade) : col.validadeTexto || "não informada"}</p>`;
  } else if (registrada) {
    decisao = html`
      <div class="folha__decisao-destaque"><strong>Compra dividida · fornecedores escolhidos marcados na tabela</strong><strong>Total final: ${reais(resumo.custoTotal)}</strong></div>
      <p>${resumo.divisao.escolhas.length} itens · ${resumo.divisao.fretes.length} fornecedores · fretes incluídos uma vez por fornecedor.</p>`;
  }

  return html`
    <article class="folha__documento" data-itens="${cot.itens.length}" style="--folha-escala: ${escala}">
      <header class="folha__cab">
        <img class="folha__logo" src="assets/aquaville-logo.png" alt="Aquaville" />
        <div class="folha__identidade"><p>AQUAVILLE · COTAÇÃO</p><h1>Mapa comparativo para aprovação</h1></div>
        <dl class="folha__numero"><dt>Nº da cotação</dt><dd>${cot.numero}</dd><dt>Emitido em</dt><dd>${dataBr(hoje())}</dd></dl>
      </header>
      <section class="folha__dados" aria-label="Dados da cotação">
        <div><strong>Objeto</strong><span>${cot.titulo}${cot.exemplo ? " · EXEMPLO" : ""}</span></div>
        <div><strong>Solicitante</strong><span>${solicitante}</span></div>
        <div class="folha__feito-por"><strong>Cotação feita por</strong><span>${cotacaoFeitaPor || ""}</span><i aria-hidden="true"></i></div>
      </section>
      ${avisos.length ? html`<p class="folha__avisos"><strong>Conferir:</strong> ${avisos.join(" · ")}</p>` : ""}
      ${res.colunas.length ? tabelaMapa(res, forn, { propostas: cot.propostas, decisao: cot.decisao }) : html`<p class="folha__rascunho">Nenhuma proposta foi lançada.</p>`}
      ${originais.length ? html`<p class="folha__referencias"><strong>Orçamentos comparados:</strong> ${originais.map((p) => `${nome(p.fornecedorId)} · nº ${p.orcamento.numero || "não informado"}`).join(" · ")}. Descrições originais permanecem nos documentos recebidos.</p>` : ""}
      <section class="folha__decisao" aria-label="Resumo da decisão"><h2>Escolha para aprovação</h2>${decisao}${registrada && cot.decisao?.justificativa ? html`<p><strong>Justificativa:</strong> ${cot.decisao.justificativa}</p>` : ""}</section>
      <section class="folha__condicoes" aria-label="Informações da cotação">
        <div><strong>Forma de pagamento</strong><span>${pagamento}</span></div>
        <div><strong>Destino</strong><span>${destino}</span></div>
      </section>
      ${registrada ? html`<section class="folha__aprovacao">
        <p>Ao dar os vistos abaixo, os responsáveis aprovam a cotação e o fornecedor ou fornecedores indicados. O pedido será feito posteriormente pelo responsável.</p>
        <div class="folha__assinaturas"><div><span></span>Rubrica</div><div><span></span>Visto supervisor</div><div><span></span>Visto síndico</div></div>
      </section>` : ""}
      <footer class="folha__rodape">Menores preços por item e proposta sugerida consideram os dados informados. Confirme equivalência técnica, validade, prazo e condições antes de aprovar.</footer>
    </article>`;
}