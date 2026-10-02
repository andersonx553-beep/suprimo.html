// Entrada: carrega o exemplo na primeira vez, monta o menu das 5 áreas e roteia por hash.
import * as repos from "./dados/repos.js";
import { icone } from "./ui/icones.js";
import { abrirCotacao } from "./ui/cotacao.js";
import { abrirLista } from "./ui/lista-cotacoes.js";
import { abrirHoje } from "./ui/hoje.js";
import { abrirFornecedores } from "./ui/fornecedores.js";
import { abrirPrecos } from "./ui/precos.js";
import { abrirAjustes } from "./ui/ajustes.js";

const AREAS = [
  { id: "hoje", nome: "Hoje", icone: "hoje", rota: "#/hoje" },
  { id: "cotacoes", nome: "Cotações", icone: "cotacoes", rota: "#/cotacoes" },
  { id: "fornecedores", nome: "Fornecedores", icone: "fornecedores", rota: "#/fornecedores" },
  { id: "precos", nome: "Preços", icone: "precos", rota: "#/precos" },
  { id: "ajustes", nome: "Ajustes", icone: "ajustes", rota: "#/ajustes" },
];

const menu = (classe) => `<nav class="${classe}" aria-label="Áreas">${AREAS.map((a) =>
  `<a href="${a.rota}" data-area="${a.id}">${icone(a.icone, 20)}<span>${a.nome}</span></a>`).join("")}</nav>`;

function temaAtual() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

async function montarCasca() {
  document.getElementById("app").innerHTML = `
    <aside class="lateral"><div class="marca"><span class="marca-logo mono">S</span><span class="marca-nome">Suprimo</span><span class="marca-versao mono">2.2</span></div>
      ${menu("menu-lateral")}
      <div class="lateral-rodape">
        <div id="faixa-exemplo" class="faixa-exemplo" hidden><span>Dados de exemplo</span><button class="btn-link" id="restaurar">Restaurar</button></div>
        <button class="btn-icone" id="tema" aria-label="Alternar tema claro e escuro"></button>
      </div></aside>
    <main id="conteudo" class="conteudo"></main>
    ${menu("menu-inferior")}`;
  const t = document.getElementById("tema");
  const pintar = () => { t.innerHTML = icone(temaAtual() === "dark" ? "sol" : "lua", 18); };
  pintar();
  t.addEventListener("click", async () => {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    const a = await repos.ajustes.obter(); a.tema = novo; await repos.ajustes.salvar(a);
    pintar();
  });
  document.getElementById("restaurar").addEventListener("click", async () => {
    if (!confirm("Apagar as cotações e fornecedores e carregar o exemplo de novo?")) return;
    await repos.carregarExemplo({ forcar: true });
    location.hash = "#/cotacao/cot-1/mapa"; location.reload();
  });
}

async function rotear() {
  const conteudo = document.getElementById("conteudo");
  const [, area = "cotacoes", id, aba] = location.hash.slice(1).split("/");
  document.querySelectorAll("[data-area]").forEach((a) => {
    const ativa = a.dataset.area === (area === "cotacao" ? "cotacoes" : area);
    a.classList.toggle("ativa", ativa);
    ativa ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (area === "cotacao") await abrirCotacao(id, aba, conteudo, { ir: (h) => { location.hash = h; } });
  else if (area === "cotacoes") await abrirLista(conteudo);
  else if (area === "hoje") await abrirHoje(conteudo);
  else if (area === "fornecedores") await abrirFornecedores(conteudo);
  else if (area === "precos") await abrirPrecos(conteudo);
  else if (area === "ajustes") await abrirAjustes(conteudo);
  else location.hash = "#/hoje";
  const cs = await repos.cotacoes.listar();
  document.getElementById("faixa-exemplo").hidden = !cs.some((c) => c.exemplo);
}

const ajustes0 = await repos.ajustes.obter();
if (ajustes0.tema) document.documentElement.dataset.theme = ajustes0.tema;
await repos.carregarExemplo();
await montarCasca();
if (!location.hash) location.hash = "#/hoje";
addEventListener("hashchange", rotear);
rotear();
