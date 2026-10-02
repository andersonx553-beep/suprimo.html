// Aba "Decisão": vencedor (um só ou por item), justificativa, PDF e registro da resposta do chefe.
import { esc } from "../util.js";
import { icone } from "../icones.js";
import { brl, brlCentavos, dataBr, hojeIso, num } from "../../dominio/formato.js";
import { calcularDivisao, melhorPorItem } from "../../dominio/mapa.js";

export function resumoDecisao({ cot, res, forn }) {
  const d = cot.decisao;
  const nome = (id) => forn.get(id)?.nome ?? "—";
  if (d.modo === "porItem") {
    const div = calcularDivisao(res, d.porItem);
    return { tipo: "porItem", div, total: div.custoTotal, completo: div.faltaEscolher === 0 && div.escolhas.length > 0, nome };
  }
  const col = res.colunas.find((c) => c.propostaId === d.propostaId);
  return { tipo: "unico", col, total: col?.custoTotal ?? 0, completo: !!col, nome };
}

export function renderDecisao(ctx) {
  const { cot, res, forn } = ctx;
  const d = cot.decisao;
  const r = resumoDecisao(ctx);
  const nome = (id) => forn.get(id)?.nome ?? "—";

  const unico = `<div class="escolha">
      <label for="vencedor">Fornecedor vencedor</label>
      <select id="vencedor"><option value="">Escolha…</option>${res.colunas.map((c) =>
        `<option value="${c.propostaId}" ${d.propostaId === c.propostaId ? "selected" : ""}>${esc(nome(c.fornecedorId))} — ${brlCentavos(c.custoTotal)}${c.sugerida ? " (sugerida)" : ""}${c.incompleta ? " (incompleta)" : ""}</option>`).join("")}</select>
      ${res.sugestaoId && d.propostaId !== res.sugestaoId ? `<button class="btn btn-peq" data-acao="usar-sugerida">Usar a sugerida</button>` : ""}
    </div>`;

  const porItem = `<div class="tabela-quadro"><table class="tabela tabela-lista">
    <thead><tr><th>Item</th><th class="num">Qtd</th><th>Fornecedor</th><th class="num">Total</th></tr></thead><tbody>
    ${res.linhas.map(({ item }, i) => {
      const esc1 = r.div?.escolhas.find((e) => e.item.id === item.id);
      return `<tr><td>${esc(item.descricao)}</td><td class="num mono">${num(item.qtd)} ${esc(item.un)}</td>
        <td><select data-item="${item.id}" aria-label="Fornecedor de ${esc(item.descricao)}"><option value="">Escolha…</option>${res.colunas.filter((c) => c.celulas[i].estado === "ok").map((c) =>
          `<option value="${c.propostaId}" ${d.porItem?.[item.id] === c.propostaId ? "selected" : ""}>${esc(nome(c.fornecedorId))} — ${brl(c.celulas[i].preco)}</option>`).join("")}</select></td>
        <td class="num mono">${esc1 ? brlCentavos(esc1.total) : "—"}</td></tr>`;
    }).join("")}</tbody></table></div>
    ${r.div ? `<p class="soma mono">Itens ${brlCentavos(r.div.totalItens)} + frete ${brlCentavos(r.div.totalFrete)}${r.div.fretes.length > 1 ? ` (${r.div.fretes.length} fornecedores)` : ""} = <strong>${brlCentavos(r.div.custoTotal)}</strong></p>` : ""}
    <button class="btn btn-peq" data-acao="melhor-por-item">Usar o menor preço de cada item</button>`;

  const ap = d.aprovacao;
  const carimbo = ap ? `<div class="faixa ${ap.estado === "aprovada" ? "faixa-ok" : "faixa-ruim"}">${icone(ap.estado === "aprovada" ? "ok" : "fechar", 16)}
      <span>${ap.estado === "aprovada" ? "Aprovada" : "Recusada"} em ${dataBr(ap.data)}${ap.por ? " por " + esc(ap.por) : ""}.${ap.motivo ? " Motivo: " + esc(ap.motivo) : ""}</span></div>` : "";

  let registro = "";
  if (cot.status === "Aguardando aprovação") {
    registro = `<fieldset class="registro"><legend>Resposta do chefe</legend>
      <div class="campos"><label>Quem decidiu<input id="ap-por" type="text" placeholder="Nome do chefe"></label>
      <label>Data<input id="ap-data" type="date" value="${hojeIso()}"></label>
      <label class="largo">Motivo (se recusar)<input id="ap-motivo" type="text"></label></div>
      <div class="acoes"><button class="btn btn-ok" data-acao="aprovar">${icone("ok", 16)}Registrar aprovação</button>
      <button class="btn btn-ruim" data-acao="recusar">${icone("fechar", 16)}Registrar recusa</button></div></fieldset>`;
  }

  return `
    ${carimbo}
    <div class="decisao">
      <div class="modo" role="radiogroup" aria-label="Como comprar">
        <label><input type="radio" name="modo" value="unico" ${d.modo !== "porItem" ? "checked" : ""}> Um fornecedor para tudo</label>
        <label><input type="radio" name="modo" value="porItem" ${d.modo === "porItem" ? "checked" : ""}> Dividir por item</label>
      </div>
      ${d.modo === "porItem" ? porItem : unico}
      <p class="soma ${r.completo ? "" : "muted"}">${r.completo ? `Total da compra: <strong class="mono">${brlCentavos(r.total)}</strong>` : "Escolha o vencedor para fechar o total."}</p>
      <label for="justificativa">Justificativa</label>
      <textarea id="justificativa" rows="3" placeholder="Por que esta escolha? Obrigatória se não for a de menor custo ou se houver poucas propostas.">${esc(d.justificativa)}</textarea>
      <div class="acoes">
        <button class="btn" data-acao="imprimir">${icone("imprimir", 16)}Imprimir mapa em PDF</button>
      </div>
      ${registro}
    </div>`;
}

export function ligarDecisao(raiz, ctx) {
  const { cot, res, salvar } = ctx;
  raiz.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", () =>
    salvar((c) => { c.decisao.modo = r.value; c.decisao.porItem ||= {}; })));
  raiz.querySelector("#vencedor")?.addEventListener("change", (e) => salvar((c) => { c.decisao.propostaId = e.target.value; }));
  raiz.querySelector('[data-acao="usar-sugerida"]')?.addEventListener("click", () => salvar((c) => { c.decisao.propostaId = res.sugestaoId; }));
  raiz.querySelectorAll("[data-item]").forEach((s) => s.addEventListener("change", () =>
    salvar((c) => { c.decisao.porItem = { ...c.decisao.porItem, [s.dataset.item]: s.value }; })));
  raiz.querySelector('[data-acao="melhor-por-item"]')?.addEventListener("click", () =>
    salvar((c) => { c.decisao.porItem = melhorPorItem(res); }));
  raiz.querySelector("#justificativa").addEventListener("change", (e) => salvar((c) => { c.decisao.justificativa = e.target.value; }, { redesenhar: false }));
  raiz.querySelector('[data-acao="aprovar"]')?.addEventListener("click", () => ctx.aprovar({
    por: raiz.querySelector("#ap-por").value.trim(), data: raiz.querySelector("#ap-data").value, motivo: "",
  }, true));
  raiz.querySelector('[data-acao="recusar"]')?.addEventListener("click", () => ctx.aprovar({
    por: raiz.querySelector("#ap-por").value.trim(), data: raiz.querySelector("#ap-data").value,
    motivo: raiz.querySelector("#ap-motivo").value.trim(),
  }, false));
}
