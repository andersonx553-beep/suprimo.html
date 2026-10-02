// Folha do mapa para imprimir/PDF: cabeçalho da empresa, mapa, decisão e espaço para a assinatura do chefe.
import { esc } from "./util.js";
import { tabelaMapa, avisosMapa } from "./abas/mapa.js";
import { resumoDecisao } from "./abas/decisao.js";
import { brlCentavos, dataBr, hojeIso, num } from "../dominio/formato.js";

export function renderFolha(ctx) {
  const { cot, res, forn, ajustes } = ctx;
  const r = resumoDecisao(ctx);
  const d = cot.decisao;
  let decisao = `<p class="muted">Decisão ainda não registrada.</p>`;
  if (r.completo && r.tipo === "unico") {
    decisao = `<p>Fornecedor escolhido: <strong>${esc(r.nome(r.col.fornecedorId))}</strong> · custo total <strong class="mono">${brlCentavos(r.total)}</strong></p>`;
  } else if (r.completo) {
    decisao = `<p>Compra dividida · custo total <strong class="mono">${brlCentavos(r.total)}</strong></p>
      <ul>${r.div.escolhas.map((e) => `<li>${esc(e.item.descricao)} (${num(e.item.qtd)} ${esc(e.item.un)}): ${esc(r.nome(e.fornecedorId))}</li>`).join("")}</ul>`;
  }
  return `
    <header class="folha-cab">
      <div><strong>${esc(ajustes.empresa?.nome || "Almoxarifado")}</strong>${ajustes.empresa?.cnpj ? `<span class="mono"> · ${esc(ajustes.empresa.cnpj)}</span>` : ""}
        <h1>Mapa comparativo de cotação</h1></div>
      <dl><dt>Cotação</dt><dd class="mono">${esc(cot.numero)}</dd><dt>Emitido em</dt><dd class="mono">${dataBr(hojeIso())}</dd></dl>
    </header>
    <p class="folha-titulo">${esc(cot.titulo)}${cot.exemplo ? " (EXEMPLO)" : ""} · Solicitante: ${esc(cot.solicitante || ajustes.solicitante || "—")}</p>
    ${avisosMapa(res).map((a) => `<p class="folha-aviso">${esc(a)}</p>`).join("")}
    ${res.colunas.length ? tabelaMapa(res, cot, forn) : ""}
    <section class="folha-decisao"><h2>Decisão</h2>${decisao}
      ${d.justificativa ? `<p><strong>Justificativa:</strong> ${esc(d.justificativa)}</p>` : ""}</section>
    <section class="assinaturas">
      <div><span></span>Solicitante</div>
      <div><span></span>Chefe do almoxarifado · autorizo a compra</div>
      <div class="data"><span></span>Data</div>
    </section>`;
}
