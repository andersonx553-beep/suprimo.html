import { esc } from "./util.js";
import * as repos from "../dados/repos.js";
import { brl, dataBr } from "../dominio/formato.js";

export async function abrirPrecos(raiz) {
  const [lista, forns] = await Promise.all([repos.precos.listar(), repos.fornecedores.listar()]);
  const nome = new Map(forns.map((f) => [f.id, f.nome]));
  const porItem = new Map();
  for (const p of lista) (porItem.get(p.chave) || porItem.set(p.chave, []).get(p.chave)).push(p);
  const linhas = [...porItem.entries()].map(([chave, ps]) => {
    ps.sort((a, b) => a.data.localeCompare(b.data));
    const ultimo = ps.at(-1), menor = ps.reduce((m, p) => (p.preco < m.preco ? p : m));
    return { chave, ultimo, menor, n: ps.length };
  }).sort((a, b) => a.chave.localeCompare(b.chave, "pt-BR"));
  let busca = "";
  const desenhar = () => {
    const q = busca.toLowerCase();
    raiz.querySelector("tbody").innerHTML = linhas.filter((l) => l.chave.includes(q)).map((l) => `<tr>
      <td>${esc(l.chave)}</td><td class="num mono">${brl(l.ultimo.preco)}</td><td>${esc(nome.get(l.ultimo.fornecedorId) || "—")}</td>
      <td class="mono">${dataBr(l.ultimo.data)}</td><td class="num mono">${brl(l.menor.preco)}</td><td class="num mono">${l.n}</td></tr>`).join("")
      || `<tr><td colspan="6" class="vazio-linha">${linhas.length ? "Nenhum item neste filtro." : "Ainda sem preços. Eles entram quando uma cotação é aprovada."}</td></tr>`;
  };
  raiz.innerHTML = `
    <header class="cab-simples"><h1>Preços</h1></header>
    <div class="filtros"><input type="search" id="busca" placeholder="Buscar item" aria-label="Buscar item"></div>
    <div class="tabela-quadro"><table class="tabela tabela-lista"><thead><tr><th>Item</th><th class="num">Último preço pago</th><th>Fornecedor</th><th>Data</th><th class="num">Menor preço</th><th class="num">Compras</th></tr></thead><tbody></tbody></table></div>`;
  raiz.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  desenhar();
}
