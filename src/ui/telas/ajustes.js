import { html } from "../../lib/html.js";
import { montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { hoje } from "../../lib/formato.js";
import { MODELO_PADRAO, VARIAVEIS } from "../../domain/convite.js";
import { lerBackup } from "../../data/esquema.js";
import { baixarTexto } from "../../lib/arquivo.js";
import { confirmar } from "../componentes/dialogo.js";
import { avisar } from "../componentes/aviso.js";
import { aplicarTema, temaEscolhido } from "../tema.js";

export function telaAjustes(raiz, { store }) {
  const a = store.estado.ajustes;
  const tema = temaEscolhido();
  montar(raiz, html`
    <header class="pagina__cab"><div><p class="pagina__sobre">Preferências</p><h1 class="pagina__titulo">Ajustes</h1></div></header>
    <div class="ajustes">
      <section class="cartao"><h2 class="cartao__titulo">Empresa e solicitante</h2>
        <p class="cartao__nota">Aparecem no cabeçalho do mapa em PDF e nas mensagens de solicitação.</p>
        <div class="formulario__grade">
          <label class="campo-rotulado">Nome da empresa<input class="campo" data-k="empresa.nome" value="${a.empresa.nome}"></label>
          <label class="campo-rotulado">CNPJ da empresa<input class="campo campo--mono" data-k="empresa.cnpj" value="${a.empresa.cnpj}"></label>
          <label class="campo-rotulado">Solicitante padrão<input class="campo" data-k="solicitante" value="${a.solicitante}"></label>
        </div>
        <label class="campo-rotulado">Local de entrega padrão<input class="campo" data-k="destinoPadrao" value="${a.destinoPadrao}" placeholder="Endereço ou nome do almoxarifado"></label>
      </section>
      <section class="cartao"><h2 class="cartao__titulo">Regras</h2>
        <div class="formulario__grade formulario__grade--2">
          <label class="campo-rotulado">Mínimo de propostas por cotação<input class="campo campo--num" type="number" min="1" data-k="minPropostas" data-n value="${a.minPropostas}"></label>
          <label class="campo-rotulado">Prazo padrão para resposta (dias)<input class="campo campo--num" type="number" min="0" data-k="prazoRespostaDias" data-n value="${a.prazoRespostaDias}"></label>
        </div>
      </section>
      <section class="cartao"><h2 class="cartao__titulo">Mensagem de solicitação</h2>
        <p class="cartao__nota">Variáveis: ${VARIAVEIS.map((v) => html`<code>{${v}}</code> `)}</p>
        <label class="campo-rotulado"><span class="sr-only">Modelo da mensagem</span><textarea class="campo campo--mono" rows="12" data-k="modeloMensagem">${a.modeloMensagem}</textarea></label>
        <div class="acoes-linha"><button class="botao botao--peq" data-padrao>Voltar ao modelo padrão</button></div>
      </section>
      <section class="cartao"><h2 class="cartao__titulo">Aparência</h2>
        <div class="decisao__modo" role="radiogroup" aria-label="Tema">
          ${[["auto", "Seguir o aparelho"], ["escuro", "Escuro"], ["claro", "Claro"]].map(([k, r]) => html`<label><input type="radio" name="tema" value="${k}" ${tema === k ? "checked" : ""}>${r}</label>`)}
        </div>
      </section>
      <section class="cartao"><h2 class="cartao__titulo">Dados e backup</h2>
        <p class="cartao__nota">Tudo fica salvo neste navegador. O backup leva cotações, fornecedores e ajustes; os PDFs e imagens anexados às propostas ficam só aqui.</p>
        <div class="acoes-linha">
          <button class="botao" data-exportar>${icone("baixar", 16)}Exportar backup</button>
          <label class="botao">${icone("subir", 16)}Importar backup<input type="file" accept="application/json,.json" hidden data-importar></label>
          ${store.temExemplo() ? html`<button class="botao" data-sem-exemplo>Remover dados de demonstração</button>` : html`<button class="botao" data-demo>Carregar demonstração</button>`}
          <span class="espaco"></span>
          <button class="botao botao--perigo" data-apagar>${icone("lixeira", 16)}Apagar todos os dados</button>
        </div>
      </section>
    </div>`);

  raiz.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("change", () => {
    const [k1, k2] = el.dataset.k.split(".");
    const valor = "n" in el.dataset ? Math.max(el.min ? Number(el.min) : 0, Math.floor(Number(el.value) || 0)) : el.value.trim();
    if ("n" in el.dataset) el.value = valor;
    store.salvarAjustes(k2 ? { [k1]: { ...store.estado.ajustes[k1], [k2]: valor } } : { [k1]: k1 === "modeloMensagem" ? el.value : valor }, { silencioso: true });
    avisar("Ajuste salvo.");
  }));
  raiz.querySelector("[data-padrao]").addEventListener("click", () => { store.salvarAjustes({ modeloMensagem: MODELO_PADRAO }); });
  raiz.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener("change", () => aplicarTema(r.value)));

  raiz.querySelector("[data-exportar]").addEventListener("click", () => { baixarTexto(`suprimo-backup-${hoje()}.json`, JSON.stringify(store.exportar(), null, 2)); avisar("Backup exportado."); });
  raiz.querySelector("[data-importar]").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    let dados;
    try { dados = lerBackup(await arquivo.text()); } catch (erro) { avisar(erro.message); return; }
    const ok = await confirmar({ titulo: "Importar este backup?", texto: `O arquivo tem ${dados.cotacoes.length} cotações e ${dados.fornecedores.length} fornecedores. Tudo o que está neste navegador será substituído.`, rotulo: "Importar e substituir", perigo: true });
    if (ok) { await store.importar(dados); avisar("Backup importado."); }
  });
  raiz.querySelector("[data-demo]")?.addEventListener("click", async () => { await store.carregarExemplo(); avisar("Demonstração carregada. Os dados de exemplo estão marcados."); });
  raiz.querySelector("[data-sem-exemplo]")?.addEventListener("click", async () => { await store.removerExemplo(); avisar("Dados de demonstração removidos."); });
  raiz.querySelector("[data-apagar]").addEventListener("click", async () => {
    const ok = await confirmar({ titulo: "Apagar todos os dados?", texto: "Cotações, fornecedores, propostas e ajustes serão apagados deste navegador. Exporte um backup antes se quiser guardar.", rotulo: "Apagar tudo", perigo: true });
    if (ok) { await store.apagarTudo(); avisar("Dados apagados."); }
  });
  return () => {};
}
