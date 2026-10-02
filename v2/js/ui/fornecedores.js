import { esc, aviso } from "./util.js";
import { icone } from "./icones.js";
import * as repos from "../dados/repos.js";
import { cnpjMascara, cnpjValido } from "../dominio/cnpj.js";
import { consultarCnpj } from "../dados/brasilapi.js";
import { desempenho } from "../dominio/desempenho.js";

export async function abrirFornecedores(raiz) {
  const [lista, cots] = await Promise.all([repos.fornecedores.listar(), repos.cotacoes.listar()]);
  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  let busca = "";

  const desenhar = () => {
    const q = busca.toLowerCase();
    raiz.querySelector("tbody").innerHTML = lista.filter((f) => !q || [f.nome, f.cnpj, f.cidade, ...(f.segmentos || [])].join(" ").toLowerCase().includes(q)).map((f) => {
      const d = desempenho(f.id, cots);
      return `<tr class="clicavel" data-id="${f.id}">
        <td><span class="forn-nome">${esc(f.nome)}</span><span class="muted">${esc(f.cidade || "")}</span></td>
        <td class="mono">${esc(cnpjMascara(f.cnpj) || "—")} ${f.cnpjVerificado ? `<span class="selo selo-ok">Verificado</span>` : ""}</td>
        <td class="muted mono">${esc(f.whatsapp || f.email || "—")}</td><td>${esc((f.segmentos || []).join(", "))}</td>
        <td class="num mono">${d.convites}</td><td class="num mono">${d.respostas}</td><td class="num mono">${d.vitorias}</td></tr>`;
    }).join("") || `<tr><td colspan="7" class="vazio-linha">Nenhum fornecedor.</td></tr>`;
  };

  raiz.innerHTML = `
    <header class="cab-simples"><h1>Fornecedores</h1></header>
    <div class="filtros"><input type="search" id="busca" placeholder="Buscar por nome, CNPJ, cidade ou segmento" aria-label="Buscar">
      <button class="btn btn-principal" id="novo">${icone("mais", 16)}Novo fornecedor</button></div>
    <div class="tabela-quadro"><table class="tabela tabela-lista"><thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Segmentos</th><th class="num">Convites</th><th class="num">Respostas</th><th class="num">Vitórias</th></tr></thead><tbody></tbody></table></div>
    <fieldset class="registro achar"><legend>Achar novos fornecedores</legend>
      <div class="campos duas"><label>O que procura<input id="achar-seg" placeholder="material elétrico"></label><label>Cidade<input id="achar-cid" placeholder="Campinas SP"></label></div>
      <button class="btn" id="achar">Pesquisar no Google Maps</button></fieldset>
    <dialog id="dlg"></dialog>`;

  raiz.querySelector("#busca").addEventListener("input", (e) => { busca = e.target.value; desenhar(); });
  raiz.querySelector("#novo").addEventListener("click", () => editar(null));
  raiz.addEventListener("click", (e) => { const tr = e.target.closest("tr.clicavel"); if (tr) editar(lista.find((f) => f.id === tr.dataset.id)); });
  raiz.querySelector("#achar").addEventListener("click", () => {
    const q = `${raiz.querySelector("#achar-seg").value} ${raiz.querySelector("#achar-cid").value}`.trim();
    if (!q) return aviso("Diga o que procura.");
    window.open("https://www.google.com/maps/search/" + encodeURIComponent(q), "_blank", "noopener");
  });

  function editar(f) {
    const novo = !f;
    f = { id: "for-" + Date.now().toString(36), nome: "", cnpj: "", cnpjVerificado: false, whatsapp: "", email: "", cidade: "", segmentos: [], ...f };
    const dlg = raiz.querySelector("#dlg");
    dlg.innerHTML = `<form method="dialog" class="form-forn">
      <h2>${novo ? "Novo fornecedor" : esc(f.nome)}</h2>
      <label>CNPJ<span class="linha-cnpj"><input id="f-cnpj" class="mono" inputmode="numeric" value="${esc(cnpjMascara(f.cnpj) || f.cnpj)}"><button type="button" class="btn" id="f-consultar">Consultar CNPJ</button></span></label>
      <p class="muted" id="f-situacao">${f.cnpjVerificado ? "CNPJ verificado na Receita." : ""}</p>
      <label>Nome<input id="f-nome" value="${esc(f.nome)}" required></label>
      <div class="campos duas"><label>WhatsApp<input id="f-whats" inputmode="tel" value="${esc(f.whatsapp)}"></label><label>E-mail<input id="f-email" type="email" value="${esc(f.email)}"></label></div>
      <div class="campos duas"><label>Cidade<input id="f-cidade" value="${esc(f.cidade)}"></label><label>Segmentos (separe por vírgula)<input id="f-seg" value="${esc((f.segmentos || []).join(", "))}"></label></div>
      <div class="acoes"><button class="btn btn-principal" value="salvar">Salvar</button><button class="btn" value="cancelar" formnovalidate>Cancelar</button>
        ${novo ? "" : `<button class="btn btn-ruim" type="button" id="f-apagar">${icone("lixeira", 15)}Apagar</button>`}</div></form>`;
    dlg.showModal();
    const $f = (s) => dlg.querySelector(s);
    $f("#f-consultar").addEventListener("click", async () => {
      const sit = $f("#f-situacao"); sit.textContent = "Consultando…";
      try {
        const r = await consultarCnpj($f("#f-cnpj").value);
        f.cnpjVerificado = true; f.situacao = r.situacao;
        if (!$f("#f-nome").value) $f("#f-nome").value = r.nome;
        if (!$f("#f-email").value) $f("#f-email").value = r.email;
        if (!$f("#f-whats").value) $f("#f-whats").value = r.telefone;
        if (!$f("#f-cidade").value) $f("#f-cidade").value = r.cidade;
        $f("#f-cnpj").value = cnpjMascara($f("#f-cnpj").value);
        sit.textContent = `Situação na Receita: ${r.situacao}${r.ativa ? "" : ". Confira antes de comprar."}`;
      } catch (e) { sit.textContent = e.message; }
    });
    $f("#f-apagar")?.addEventListener("click", async () => {
      if (!confirm(`Apagar ${f.nome}? As cotações antigas continuam, mas sem o nome dele.`)) return;
      await repos.fornecedores.remover(f.id); dlg.close(); abrirFornecedores(raiz);
    });
    dlg.addEventListener("close", async () => {
      if (dlg.returnValue !== "salvar") return;
      const cnpj = $f("#f-cnpj").value.replace(/\D/g, "");
      if (cnpj && !cnpjValido(cnpj)) f.cnpjVerificado = false;
      Object.assign(f, { cnpj, nome: $f("#f-nome").value.trim(), whatsapp: $f("#f-whats").value.trim(), email: $f("#f-email").value.trim(),
        cidade: $f("#f-cidade").value.trim(), segmentos: $f("#f-seg").value.split(",").map((s) => s.trim()).filter(Boolean) });
      if (cnpj && !cnpjValido(cnpj)) aviso("Salvo, mas o CNPJ tem dígitos inválidos.");
      await repos.fornecedores.salvar(f); abrirFornecedores(raiz);
    }, { once: true });
  }
  desenhar();
}
