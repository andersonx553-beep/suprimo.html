// Aba "Mapa comparativo": item por linha, fornecedor por coluna, como o mapa de cotação em papel.
import { esc } from "../util.js";
import { icone } from "../icones.js";
import { brl, brlCentavos, dataBr, num } from "../../dominio/formato.js";

const cnpjMask = (c) => String(c || "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function celula(c, item) {
  if (c.estado === "naoCotou") return `<td class="nao-cotou"><span>não cotou</span></td>`;
  if (c.estado === "unidadeDivergente") {
    return `<td class="un-divergente" title="Pedido em ${esc(item.un)}, cotado em ${esc(c.unidade)}. Não entra na comparação.">
      <span class="valor">${brl(c.preco)}</span><span class="sub">por ${esc(c.unidade)}, pedido em ${esc(item.un)}</span></td>`;
  }
  const alta = c.altaSobreUltimo
    ? `<span class="alta" title="Último preço pago: ${brl(c.altaSobreUltimo.ultimo)}">${icone("alerta", 12)}+${Math.round(c.altaSobreUltimo.percentual * 100)}% s/ último</span>` : "";
  return `<td class="${c.menor ? "menor" : ""}"><span class="valor">${brl(c.preco)}</span><span class="sub">${brlCentavos(c.total)}</span>${alta}</td>`;
}

/** Tabela do mapa. `fornecedores` é um Map id → fornecedor. */
export function tabelaMapa(res, cot, fornecedores) {
  const nome = (id) => fornecedores.get(id)?.nome ?? "Fornecedor removido";
  const cab = res.colunas.map((c) => {
    const selos = [
      c.sugerida ? `<span class="selo selo-sugerida">Sugerida</span>` : "",
      c.incompleta ? `<span class="selo selo-incompleta">Incompleta</span>` : "",
      c.divergentes ? `<span class="selo selo-incompleta">Unidade diferente</span>` : "",
      c.vencida ? `<span class="selo selo-vencida">Vencida</span>` : "",
    ].join("");
    return `<th class="forn ${c.incompleta || c.divergentes ? "fraca" : ""}"><span class="forn-nome">${esc(nome(c.fornecedorId))}</span>
      <span class="forn-cnpj mono">${esc(cnpjMask(fornecedores.get(c.fornecedorId)?.cnpj))}</span><span class="selos">${selos}</span></th>`;
  }).join("");

  const corpo = res.linhas.map(({ item }, i) => `<tr>
      <th class="item" scope="row"><span class="item-desc">${esc(item.descricao)}</span>${item.spec ? `<span class="item-spec">${esc(item.spec)}</span>` : ""}<span class="item-spec mono so-estreito">${num(item.qtd)} ${esc(item.un)}</span></th>
      <td class="qtd mono">${num(item.qtd)} ${esc(item.un)}</td>
      ${res.colunas.map((c) => celula(c.celulas[i], item)).join("")}</tr>`).join("");

  const linhaRodape = (rotulo, fn, cls = "") =>
    `<tr class="${cls}"><th class="item" scope="row" colspan="2">${rotulo}</th>${res.colunas.map((c) => `<td class="${c.vencida && rotulo === "Validade" ? "vencida" : ""}">${fn(c)}</td>`).join("")}</tr>`;

  const rodape = [
    linhaRodape("Subtotal dos itens", (c) => `<span class="mono">${brlCentavos(c.subtotal)}</span>`),
    linhaRodape("Frete", (c) => `<span class="mono">${c.frete ? brlCentavos(c.frete) : "sem frete"}</span>`),
    linhaRodape("Custo total", (c) => `<span class="mono">${brlCentavos(c.custoTotal)}</span>${c.incompleta ? `<span class="sub">faltam itens</span>` : ""}`, "total"),
    linhaRodape("Prazo de entrega", (c) => (c.prazoEntrega != null ? `${c.prazoEntrega} dias` : "—")),
    linhaRodape("Pagamento", (c) => esc(c.pagamento || "—")),
    linhaRodape("Validade", (c) => `${dataBr(c.validade)}${c.vencida ? `<span class="sub">vencida</span>` : ""}`),
  ].join("");

  return `<table class="mapa">
    <thead><tr><th class="item">Item</th><th class="qtd">Qtd</th>${cab}</tr></thead>
    <tbody>${corpo}</tbody><tfoot>${rodape}</tfoot></table>`;
}

export function avisosMapa(res) {
  const a = [];
  if (res.poucasPropostas) a.push(`Só ${res.colunas.length} de ${res.minPropostas} propostas mínimas. Peça mais orçamentos ou justifique na decisão.`);
  const inc = res.colunas.filter((c) => c.incompleta).length;
  if (inc) a.push(`${inc} proposta${inc > 1 ? "s" : ""} sem todos os itens: fora da sugestão de vencedor.`);
  return a;
}

export function renderMapa({ cot, res, forn }) {
  if (!res.colunas.length) {
    return `<div class="vazio"><p>Nenhuma proposta lançada.</p><button class="btn" data-ir="propostas">Lançar propostas</button></div>`;
  }
  const sug = res.colunas.find((c) => c.sugerida);
  const avisos = avisosMapa(res);
  return `
    ${avisos.map((t) => `<div class="faixa faixa-espera">${icone("alerta", 16)}<span>${esc(t)}</span></div>`).join("")}
    <div class="mapa-barra">
      <p class="sugestao">${sug
        ? `Menor custo total entre as propostas completas: <strong>${esc(forn.get(sug.fornecedorId)?.nome)}</strong> <span class="mono">${brlCentavos(sug.custoTotal)}</span>`
        : "Nenhuma proposta completa para sugerir."}</p>
      <div class="acoes">
        <button class="btn" data-acao="imprimir">${icone("imprimir", 16)}Imprimir mapa em PDF</button>
        <button class="btn btn-principal" data-ir="decisao">Decidir</button>
      </div>
    </div>
    <div class="mapa-quadro" tabindex="0" aria-label="Mapa comparativo">${tabelaMapa(res, cot, forn)}</div>
    <p class="legenda"><span class="amostra menor-amostra mono">R$ 0,00</span> menor preço da linha · valores por unidade, total do item embaixo</p>`;
}
