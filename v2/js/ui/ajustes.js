import { esc, aviso, baixarArquivo } from "./util.js";
import { icone } from "./icones.js";
import * as repos from "../dados/repos.js";
import { exportarBackup, importarBackup, apagarExemplos } from "../dados/backup.js";
import { MODELO_CONVITE } from "../dados/exemplo.js";
import { hojeIso } from "../dominio/formato.js";

export async function abrirAjustes(raiz) {
  const a = await repos.ajustes.obter();
  const temExemplo = (await repos.cotacoes.listar()).some((c) => c.exemplo);
  raiz.innerHTML = `
    <header class="cab-simples"><h1>Ajustes</h1></header>
    <div class="ajustes">
      <fieldset class="registro"><legend>Empresa e solicitante</legend><div class="campos duas">
        <label>Nome da empresa<input data-k="empresa.nome" value="${esc(a.empresa?.nome)}"></label>
        <label>CNPJ da empresa<input data-k="empresa.cnpj" class="mono" value="${esc(a.empresa?.cnpj)}"></label>
        <label>Solicitante padrão<input data-k="solicitante" value="${esc(a.solicitante)}"></label></div>
        <p class="muted">Aparecem no cabeçalho do mapa em PDF e na mensagem de convite.</p></fieldset>
      <fieldset class="registro"><legend>Regras</legend><div class="campos duas">
        <label>Mínimo de propostas por compra<input type="number" min="1" data-k="minPropostas" data-n="1" value="${a.minPropostas}"></label>
        <label>Prazo padrão das propostas (dias)<input type="number" min="0" data-k="prazoPadraoDias" data-n="1" value="${a.prazoPadraoDias}"></label></div></fieldset>
      <fieldset class="registro"><legend>Mensagem de convite</legend>
        <textarea data-k="modeloConvite" rows="10" class="mono">${esc(a.modeloConvite)}</textarea>
        <p class="muted">Campos: {{fornecedor}} {{solicitante}} {{empresa}} {{numero}} {{itens}} {{prazo}}</p>
        <button class="btn btn-peq" id="padrao-msg">Voltar ao modelo padrão</button></fieldset>
      <fieldset class="registro"><legend>Backup</legend>
        <p class="muted">Leva cotações, fornecedores, preços e ajustes. Não leva chaves de API nem os PDFs e imagens anexados.</p>
        <div class="acoes"><button class="btn" id="exportar">${icone("baixar", 16)}Exportar backup</button>
        <label class="btn">${icone("subir", 16)}Importar backup<input type="file" accept="application/json,.json" hidden id="importar"></label>
        ${temExemplo ? `<button class="btn" id="sem-exemplo">Apagar dados de exemplo</button>` : ""}</div></fieldset>
    </div>`;

  const gravar = async (el) => {
    const v = el.dataset.n ? Math.max(0, Number(el.value) || 0) : el.value;
    const [k1, k2] = el.dataset.k.split(".");
    if (k2) a[k1] = { ...a[k1], [k2]: v }; else a[k1] = v;
    await repos.ajustes.salvar(a);
  };
  raiz.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("change", () => gravar(el)));
  raiz.querySelector("#padrao-msg").addEventListener("click", async () => { a.modeloConvite = MODELO_CONVITE; await repos.ajustes.salvar(a); abrirAjustes(raiz); });
  raiz.querySelector("#exportar").addEventListener("click", () => baixarArquivo(`suprimo-backup-${hojeIso()}.json`, exportarBackup()));
  raiz.querySelector("#importar").addEventListener("change", async (e) => {
    const arq = e.target.files[0]; if (!arq) return;
    if (!confirm("Importar substitui tudo o que está neste navegador. Continuar?")) return;
    try { importarBackup(await arq.text()); aviso("Backup importado."); location.hash = "#/hoje"; location.reload(); } catch (err) { aviso(err.message); }
  });
  raiz.querySelector("#sem-exemplo")?.addEventListener("click", () => {
    if (!confirm("Apagar a cotação, os fornecedores e os preços de exemplo?")) return;
    apagarExemplos(); location.hash = "#/cotacoes"; location.reload();
  });
}
