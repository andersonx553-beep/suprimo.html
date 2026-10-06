import { html, montar } from "../../../lib/html.js";
import { icone } from "../../../lib/icones.js";
import { numeroBr } from "../../../lib/formato.js";
import { lerListaColada } from "../../../domain/lista-colada.js";
import { CATALOGO, UNIDADES } from "../../../data/catalogo.js";
import { semAcento } from "../../../domain/mapa.js";
import { novoId } from "../../../state/store.js";
import { abrirDialogo } from "../../componentes/dialogo.js";
import { avisar } from "../../componentes/aviso.js";
import { estadoVazio } from "../../componentes/pecas.js";

const lerNumero = (t) => { const n = Number(String(t).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const novoItem = (d) => ({ id: novoId(), descricao: d.descricao.trim(), quantidade: d.quantidade ?? 1, unidade: d.unidade || "un", especificacao: d.especificacao || "" });

export function abaItens({ cot }) {
  const linhas = cot.itens.map((i, n) => html`
    <tr data-item="${i.id}">
      <td class="tabela__num" data-rotulo="#">${n + 1}</td>
      <td data-rotulo="Descrição"><input class="campo" data-campo="descricao" value="${i.descricao}" aria-label="Descrição do item ${n + 1}"></td>
      <td data-rotulo="Qtd."><input class="campo campo--num" data-campo="quantidade" inputmode="decimal" value="${numeroBr(i.quantidade)}" aria-label="Quantidade do item ${n + 1}"></td>
      <td data-rotulo="Un."><input class="campo campo--un" data-campo="unidade" list="lista-unidades" value="${i.unidade}" aria-label="Unidade do item ${n + 1}"></td>
      <td data-rotulo="Especificação"><input class="campo" data-campo="especificacao" value="${i.especificacao}" aria-label="Especificação do item ${n + 1}" placeholder="Marca, norma, medida…"></td>
      <td class="tabela__acao"><button class="botao-icone" data-remover="${i.id}" aria-label="Remover ${i.descricao}">${icone("lixeira", 16)}</button></td>
    </tr>`);
  return html`
    <fieldset class="painel__campos" ${cot.status === "concluida" || cot.status === "cancelada" ? "disabled" : ""}>
      <div class="acoes-linha">
        <button class="botao" data-acao="catalogo">${icone("pacote", 16)}Escolher do catálogo</button>
        <button class="botao" data-acao="colar">${icone("lista", 16)}Colar lista</button>
      </div>
      ${cot.itens.length ? html`
        <div class="tabela-quadro"><table class="tabela tabela--lista tabela--itens"><thead><tr><th class="tabela__num">#</th><th>Descrição</th><th>Qtd.</th><th>Un.</th><th>Especificação</th><th></th></tr></thead>
          <tbody>${linhas}</tbody></table></div>`
        : estadoVazio({ icone: "lista", titulo: "Nenhum item ainda", texto: "Digite abaixo, escolha do catálogo do almoxarifado ou cole a lista inteira. Já tem o orçamento em PDF ou imagem? Importe: os itens vêm dele.", acoes: html`<a class="botao" href="#/cotacoes/${encodeURIComponent(cot.numero)}/importar">Importar orçamento</a>` })}
      <form class="novo-item" data-form="novo-item" autocomplete="off">
        <label class="campo-rotulado novo-item__desc">Descrição<input class="campo" name="descricao" list="lista-catalogo" required placeholder="Digite ou escolha do catálogo"></label>
        <label class="campo-rotulado">Qtd.<input class="campo campo--num" name="quantidade" inputmode="decimal" value="1" required></label>
        <label class="campo-rotulado">Un.<input class="campo campo--un" name="unidade" list="lista-unidades" value="un" required></label>
        <label class="campo-rotulado novo-item__spec">Especificação<input class="campo" name="especificacao"></label>
        <button class="botao botao--primario">${icone("mais", 16)}Adicionar item</button>
      </form>
      <datalist id="lista-catalogo">${CATALOGO.map((c) => html`<option value="${c.descricao}">${c.unidade} · ${c.categoria}</option>`)}</datalist>
      <datalist id="lista-unidades">${UNIDADES.map((u) => html`<option value="${u}"></option>`)}</datalist>
    </fieldset>`;
}

export function ligarItens(raiz, { cot, store }) {
  const editar = (fn, meta) => store.atualizarCotacao(cot.id, fn, meta);

  raiz.querySelectorAll("tr[data-item] input").forEach((el) => el.addEventListener("change", () => {
    const id = el.closest("tr").dataset.item;
    editar((c) => {
      const item = c.itens.find((i) => i.id === id);
      if (el.dataset.campo === "quantidade") { const n = lerNumero(el.value); if (n) item.quantidade = n; }
      else if (el.dataset.campo === "descricao" && !el.value.trim()) return;
      else item[el.dataset.campo] = el.value.trim();
    }, { silencioso: true });
    if (el.dataset.campo === "quantidade") el.value = numeroBr(cot.itens.find((i) => i.id === id).quantidade);
  }));
  raiz.querySelectorAll("[data-remover]").forEach((b) => b.addEventListener("click", () => editar((c) => {
    c.itens = c.itens.filter((i) => i.id !== b.dataset.remover);
    c.propostas.forEach((p) => { delete p.precos[b.dataset.remover]; });
    if (c.decisao) delete c.decisao.porItem?.[b.dataset.remover];
  })));

  const form = raiz.querySelector('[data-form="novo-item"]');
  form.descricao.addEventListener("change", () => {
    const c = CATALOGO.find((x) => x.descricao === form.descricao.value);
    if (c) { form.unidade.value = c.unidade; form.quantidade.select(); }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = lerNumero(form.quantidade.value);
    if (!q) { avisar("Informe uma quantidade maior que zero."); form.quantidade.focus(); return; }
    editar((c) => c.itens.push(novoItem({ descricao: form.descricao.value, quantidade: q, unidade: form.unidade.value.trim(), especificacao: form.especificacao.value.trim() })));
  });

  raiz.querySelector('[data-acao="catalogo"]').addEventListener("click", () => dialogoCatalogo((itens) => {
    editar((c) => c.itens.push(...itens.map(novoItem)));
    avisar(`${itens.length} ${itens.length === 1 ? "item incluído" : "itens incluídos"}. Ajuste as quantidades.`);
  }));
  raiz.querySelector('[data-acao="colar"]').addEventListener("click", () => dialogoColar((itens) => {
    editar((c) => c.itens.push(...itens.map(novoItem)));
  }));
}

function dialogoCatalogo(aoIncluir) {
  const categorias = [...new Set(CATALOGO.map((c) => c.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const marcados = new Set();
  abrirDialogo({
    titulo: "Catálogo do almoxarifado", subtitulo: "Marque os itens e inclua de uma vez. A quantidade você ajusta depois.", largo: true,
    corpo: html`
      <label class="campo-rotulado">Filtrar<input class="campo" id="cat-filtro" type="search" placeholder="cimento, tomada, luva…" autocomplete="off"></label>
      <div class="catalogo" id="cat-lista">${categorias.map((cat) => html`
        <section data-cat="${cat}"><h3 class="catalogo__titulo">${cat}</h3>
          ${CATALOGO.map((c, i) => ({ c, i })).filter(({ c }) => c.categoria === cat).map(({ c, i }) => html`
            <label class="catalogo__linha" data-busca="${semAcento(c.descricao).toLowerCase()}"><input type="checkbox" value="${i}"><span>${c.descricao}</span><small>${c.unidade}</small></label>`)}
        </section>`)}</div>`,
    rodape: html`<span class="dialogo__contador" id="cat-n">0 selecionados</span><button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-ok disabled>${icone("mais", 16)}Incluir na cotação</button>`,
    aoAbrir: (dlg) => {
      const n = dlg.querySelector("#cat-n"), ok = dlg.querySelector("[data-ok]");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      dlg.querySelector("#cat-filtro").addEventListener("input", (e) => {
        const termos = semAcento(e.target.value).toLowerCase().split(/\s+/).filter(Boolean);
        dlg.querySelectorAll(".catalogo__linha").forEach((l) => { l.hidden = !termos.every((t) => l.dataset.busca.includes(t)); });
        dlg.querySelectorAll("[data-cat]").forEach((s) => { s.hidden = ![...s.querySelectorAll(".catalogo__linha")].some((l) => !l.hidden); });
      });
      dlg.querySelector("#cat-lista").addEventListener("change", (e) => {
        e.target.checked ? marcados.add(+e.target.value) : marcados.delete(+e.target.value);
        n.textContent = `${marcados.size} ${marcados.size === 1 ? "selecionado" : "selecionados"}`; ok.disabled = !marcados.size;
      });
      ok.addEventListener("click", () => { aoIncluir([...marcados].map((i) => ({ descricao: CATALOGO[i].descricao, unidade: CATALOGO[i].unidade }))); dlg.close(); });
      dlg.querySelector("#cat-filtro").focus();
    },
  });
}

function dialogoColar(aoInserir) {
  let lidos = [];
  abrirDialogo({
    titulo: "Colar lista de itens", subtitulo: "Uma linha por item. Ex.: 20 tomada 20A · 100 m cabo 2,5 mm² · cimento CP II 50kg - 30 sc", largo: true,
    corpo: html`<label class="campo-rotulado">Lista<textarea class="campo" id="col-texto" rows="6" placeholder="20 tomada 20A&#10;100 m cabo 2,5 mm²&#10;cimento CP II 50kg - 30 sc"></textarea></label>
      <div id="col-previa" class="previa"></div>`,
    rodape: html`<button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-ok disabled>Inserir itens</button>`,
    aoAbrir: (dlg) => {
      const previa = dlg.querySelector("#col-previa"), ok = dlg.querySelector("[data-ok]");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      const desenhar = () => {
        ok.disabled = !lidos.length;
        ok.textContent = lidos.length ? `Inserir ${lidos.length} ${lidos.length === 1 ? "item" : "itens"}` : "Inserir itens";
        montar(previa, lidos.length ? html`
          <p class="previa__titulo">Confira antes de inserir. Dá para corrigir aqui.</p>
          <div class="tabela-quadro"><table class="tabela"><thead><tr><th>Qtd.</th><th>Un.</th><th>Descrição</th><th></th></tr></thead><tbody>
            ${lidos.map((l, i) => html`<tr data-conferir="${l.conferir}" data-i="${i}">
              <td><input class="campo campo--num" data-c="quantidade" value="${numeroBr(l.quantidade)}" aria-label="Quantidade da linha ${i + 1}"></td>
              <td><input class="campo campo--un" data-c="unidade" list="lista-unidades" value="${l.unidade}" aria-label="Unidade da linha ${i + 1}"></td>
              <td><input class="campo" data-c="descricao" value="${l.descricao}" aria-label="Descrição da linha ${i + 1}">${l.conferir ? html`<small class="previa__conferir">Sem quantidade: confira.</small>` : ""}</td>
              <td><button class="botao-icone" data-tirar="${i}" aria-label="Tirar linha ${i + 1}">${icone("fechar", 14)}</button></td></tr>`)}
          </tbody></table></div>` : html``);
      };
      dlg.querySelector("#col-texto").addEventListener("input", (e) => { lidos = lerListaColada(e.target.value); desenhar(); });
      previa.addEventListener("change", (e) => {
        const i = +e.target.closest("tr").dataset.i, c = e.target.dataset.c;
        if (c === "quantidade") { const n = lerNumero(e.target.value); if (n) lidos[i].quantidade = n; e.target.value = numeroBr(lidos[i].quantidade); }
        else lidos[i][c] = e.target.value.trim();
      });
      previa.addEventListener("click", (e) => { const b = e.target.closest("[data-tirar]"); if (b) { lidos.splice(+b.dataset.tirar, 1); desenhar(); } });
      ok.addEventListener("click", () => { aoInserir(lidos.filter((l) => l.descricao)); dlg.close(); });
      dlg.querySelector("#col-texto").focus();
    },
  });
}
