// Aba "Decisão": vencedor (um só ou por item), justificativa, mapa para assinatura e conclusão.
import { html } from "../../../lib/html.js";
import { icone } from "../../../lib/icones.js";
import { reais, numeroBr, dataHoraBr } from "../../../lib/formato.js";
import { melhorPorItem } from "../../../domain/mapa.js";
import { resumirDecisao, justificativaObrigatoria, problemasDaDecisao } from "../../../domain/decisao.js";
import { avisar } from "../../componentes/aviso.js";
import { estadoVazio } from "../../componentes/pecas.js";

const decisaoVazia = () => ({ modo: "unico", propostaId: "", porItem: {}, justificativa: "", decididaEm: "" });

export function abaDecisao({ cot, res, forn }) {
  if (!res.colunas.length) {
    return estadoVazio({ icone: "lista", titulo: "Sem propostas para decidir", texto: "A decisão parte do mapa comparativo.",
      acoes: html`<a class="botao botao--primario" href="#/cotacoes/${encodeURIComponent(cot.numero)}/propostas">Lançar proposta</a>` });
  }
  const d = cot.decisao ?? decisaoVazia();
  const resumo = resumirDecisao(res, d);
  const obrigatoria = justificativaObrigatoria(res, d);
  const nome = (id) => forn.get(id)?.nome ?? "Fornecedor removido";
  const travada = cot.status === "decidida" || cot.status === "concluida" || cot.status === "cancelada";
  const sugerida = res.colunas.find((c) => c.sugerida);

  const unico = html`
    <label class="campo-rotulado">Fornecedor vencedor
      <select class="campo" data-vencedor><option value="">Escolha…</option>${res.colunas.map((c) => html`
        <option value="${c.propostaId}" ${d.propostaId === c.propostaId ? "selected" : ""}>${nome(c.fornecedorId)} · ${reais(c.custoTotal)}${c.sugerida ? " (sugerida)" : ""}${c.incompleta ? " (incompleta)" : ""}${c.unidadeDiferente ? " (unidade diferente)" : ""}</option>`)}</select></label>
    ${sugerida && d.propostaId !== sugerida.propostaId ? html`<button class="botao botao--peq" data-usar-sugerida>${icone("trofeu", 14)}Usar a sugerida</button>` : ""}`;

  const porItem = html`
    <div class="tabela-quadro"><table class="tabela tabela--lista"><thead><tr><th>Item</th><th>Fornecedor</th><th>Total</th></tr></thead><tbody>
      ${res.linhas.map(({ item }, i) => {
        const escolha = resumo.divisao?.escolhas.find((e) => e.item.id === item.id);
        return html`<tr><td data-rotulo="Item"><strong>${item.descricao}</strong><small>${numeroBr(item.quantidade)} ${item.unidade}</small></td>
          <td data-rotulo="Fornecedor"><select class="campo" data-item="${item.id}" aria-label="Fornecedor de ${item.descricao}"><option value="">Escolha…</option>
            ${res.colunas.filter((c) => c.celulas[i].estado === "ok").map((c) => html`<option value="${c.propostaId}" ${d.porItem?.[item.id] === c.propostaId ? "selected" : ""}>${nome(c.fornecedorId)} · ${reais(c.celulas[i].centavos)}</option>`)}</select></td>
          <td class="tabela__num" data-rotulo="Total">${escolha ? reais(escolha.total) : "—"}</td></tr>`;
      })}</tbody></table></div>
    ${resumo.divisao?.escolhas.length ? html`<p class="decisao__soma">Itens ${reais(resumo.divisao.totalItens)} + frete ${reais(resumo.divisao.totalFrete)} (${resumo.divisao.fretes.length} ${resumo.divisao.fretes.length === 1 ? "fornecedor" : "fornecedores"}) = <strong>${reais(resumo.divisao.custoTotal)}</strong></p>` : ""}
    <button class="botao botao--peq" data-melhor-por-item>${icone("camadas", 14)}Usar o menor preço de cada item</button>`;

  const decididaBanner = travada && cot.status !== "cancelada" ? html`
    <p class="faixa" data-tom="ok">${icone("ok", 16)}<span>${cot.status === "concluida" ? "Cotação concluída" : "Decisão registrada"}${d.decididaEm ? ` em ${dataHoraBr(d.decididaEm)}` : ""}. Para mudar, reabra a análise.</span></p>` : "";

  return html`
    ${decididaBanner}
    <fieldset class="decisao" ${travada ? "disabled" : ""}>
      <div class="decisao__modo" role="radiogroup" aria-label="Como comprar">
        <label><input type="radio" name="modo" value="unico" ${d.modo !== "porItem" ? "checked" : ""}>Um fornecedor para tudo</label>
        <label><input type="radio" name="modo" value="porItem" ${d.modo === "porItem" ? "checked" : ""}>Um fornecedor por item</label>
      </div>
      ${d.modo === "porItem" ? porItem : unico}
      <p class="decisao__total" data-completo="${String(resumo.completo)}">${resumo.completo ? html`Custo total da compra: <strong>${reais(resumo.custoTotal)}</strong>` : "Escolha o vencedor para fechar o total."}</p>
      <label class="campo-rotulado">Justificativa ${obrigatoria ? html`<span class="selo" data-tom="aviso">Obrigatória: não é o menor custo total</span>` : html`<span class="campo-rotulado__opcional">(opcional)</span>`}
        <textarea class="campo" data-justificativa rows="3" placeholder="Por que esta escolha? Ex.: entrega mais rápida, fornecedor já conhecido, único com todos os itens.">${d.justificativa}</textarea></label>
    </fieldset>
    <div class="acoes-linha acoes-linha--rodape">
      <button class="botao" data-acao="imprimir">${icone("imprimir", 16)}Gerar mapa para assinatura</button>
      <span class="espaco"></span>
      ${cot.status === "decidida" || cot.status === "concluida" ? html`<button class="botao" data-reabrir>Reabrir análise</button>` : ""}
      ${cot.status === "decidida" ? html`<button class="botao botao--primario" data-concluir>${icone("ok", 16)}Marcar como concluída</button>` : ""}
      ${!travada ? html`<button class="botao botao--primario" data-registrar>${icone("ok", 16)}Registrar decisão</button>` : ""}
    </div>`;
}

export function ligarDecisao(raiz, ctx) {
  const { cot, res, store } = ctx;
  const editar = (fn, meta) => store.atualizarCotacao(cot.id, (c) => { c.decisao ??= decisaoVazia(); fn(c); }, meta);

  raiz.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", () => editar((c) => { c.decisao.modo = r.value; })));
  raiz.querySelector("[data-vencedor]")?.addEventListener("change", (e) => editar((c) => { c.decisao.propostaId = e.target.value; }));
  raiz.querySelector("[data-usar-sugerida]")?.addEventListener("click", () => editar((c) => { c.decisao.propostaId = res.sugestaoId; }));
  raiz.querySelectorAll("[data-item]").forEach((s) => s.addEventListener("change", () => editar((c) => { c.decisao.porItem = { ...c.decisao.porItem, [s.dataset.item]: s.value }; })));
  raiz.querySelector("[data-melhor-por-item]")?.addEventListener("click", () => editar((c) => { c.decisao.porItem = melhorPorItem(res); }));
  raiz.querySelector("[data-justificativa]")?.addEventListener("change", (e) => editar((c) => { c.decisao.justificativa = e.target.value; }));

  raiz.querySelector("[data-registrar]")?.addEventListener("click", () => {
    // Lê o que está na tela, caso a justificativa ainda não tenha perdido o foco.
    const texto = raiz.querySelector("[data-justificativa]").value;
    const atual = { ...(cot.decisao ?? decisaoVazia()), justificativa: texto };
    const problemas = problemasDaDecisao(res, atual);
    if (problemas.length) { editar((c) => { c.decisao.justificativa = texto; }); avisar(problemas[0]); return; }
    editar((c) => { c.decisao.justificativa = texto; c.decisao.decididaEm = new Date().toISOString(); c.status = "decidida"; });
    avisar("Decisão registrada. Gere o mapa para o chefe assinar.");
  });
  raiz.querySelector("[data-concluir]")?.addEventListener("click", () => editar((c) => { c.status = "concluida"; c.concluidaEm = new Date().toISOString(); }));
  raiz.querySelector("[data-reabrir]")?.addEventListener("click", () => editar((c) => { c.status = "em_analise"; c.concluidaEm = ""; }));
}
