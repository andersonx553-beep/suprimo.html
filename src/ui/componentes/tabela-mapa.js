// Tabela do mapa comparativo: item por linha, fornecedor por coluna. Serve a aba Mapa e a folha de impressão.
import { html } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { reais, numeroBr, dataBr, percentualBr } from "../../lib/formato.js";
import { cnpjMascara } from "../../domain/cnpj.js";

function celula(c, item) {
  if (c.estado === "naoCotou") return html`<td class="mapa__celula" data-estado="nao-cotou"><span class="mapa__vazio">não cotou</span></td>`;
  if (c.estado === "unidadeDivergente") {
    return html`<td class="mapa__celula" data-estado="unidade" title="Pedido em ${item.unidade}, cotado em ${c.unidade}. Fora da comparação.">
      <span class="mapa__preco">${reais(c.centavos)}</span><span class="mapa__sub">por ${c.unidade}; pedido em ${item.unidade}</span></td>`;
  }
  const alta = c.altaSobreUltimo
    ? html`<span class="mapa__alta" title="Último preço pago: ${reais(c.altaSobreUltimo.ultimo)}">${icone("alerta", 12)}+${percentualBr(c.altaSobreUltimo.fracao)} s/ último</span>` : "";
  return html`<td class="mapa__celula" data-estado="${c.menor ? "menor" : "ok"}"><span class="mapa__preco">${reais(c.centavos)}</span><span class="mapa__sub">${reais(c.total)}</span>${alta}</td>`;
}

/** @param {Map<string,import('../../domain/tipos.js').Fornecedor>} fornecedores */
export function tabelaMapa(res, fornecedores) {
  const f = (id) => fornecedores.get(id);
  const cabecalho = res.colunas.map((c) => html`
    <th class="mapa__fornecedor" scope="col" data-fraca="${c.incompleta || c.unidadeDiferente}">
      <span class="mapa__nome">${f(c.fornecedorId)?.nome ?? "Fornecedor removido"}</span>
      <span class="mapa__cnpj">${cnpjMascara(f(c.fornecedorId)?.cnpj)}</span>
      <span class="mapa__selos">
        ${c.sugerida ? html`<span class="selo" data-tom="ok">Sugerida</span>` : ""}
        ${c.incompleta ? html`<span class="selo" data-tom="neutro">Incompleta</span>` : ""}
        ${c.unidadeDiferente ? html`<span class="selo" data-tom="aviso">Unidade diferente</span>` : ""}
        ${c.vencida ? html`<span class="selo" data-tom="perigo">Vencida</span>` : ""}
      </span>
    </th>`);

  const corpo = res.linhas.map(({ item }, i) => html`
    <tr>
      <th class="mapa__item" scope="row"><span>${item.descricao}</span>${item.especificacao ? html`<small>${item.especificacao}</small>` : ""}<small class="mapa__qtd-estreita">${numeroBr(item.quantidade)} ${item.unidade}</small></th>
      <td class="mapa__qtd">${numeroBr(item.quantidade)} ${item.unidade}</td>
      ${res.colunas.map((c) => celula(c.celulas[i], item))}
    </tr>`);

  const rodape = (rotulo, fn, estado = "") => html`<tr data-linha="${estado}"><th class="mapa__item" scope="row" colspan="2">${rotulo}</th>${res.colunas.map((c) => html`<td class="mapa__rodape" data-vencida="${rotulo === "Validade" && c.vencida}">${fn(c)}</td>`)}</tr>`;

  return html`
    <table class="mapa">
      <thead><tr><th class="mapa__item mapa__item--cab" scope="col">Item</th><th class="mapa__qtd mapa__qtd--cab" scope="col">Qtd.</th>${cabecalho}</tr></thead>
      <tbody>${corpo}</tbody>
      <tfoot>
        ${rodape("Subtotal dos itens", (c) => reais(c.subtotal))}
        ${rodape("Frete", (c) => (c.freteCentavos ? reais(c.freteCentavos) : "sem frete"))}
        ${rodape("Custo total", (c) => html`<strong>${reais(c.custoTotal)}</strong>${c.incompleta ? html`<span class="mapa__sub">faltam itens</span>` : c.unidadeDiferente ? html`<span class="mapa__sub">parcial: unidade diferente</span>` : ""}`, "total")}
        ${rodape("Prazo de entrega", (c) => (c.prazoEntregaDias != null ? `${c.prazoEntregaDias} ${c.prazoEntregaDias === 1 ? "dia" : "dias"}` : "—"))}
        ${rodape("Pagamento", (c) => c.pagamento || "—")}
        ${rodape("Validade", (c) => html`${dataBr(c.validade)}${c.vencida ? html`<span class="mapa__sub">vencida</span>` : ""}`)}
      </tfoot>
    </table>`;
}

/** Avisos que valem para o mapa inteiro (iguais na tela e na impressão). */
export function avisosDoMapa(res) {
  const avisos = [];
  if (res.poucasPropostas) avisos.push(`Só ${res.colunas.length} de ${res.minPropostas} propostas mínimas. A cotação segue, mas peça mais orçamentos ou justifique a escolha.`);
  const incompletas = res.colunas.filter((c) => c.incompleta).length;
  if (incompletas) avisos.push(`${incompletas} ${incompletas === 1 ? "proposta não cotou" : "propostas não cotaram"} todos os itens: ${incompletas === 1 ? "fica fora" : "ficam fora"} da sugestão, mas ${incompletas === 1 ? "pode" : "podem"} ganhar itens na compra dividida.`);
  const diferentes = res.colunas.filter((c) => c.unidadeDiferente).length;
  if (diferentes) avisos.push(`${diferentes} ${diferentes === 1 ? "proposta usa" : "propostas usam"} unidade diferente da pedida em algum item: esse preço não entra na comparação.`);
  const vencidas = res.colunas.filter((c) => c.vencida).length;
  if (vencidas) avisos.push(`${vencidas} ${vencidas === 1 ? "proposta com validade vencida" : "propostas com validade vencida"}. Confirme o preço com o fornecedor.`);
  return avisos;
}
