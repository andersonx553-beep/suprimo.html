import { html, montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { cnpjMascara } from "../../domain/cnpj.js";
import { desempenho } from "../../domain/desempenho.js";
import { linkMaps } from "../../domain/convite.js";
import { semAcento } from "../../domain/mapa.js";
import { abrirFormFornecedor } from "../componentes/form-fornecedor.js";
import { avatar, estadoVazio } from "../componentes/pecas.js";

const filtro = { busca: "" };

export function telaFornecedores(raiz, { store }) {
  const { fornecedores, cotacoes } = store.estado;
  const novo = () => abrirFormFornecedor(store, null);
  const cabecalho = html`<header class="pagina__cab"><div><p class="pagina__sobre">Base de cadastro</p><h1 class="pagina__titulo">Fornecedores</h1></div>
    <button class="botao botao--destaque" data-novo>${icone("mais", 16)}Novo fornecedor</button></header>`;

  const procurar = html`
    <form class="procurar" data-procurar>
      <label class="campo-rotulado procurar__campo">Procurar novos fornecedores<input class="campo" name="q" placeholder="Ex.: material elétrico Campinas SP"></label>
      <button class="botao">${icone("mapa", 16)}Procurar no Google Maps${icone("externo", 14)}</button>
    </form>`;

  if (!fornecedores.length) {
    montar(raiz, html`${cabecalho}<section class="cartao">${estadoVazio({ icone: "fornecedores", titulo: "Nenhum fornecedor cadastrado", texto: "Cadastre pelo CNPJ: a Receita preenche razão social, situação e endereço.",
      acoes: html`<button class="botao botao--primario" data-novo>${icone("mais", 16)}Cadastrar fornecedor</button>` })}</section><section class="cartao">${procurar}</section>`);
  } else {
    montar(raiz, html`${cabecalho}
      <section class="cartao">
        <div class="lista__cab"><h2 class="cartao__titulo">Cadastro <span class="contador" data-total></span></h2>
          <label class="busca">${icone("lupa", 16)}<span class="sr-only">Buscar fornecedor</span><input class="campo" type="search" data-busca placeholder="Nome, CNPJ ou categoria" value="${filtro.busca}"></label></div>
        <div class="tabela-quadro tabela-quadro--solto"><table class="tabela tabela--lista">
          <thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Contato</th><th>Categorias</th><th class="tabela__num">Convites</th><th class="tabela__num">Respostas</th><th class="tabela__num">Vitórias</th></tr></thead>
          <tbody data-corpo></tbody></table></div>
      </section>
      <section class="cartao">${procurar}</section>`);
    const corpo = raiz.querySelector("[data-corpo]"), total = raiz.querySelector("[data-total]");
    const desenhar = () => {
      const q = semAcento(filtro.busca).toLowerCase().trim();
      const vistos = fornecedores.filter((f) => !q || semAcento([f.nome, f.razaoSocial, f.cnpj, ...(f.categorias ?? [])].join(" ")).toLowerCase().includes(q)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      total.textContent = vistos.length === fornecedores.length ? String(fornecedores.length) : `${vistos.length} de ${fornecedores.length}`;
      montar(corpo, vistos.length ? html`${vistos.map((f) => {
        const d = desempenho(f.id, cotacoes);
        return html`<tr>
          <td data-rotulo="Fornecedor"><button class="tabela__fornecedor" data-editar="${f.id}">${avatar(f.nome)}<span><strong>${f.nome}</strong>${f.situacaoCadastral ? html`<small data-ativa="${String(/ativa/i.test(f.situacaoCadastral))}">${f.situacaoCadastral}</small>` : ""}</span></button></td>
          <td class="mono" data-rotulo="CNPJ">${cnpjMascara(f.cnpj) || "—"}</td>
          <td data-rotulo="Contato">${[f.whatsapp, f.email].filter(Boolean).join(" · ") || "—"}</td>
          <td data-rotulo="Categorias">${(f.categorias ?? []).join(", ") || "—"}</td>
          <td class="tabela__num" data-rotulo="Convites">${d.convites}</td><td class="tabela__num" data-rotulo="Respostas">${d.respostas}</td><td class="tabela__num" data-rotulo="Vitórias">${d.vitorias}</td></tr>`;
      })}` : html`<tr><td colspan="7" class="tabela__vazio">Nenhum fornecedor encontrado.</td></tr>`);
    };
    raiz.querySelector("[data-busca]").addEventListener("input", (e) => { filtro.busca = e.target.value; desenhar(); });
    corpo.addEventListener("click", (e) => { const b = e.target.closest("[data-editar]"); if (b) abrirFormFornecedor(store, store.fornecedor(b.dataset.editar)); });
    desenhar();
  }
  raiz.querySelectorAll("[data-novo]").forEach((b) => b.addEventListener("click", novo));
  raiz.querySelector("[data-procurar]").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) window.open(linkMaps(q), "_blank", "noopener");
  });
  return () => {};
}
