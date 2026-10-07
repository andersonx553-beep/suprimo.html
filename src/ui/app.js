// Casca: barra superior (computador), barra inferior (celular), roteamento e redesenho quando o store muda.
import { html, montar } from "../lib/html.js";
import { icone } from "../lib/icones.js";
import { lerRota, ir } from "./roteador.js";
import { aplicarTema, temaEfetivo } from "./tema.js";
import { telaCotacoes } from "./telas/cotacoes.js";
import { telaCotacao } from "./telas/cotacao.js";
import { telaFornecedores } from "./telas/fornecedores.js";
import { telaAjustes } from "./telas/ajustes.js";
import { telaImportar } from "./telas/importar.js";
import { avisar } from "./componentes/aviso.js";
import { VERSAO, NOVIDADE } from "../lib/versao.js";

const AREAS = [
  { id: "cotacoes", rotulo: "Cotações", icone: "cotacoes", href: "#/cotacoes" },
  { id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedores", href: "#/fornecedores" },
  { id: "ajustes", rotulo: "Ajustes", icone: "ajustes", href: "#/ajustes" },
];

const navegacao = (classe) => html`<nav class="${classe}" aria-label="Áreas do sistema">${AREAS.map((a) => html`<a class="navegacao__link" href="${a.href}" data-area="${a.id}">${icone(a.icone, 20)}<span>${a.rotulo}</span><span class="navegacao__cont" data-cont="${a.id}"></span></a>`)}</nav>`;

export function iniciarApp(raiz, store, { usuario, sair } = {}) {
  montar(raiz, html`
    <a class="pular" href="#principal">Pular para o conteúdo</a>
    <header class="topo"><div class="topo__interno">
      <a class="marca" href="#/cotacoes" aria-label="Suprimo, ir para Cotações"><span class="marca__logo">${icone("logo", 20)}</span><span><span class="marca__nome">Suprimo</span><span class="marca__sub">Central de cotações</span></span></a>
      ${navegacao("navegacao navegacao--topo")}
      <span class="conta-ativa" title="Conta conectada">${usuario?.email ?? ""}</span>
      <button class="botao botao--peq" data-sair> Sair </button>
      <button class="botao-icone botao-icone--caixa topo__tema" data-tema aria-label="Alternar entre tema claro e escuro"></button>
    </div></header>
    <main id="principal" class="principal" tabindex="-1"></main>
    ${navegacao("navegacao navegacao--base")}
    <footer class="rodape">Cotações, fornecedores e ajustes sincronizam pelo Firestore. PDFs, XMLs e imagens ficam apenas no aparelho em que foram anexados. Confira preços, prazos e cadastro direto com cada fornecedor. CNPJ: <a href="https://brasilapi.com.br" target="_blank" rel="noopener">BrasilAPI</a> · <span class="mono">Versão ${VERSAO}</span> (${NOVIDADE})</footer>`);

  const principal = raiz.querySelector("#principal");
  const botaoTema = raiz.querySelector("[data-tema]");
  const pintarTema = () => montar(botaoTema, html`${icone(temaEfetivo() === "escuro" ? "sol" : "lua", 18)}`);
  pintarTema();
  botaoTema.addEventListener("click", () => { aplicarTema(temaEfetivo() === "escuro" ? "claro" : "escuro"); pintarTema(); });
  raiz.querySelector("[data-sair]").addEventListener("click", () => sair?.());

  let limpar = () => {};
  let ultimaRota = "";
  const desenhar = (preservar = false) => {
    const rota = lerRota();
    const chave = `${rota.area}/${rota.numero}/${rota.aba === "importar" ? "importar" : ""}`;
    const rolagem = window.scrollY;
    limpar();
    raiz.querySelectorAll("[data-area]").forEach((a) => (a.dataset.area === rota.area ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const telas = { cotacoes: rota.numero ? (rota.aba === "importar" ? telaImportar : telaCotacao) : telaCotacoes, fornecedores: telaFornecedores, ajustes: telaAjustes };
    limpar = telas[rota.area](principal, { store, rota }) ?? (() => {});
    raiz.querySelectorAll("[data-cont='cotacoes']").forEach((el) => { el.textContent = store.estado.cotacoes.length || ""; });
    raiz.querySelectorAll("[data-cont='fornecedores']").forEach((el) => { el.textContent = store.estado.fornecedores.length || ""; });
    document.title = rota.numero ? `${rota.numero} · Suprimo` : `${AREAS.find((a) => a.id === rota.area).rotulo} · Suprimo`;
    if (preservar && chave === ultimaRota) window.scrollTo(0, rolagem); else if (!preservar) { window.scrollTo(0, 0); }
    ultimaRota = chave;
  };

  window.addEventListener("hashchange", () => desenhar(false));
  store.assinar((meta) => { if (!meta.silencioso) desenhar(true); });
  store.aoFalhar((erro) => avisar(`Falha ao sincronizar com o Firestore. Confira sua conexão. ${erro?.message ?? ""}`));
  if (!store.persistente) avisar("Este navegador não guarda dados. O que você fizer vale só até fechar a página.");
  if (!location.hash) history.replaceState(null, "", "#/cotacoes");
  desenhar(false);
}
