// Aba "Mapa comparativo": resumo do que importa, avisos e a tabela como no papel.
import { html } from "../../../lib/html.js";
import { icone } from "../../../lib/icones.js";
import { reais, percentualBr } from "../../../lib/formato.js";
import { calcularDivisao, melhorPorItem } from "../../../domain/mapa.js";
import { tabelaMapa, avisosDoMapa } from "../../componentes/tabela-mapa.js";
import { estadoVazio } from "../../componentes/pecas.js";

function resumo(res, forn) {
  const completas = res.colunas.filter((c) => c.elegivel);
  const sugerida = res.colunas.find((c) => c.sugerida);
  const divisao = res.colunas.length ? calcularDivisao(res, melhorPorItem(res)) : null;
  const divisaoCompleta = divisao && divisao.faltaEscolher === 0 && divisao.escolhas.length > 0;
  const maior = completas.length >= 2 ? Math.max(...completas.map((c) => c.custoTotal)) : null;
  const diferencaDivisao = divisaoCompleta && sugerida ? sugerida.custoTotal - divisao.custoTotal : null;
  return [
    { icone: "trofeu", tom: "ok", rotulo: "Melhor proposta completa", valor: sugerida ? reais(sugerida.custoTotal) : "—",
      detalhe: sugerida ? forn.get(sugerida.fornecedorId)?.nome : "Nenhuma proposta cotou todos os itens" },
    { icone: "camadas", tom: "ambar", rotulo: "Melhor combinação por item", valor: divisaoCompleta ? reais(divisao.custoTotal) : "—",
      detalhe: divisaoCompleta ? `${divisao.fretes.length} ${divisao.fretes.length === 1 ? "fornecedor" : "fornecedores"}${diferencaDivisao > 0 ? ` · ${reais(diferencaDivisao)} a menos` : diferencaDivisao < 0 ? ` · ${reais(-diferencaDivisao)} a mais` : ""}` : "Falta preço comparável em algum item" },
    { icone: "queda", tom: "neutro", rotulo: "Economia vs. maior proposta", valor: maior != null && sugerida ? reais(maior - sugerida.custoTotal) : "—",
      detalhe: maior != null && sugerida ? `${percentualBr((maior - sugerida.custoTotal) / maior)} sobre a mais cara entre as completas` : "Precisa de duas propostas completas" },
    { icone: "escudo", tom: res.poucasPropostas ? "ambar" : "ok", rotulo: `Regra das ${res.minPropostas} propostas`, valor: `${res.colunas.length} / ${res.minPropostas}`,
      detalhe: res.poucasPropostas ? "Abaixo do mínimo: avise na decisão" : "Mínimo atendido" },
  ];
}

export function abaMapa({ cot, res, forn }) {
  if (!res.colunas.length) {
    return estadoVazio({ icone: "lista", titulo: "Ainda não há propostas para comparar", texto: "Lance as propostas que os fornecedores enviaram e o mapa se monta sozinho.",
      acoes: html`<a class="botao botao--primario" href="#/cotacoes/${encodeURIComponent(cot.numero)}/propostas">Lançar proposta</a>` });
  }
  return html`
    <div class="resumo">${resumo(res, forn).map((r) => html`
      <div class="resumo__cartao" data-tom="${r.tom}"><span class="resumo__rotulo">${icone(r.icone, 15)}${r.rotulo}</span><strong class="resumo__valor">${r.valor}</strong><span class="resumo__detalhe">${r.detalhe}</span></div>`)}</div>
    ${avisosDoMapa(res).map((a) => html`<p class="faixa" data-tom="aviso">${icone("alerta", 16)}<span>${a}</span></p>`)}
    <div class="mapa-quadro" tabindex="0" role="region" aria-label="Mapa comparativo, role para o lado para ver todos os fornecedores">${tabelaMapa(res, forn)}</div>
    <div class="mapa-rodape">
      <p class="legenda"><span class="legenda__amostra">R$ 0,00</span> menor preço da linha · preço unitário em cima, total do item embaixo</p>
      <div class="acoes-linha"><button class="botao" data-acao="imprimir">${icone("imprimir", 16)}Gerar mapa para assinatura</button>
      <a class="botao botao--primario" href="#/cotacoes/${encodeURIComponent(cot.numero)}/decisao">Escolher o vencedor</a></div>
    </div>`;
}
