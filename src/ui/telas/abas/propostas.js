// Aba "Propostas": uma por fornecedor, lançada à mão, com o arquivo original ao lado só para consulta.
import { html, montar } from "../../../lib/html.js";
import { icone } from "../../../lib/icones.js";
import { reais, reaisCampo, numeroBr, percentualBr } from "../../../lib/formato.js";
import { lerCentavos, totalLinha } from "../../../domain/dinheiro.js";
import { chaveItem } from "../../../domain/mapa.js";
import { novoId } from "../../../state/store.js";
import { avisar } from "../../componentes/aviso.js";
import { avatar, estadoVazio } from "../../componentes/pecas.js";

// Proposta aberta em cada cotação (só nesta sessão do navegador).
const selecionada = new Map();

function alertaAlta(centavos, ultimo) {
  if (!ultimo || centavos == null || centavos <= ultimo.centavos * 1.15) return html``;
  return html`<span class="linha-preco__alta">${icone("alerta", 12)}+${percentualBr(centavos / ultimo.centavos - 1)} sobre o último pago</span>`;
}

export function abaPropostas({ cot, forn, ultimo }) {
  const bloqueada = cot.status === "concluida" || cot.status === "cancelada";
  const semProposta = cot.convites.filter((v) => forn.get(v.fornecedorId) && !cot.propostas.some((p) => p.fornecedorId === v.fornecedorId));
  const atual = cot.propostas.find((p) => p.id === selecionada.get(cot.id)) ?? cot.propostas[0] ?? null;
  if (atual) selecionada.set(cot.id, atual.id);

  const seletor = html`
    <div class="seletor-proposta" role="tablist" aria-label="Propostas">
      ${cot.propostas.map((p) => html`<button class="seletor-proposta__item" role="tab" aria-selected="${String(p.id === atual?.id)}" data-escolher="${p.id}">${avatar(forn.get(p.fornecedorId)?.nome ?? "?")}<span>${forn.get(p.fornecedorId)?.nome ?? "Fornecedor removido"}</span></button>`)}
      ${semProposta.length && !bloqueada ? html`<label class="seletor-proposta__novo"><span class="sr-only">Lançar proposta de</span>
        <select class="campo" data-nova-proposta><option value="">Lançar proposta de…</option>${semProposta.map((v) => html`<option value="${v.fornecedorId}">${forn.get(v.fornecedorId).nome}</option>`)}</select></label>` : ""}
    </div>`;

  if (!cot.convites.length || !cot.itens.length) {
    return html`${estadoVazio({ icone: "lista", titulo: !cot.itens.length ? "Falta definir os itens" : "Falta convidar fornecedores",
      texto: !cot.itens.length ? "As propostas são lançadas item por item." : "A proposta é sempre de um fornecedor convidado.",
      acoes: html`<a class="botao botao--primario" href="#/cotacoes/${encodeURIComponent(cot.numero)}/${!cot.itens.length ? "itens" : "fornecedores"}">${!cot.itens.length ? "Adicionar itens" : "Convidar fornecedores"}</a>` })}`;
  }
  if (!atual) {
    return html`${seletor}${estadoVazio({ icone: "lista", titulo: "Nenhuma proposta lançada", texto: "Escolha o fornecedor acima e lance preço por item, frete, prazo, pagamento e validade.", acoes: "" })}`;
  }

  const linhas = cot.itens.map((item, n) => {
    const e = atual.precos[item.id];
    const u = ultimo.get(chaveItem(item.descricao));
    return html`
      <tr data-item="${item.id}">
        <td data-rotulo="Item"><strong>${item.descricao}</strong><small>${numeroBr(item.quantidade)} ${item.unidade}${u ? html` · último pago ${reais(u.centavos)}` : ""}</small></td>
        <td data-rotulo="Preço unitário (R$)"><input class="campo campo--num" data-campo="preco" inputmode="decimal" placeholder="não cotou" value="${reaisCampo(e?.centavos)}" aria-label="Preço unitário de ${item.descricao}"></td>
        <td data-rotulo="Unidade cotada"><input class="campo campo--un" data-campo="unidade" list="lista-unidades" value="${e?.unidade || item.unidade}" aria-label="Unidade cotada de ${item.descricao}"></td>
        <td class="tabela__num" data-rotulo="Total" data-total>${e ? reais(totalLinha(e.centavos, item.quantidade)) : "—"}<span data-alerta>${alertaAlta(e?.centavos, u)}</span></td>
      </tr>`;
  });

  return html`
    <fieldset class="painel__campos" ${bloqueada ? "disabled" : ""}>
      ${seletor}
      <div class="propostas">
        <div class="propostas__form" data-proposta="${atual.id}">
          <div class="tabela-quadro"><table class="tabela tabela--lista tabela--proposta"><thead><tr><th>Item</th><th>Preço unitário</th><th>Un.</th><th>Total</th></tr></thead><tbody>${linhas}</tbody></table></div>
          <div class="formulario__grade">
            <label class="campo-rotulado">Frete (R$)<input class="campo campo--num" data-campo="frete" inputmode="decimal" value="${reaisCampo(atual.freteCentavos || null)}" placeholder="0,00"></label>
            <label class="campo-rotulado">Prazo de entrega (dias)<input class="campo campo--num" data-campo="prazoEntregaDias" type="number" min="0" value="${atual.prazoEntregaDias ?? ""}"></label>
            <label class="campo-rotulado">Validade da proposta<input class="campo" data-campo="validade" type="date" value="${atual.validade}"></label>
          </div>
          <div class="formulario__grade formulario__grade--2">
            <label class="campo-rotulado">Pagamento<input class="campo" data-campo="pagamentoTexto" value="${atual.pagamento?.texto ?? ""}" placeholder="Boleto, à vista, cartão…"></label>
            <label class="campo-rotulado">Prazo de pagamento (dias)<input class="campo campo--num" data-campo="pagamentoDias" type="number" min="0" value="${atual.pagamento?.dias ?? ""}"></label>
          </div>
          <label class="campo-rotulado">Observação<textarea class="campo" data-campo="observacao" rows="2">${atual.observacao}</textarea></label>
          <div class="acoes-linha"><button class="botao botao--perigo" data-remover-proposta>${icone("lixeira", 16)}Remover esta proposta</button></div>
        </div>
        <aside class="propostas__arquivo" aria-label="Arquivo original da proposta">
          <div class="propostas__arquivo-cab"><h3>Arquivo original</h3>
            <label class="botao botao--peq">${icone("anexo", 15)}Anexar PDF ou imagem<input type="file" hidden accept="application/pdf,image/*" data-anexar></label></div>
          <div class="anexos" data-anexos>${(atual.anexos ?? []).map((a) => html`<button class="anexos__item" data-ver="${a.id}">${icone("arquivo", 14)}${a.nome}</button>`)}</div>
          <div class="visualizador" data-visualizador>${atual.anexos?.length ? html`<p class="visualizador__vazio">Escolha um arquivo para abrir aqui ao lado.</p>` : html`<p class="visualizador__vazio">Sem arquivo anexado. Anexe o PDF ou a foto que o fornecedor mandou para conferir enquanto lança.</p>`}</div>
        </aside>
      </div>
    </fieldset>`;
}

export function ligarPropostas(raiz, ctx) {
  const { cot, forn, ultimo, store } = ctx;
  const editar = (fn, meta) => store.atualizarCotacao(cot.id, fn, meta);
  const atualId = selecionada.get(cot.id);

  raiz.querySelectorAll("[data-escolher]").forEach((b) => b.addEventListener("click", () => { selecionada.set(cot.id, b.dataset.escolher); store.atualizarCotacao(cot.id, () => {}); }));
  raiz.querySelector("[data-nova-proposta]")?.addEventListener("change", (e) => {
    if (!e.target.value) return;
    const id = novoId();
    selecionada.set(cot.id, id);
    editar((c) => {
      c.propostas.push({ id, fornecedorId: e.target.value, precos: {}, freteCentavos: 0, prazoEntregaDias: null, pagamento: { texto: "", dias: null }, validade: "", observacao: "", anexos: [] });
      const v = c.convites.find((x) => x.fornecedorId === e.target.value);
      if (v && (v.situacao === "nao_enviado" || v.situacao === "enviado")) v.situacao = "respondeu";
    });
  });
  const form = raiz.querySelector("[data-proposta]");
  if (!form) return;

  form.querySelector("[data-remover-proposta]").addEventListener("click", () => {
    const p = cot.propostas.find((x) => x.id === atualId);
    p.anexos?.forEach((a) => store.apagarAnexo(a.id));
    editar((c) => {
      c.propostas = c.propostas.filter((x) => x.id !== atualId);
      if (c.decisao?.propostaId === atualId) c.decisao.propostaId = "";
      for (const k of Object.keys(c.decisao?.porItem ?? {})) if (c.decisao.porItem[k] === atualId) delete c.decisao.porItem[k];
    });
    selecionada.delete(cot.id);
  });

  form.querySelectorAll("[data-campo]").forEach((el) => el.addEventListener("change", () => {
    const campo = el.dataset.campo, tr = el.closest("tr[data-item]");
    if (tr) {
      const item = cot.itens.find((i) => i.id === tr.dataset.item);
      const pr = tr.querySelector('[data-campo="preco"]'), un = tr.querySelector('[data-campo="unidade"]');
      const centavos = lerCentavos(pr.value);
      if (campo === "preco" && pr.value.trim() && centavos == null) { avisar("Preço inválido. Use o formato 18,90."); pr.focus(); return; }
      editar((c) => {
        const p = c.propostas.find((x) => x.id === atualId);
        if (centavos == null) delete p.precos[item.id];
        else p.precos[item.id] = { centavos, ...(un.value.trim() && un.value.trim() !== item.unidade ? { unidade: un.value.trim() } : {}) };
      }, { silencioso: true });
      pr.value = reaisCampo(centavos);
      tr.querySelector("[data-total]").firstChild.textContent = centavos == null ? "—" : reais(totalLinha(centavos, item.quantidade));
      montar(tr.querySelector("[data-alerta]"), alertaAlta(centavos, ultimo.get(chaveItem(item.descricao))));
      return;
    }
    editar((c) => {
      const p = c.propostas.find((x) => x.id === atualId);
      if (campo === "frete") { const v = lerCentavos(el.value); p.freteCentavos = v ?? 0; el.value = reaisCampo(v); }
      else if (campo === "prazoEntregaDias") p.prazoEntregaDias = el.value === "" ? null : Math.max(0, Number(el.value));
      else if (campo === "pagamentoTexto") p.pagamento = { ...p.pagamento, texto: el.value.trim() };
      else if (campo === "pagamentoDias") p.pagamento = { ...p.pagamento, dias: el.value === "" ? null : Math.max(0, Number(el.value)) };
      else p[campo] = el.value;
    }, { silencioso: true });
  }));

  // Arquivo original: fica no IndexedDB, só para consulta ao lado do formulário.
  const visualizador = raiz.querySelector("[data-visualizador]");
  let urlAtual = null;
  const abrirAnexo = async (id) => {
    const anexo = cot.propostas.find((p) => p.id === atualId).anexos.find((a) => a.id === id);
    const blob = await store.lerAnexo(id);
    if (!blob) { avisar("Arquivo não encontrado neste navegador."); return; }
    if (urlAtual) URL.revokeObjectURL(urlAtual);
    urlAtual = URL.createObjectURL(blob);
    montar(visualizador, anexo.tipo.startsWith("image/")
      ? html`<img src="${urlAtual}" alt="${anexo.nome}">`
      : html`<iframe src="${urlAtual}" title="${anexo.nome}"></iframe>`);
  };
  raiz.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => abrirAnexo(b.dataset.ver)));
  form.parentElement.querySelector("[data-anexar]").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (arquivo.size > 25 * 1024 * 1024) { avisar("Arquivo grande demais (limite de 25 MB)."); return; }
    try {
      const meta = await store.salvarAnexo(arquivo);
      editar((c) => { c.propostas.find((x) => x.id === atualId).anexos.push(meta); });
    } catch { avisar("Não foi possível guardar o arquivo neste navegador."); }
  });
  const primeiro = cot.propostas.find((p) => p.id === atualId)?.anexos?.[0];
  if (primeiro) abrirAnexo(primeiro.id);
  return () => { if (urlAtual) URL.revokeObjectURL(urlAtual); };
}
