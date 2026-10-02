// Aba "Propostas": planilha item × fornecedor para lançar preço, frete, prazo, pagamento e validade.
import { esc } from "../util.js";
import { icone } from "../icones.js";
import { lerNumero, brl, num } from "../../dominio/formato.js";
import { chaveItem } from "../../dominio/mapa.js";
import { anexos } from "../../dados/anexos.js";

const valor = (n) => (n == null || n === "" ? "" : Number(n).toFixed(2).replace(".", ","));

export function renderPropostas({ cot, forn, ultimo }) {
  if (!cot.propostas.length) {
    var vazio = `<p class="vazio-linha">Nenhuma proposta. Adicione a de um fornecedor convidado.</p>`;
  }
  const cab = cot.propostas.map((p) => `<th class="forn"><span class="forn-nome">${esc(forn.get(p.fornecedorId)?.nome ?? "—")}</span>
      <button class="btn-icone btn-icone-peq" data-remover-proposta="${p.id}" aria-label="Remover proposta">${icone("fechar", 14)}</button></th>`).join("");

  const corpo = cot.itens.map((i) => {
    const ref = ultimo[chaveItem(i)];
    return `<tr><th class="item" scope="row"><span class="item-desc">${esc(i.descricao)}</span>
      <span class="item-spec mono">${num(i.qtd)} ${esc(i.un)}${ref ? ` · último pago ${brl(ref)}` : ""}</span></th>
      ${cot.propostas.map((p) => {
        const e = p.precos[i.id] || {};
        const alta = ref && e.preco > ref * 1.15;
        return `<td class="entrada ${alta ? "alta-linha" : ""}"><div class="par">
          <input class="preco mono" inputmode="decimal" placeholder="não cotou" data-p="${p.id}" data-i="${i.id}" data-campo="preco" value="${valor(e.preco)}" aria-label="Preço unitário de ${esc(i.descricao)}">
          <input class="un mono" data-p="${p.id}" data-i="${i.id}" data-campo="un" value="${esc(e.un || i.un)}" aria-label="Unidade cotada"></div>
          ${alta ? `<span class="alta" data-alta>${icone("alerta", 12)}+${Math.round((e.preco / ref - 1) * 100)}% s/ último</span>` : ""}</td>`;
      }).join("")}</tr>`;
  }).join("");

  const campo = (rotulo, f, tipo = "text", extra = "") => `<tr><th class="item" scope="row">${rotulo}</th>${cot.propostas.map((p) =>
    `<td class="entrada"><input class="${tipo === "text" ? "" : "mono"}" type="${tipo}" ${extra} data-p="${p.id}" data-campo="${f}" value="${esc(f === "frete" ? valor(p[f]) : p[f] ?? "")}" aria-label="${rotulo}"></td>`).join("")}</tr>`;

  const anexosLinha = `<tr><th class="item" scope="row">Arquivo original</th>${cot.propostas.map((p) => `<td class="entrada anexos">
      ${(p.anexos || []).map((a) => `<span class="anexo"><a href="#" data-abrir-anexo="${a.id}">${icone("arquivo", 14)}${esc(a.nome)}</a>
        <button class="btn-icone btn-icone-peq" data-remover-anexo="${a.id}" data-p="${p.id}" aria-label="Remover arquivo">${icone("fechar", 12)}</button></span>`).join("")}
      <label class="btn btn-peq">${icone("clipe", 14)}Anexar<input type="file" hidden accept="application/pdf,image/*" data-anexar="${p.id}"></label></td>`).join("")}</tr>`;

  const sem = [...forn.values()].filter((f) => !cot.propostas.some((p) => p.fornecedorId === f.id) && cot.convites.some((c) => c.fornecedorId === f.id));
  return `
    ${vazio || ""}
    ${cot.propostas.length ? `<div class="mapa-quadro" tabindex="0"><table class="mapa entrada-tabela">
      <thead><tr><th class="item">Item (preço unitário)</th>${cab}</tr></thead>
      <tbody>${corpo}</tbody>
      <tfoot>${campo("Frete (R$)", "frete", "text", 'inputmode="decimal"')}${campo("Prazo de entrega (dias)", "prazoEntrega", "number", 'min="0"')}${campo("Pagamento", "pagamento")}${campo("Validade", "validade", "date")}${anexosLinha}</tfoot></table></div>` : ""}
    <div class="linha-acao">
      ${sem.length ? `<select id="nova-proposta" aria-label="Fornecedor da proposta">${sem.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join("")}</select>
        <button class="btn" data-acao="nova-proposta">${icone("mais", 16)}Adicionar proposta</button>` : `<span class="muted">Só fornecedores convidados podem ter proposta.</span>`}
    </div>`;
}

export function ligarPropostas(raiz, { cot, salvar, ultimo }) {
  raiz.querySelector('[data-acao="nova-proposta"]')?.addEventListener("click", () => {
    const id = raiz.querySelector("#nova-proposta").value;
    salvar((c) => {
      c.propostas.push({ id: "pr-" + Math.random().toString(36).slice(2, 8), fornecedorId: id, precos: {}, frete: null, prazoEntrega: null, pagamento: "", validade: "", anexos: [] });
      const v = c.convites.find((x) => x.fornecedorId === id); if (v) v.respondeu = true;
    });
  });
  raiz.querySelectorAll("[data-remover-proposta]").forEach((b) => b.addEventListener("click", () =>
    salvar((c) => { c.propostas = c.propostas.filter((p) => p.id !== b.dataset.removerProposta); })));

  // Edição na própria célula: grava sem redesenhar para não perder o foco ao tabular.
  raiz.querySelectorAll("input[data-campo]").forEach((el) => el.addEventListener("change", () => {
    salvar((c) => {
      const p = c.propostas.find((x) => x.id === el.dataset.p);
      const { campo, i } = el.dataset;
      if (i) {
        const e = (p.precos[i] ||= {});
        if (campo === "preco") { const n = lerNumero(el.value); if (n == null) delete p.precos[i]; else e.preco = n; }
        else e.un = el.value.trim();
        if (p.precos[i] && p.precos[i].preco == null) delete p.precos[i];
      } else if (campo === "frete") p.frete = lerNumero(el.value);
      else if (campo === "prazoEntrega") p.prazoEntrega = el.value === "" ? null : Number(el.value);
      else p[campo] = el.value;
    }, { redesenhar: false });
    if (el.dataset.campo === "preco") {
      const item = cot.itens.find((x) => x.id === el.dataset.i);
      const ref = ultimo[chaveItem(item)];
      const n = lerNumero(el.value);
      const td = el.closest("td");
      const alta = ref && n != null && n > ref * 1.15;
      td.classList.toggle("alta-linha", !!alta);
      td.querySelector("[data-alta]")?.remove();
      if (alta) td.insertAdjacentHTML("beforeend", `<span class="alta" data-alta>${icone("alerta", 12)}+${Math.round((n / ref - 1) * 100)}% s/ último</span>`);
    }
  }));

  raiz.querySelectorAll("[data-anexar]").forEach((el) => el.addEventListener("change", async () => {
    const arquivo = el.files[0]; if (!arquivo) return;
    const meta = await anexos.salvar(arquivo);
    salvar((c) => { c.propostas.find((p) => p.id === el.dataset.anexar).anexos.push(meta); });
  }));
  raiz.querySelectorAll("[data-abrir-anexo]").forEach((a) => a.addEventListener("click", async (e) => {
    e.preventDefault();
    const blob = await anexos.obter(a.dataset.abrirAnexo);
    if (blob) window.open(URL.createObjectURL(blob), "_blank");
  }));
  raiz.querySelectorAll("[data-remover-anexo]").forEach((b) => b.addEventListener("click", async () => {
    await anexos.remover(b.dataset.removerAnexo);
    salvar((c) => { const p = c.propostas.find((x) => x.id === b.dataset.p); p.anexos = p.anexos.filter((a) => a.id !== b.dataset.removerAnexo); });
  }));
}
