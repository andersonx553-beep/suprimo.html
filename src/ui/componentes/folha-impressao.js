// Folha A4 do mapa comparativo para assinatura. Fica escondida na tela e só aparece ao imprimir.
import { html } from "../../lib/html.js";
import { reais, dataBr, hoje, numeroBr } from "../../lib/formato.js";
import { resumirDecisao } from "../../domain/decisao.js";
import { tabelaMapa, avisosDoMapa } from "./tabela-mapa.js";

export function folhaImpressao({ cot, res, forn, ajustes }) {
  const resumo = resumirDecisao(res, cot.decisao);
  const nome = (id) => forn.get(id)?.nome ?? "Fornecedor";
  let decisao = html`<p class="folha__nota">Decisão ainda não registrada. O chefe escolhe e assina abaixo.</p>`;
  if (resumo.completo && cot.decisao.modo === "unico") {
    decisao = html`<p>Fornecedor escolhido: <strong>${nome(resumo.coluna.fornecedorId)}</strong> · custo total <strong>${reais(resumo.custoTotal)}</strong></p>`;
  } else if (resumo.completo) {
    decisao = html`<p>Compra dividida · custo total <strong>${reais(resumo.custoTotal)}</strong> (frete de cada fornecedor incluído)</p>
      <ul>${resumo.divisao.escolhas.map((e) => html`<li>${e.item.descricao} (${numeroBr(e.item.quantidade)} ${e.item.unidade}): ${nome(e.fornecedorId)}, ${reais(e.centavos)} cada</li>`)}</ul>`;
  }
  return html`
    <header class="folha__cab">
      <div><strong>${ajustes.empresa?.nome || "Almoxarifado"}</strong>${ajustes.empresa?.cnpj ? html` · ${ajustes.empresa.cnpj}` : ""}<h1>Mapa comparativo de cotação</h1></div>
      <dl><dt>Cotação</dt><dd>${cot.numero}</dd><dt>Emitido em</dt><dd>${dataBr(hoje())}</dd></dl>
    </header>
    <p class="folha__titulo">${cot.titulo}${cot.exemplo ? " (EXEMPLO)" : ""} · Solicitante: ${cot.solicitante || ajustes.solicitante || "—"}${cot.destino ? html` · Destino: ${cot.destino}` : ""}</p>
    ${avisosDoMapa(res).map((a) => html`<p class="folha__aviso">${a}</p>`)}
    ${res.colunas.length ? tabelaMapa(res, forn) : html`<p class="folha__nota">Nenhuma proposta lançada.</p>`}
    <section class="folha__decisao"><h2>Decisão</h2>${decisao}${cot.decisao?.justificativa ? html`<p><strong>Justificativa:</strong> ${cot.decisao.justificativa}</p>` : ""}</section>
    <section class="folha__assinaturas">
      <div><span></span>Solicitante</div><div><span></span>Chefe do almoxarifado · autorizo a compra</div><div><span></span>Data</div>
    </section>`;
}
