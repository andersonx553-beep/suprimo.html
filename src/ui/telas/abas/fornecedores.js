// Aba "Fornecedores" da cotação: convidar, disparar WhatsApp e e-mail, acompanhar a situação.
import { html, montar } from "../../../lib/html.js";
import { icone } from "../../../lib/icones.js";
import { dataHoraBr } from "../../../lib/formato.js";
import { montarMensagem, linkWhatsapp, linkEmail } from "../../../domain/convite.js";
import { novoId } from "../../../state/store.js";
import { abrirDialogo } from "../../componentes/dialogo.js";
import { abrirFormFornecedor } from "../../componentes/form-fornecedor.js";
import { avisar } from "../../componentes/aviso.js";
import { avatar, estadoVazio, SITUACOES_CONVITE } from "../../componentes/pecas.js";

const contato = (f) => [f.whatsapp, f.email].filter(Boolean).join(" · ") || "Sem contato: edite o fornecedor";

export function abaFornecedores({ cot, forn, ajustes }) {
  const bloqueada = cot.status === "concluida" || cot.status === "cancelada";
  const pendentes = cot.convites.filter((v) => v.situacao === "nao_enviado" && forn.get(v.fornecedorId)).length;
  const linhas = cot.convites.map((v) => {
    const f = forn.get(v.fornecedorId);
    if (!f) return html`<li class="convite"><span class="convite__nome">Fornecedor removido</span><button class="botao-icone" data-tirar="${v.id}" aria-label="Tirar da cotação">${icone("fechar", 16)}</button></li>`;
    const msg = montarMensagem(ajustes.modeloMensagem, { cotacao: cot, fornecedor: f, ajustes });
    const wa = linkWhatsapp(f.whatsapp || f.telefone, msg), em = linkEmail(f.email, `Cotação ${cot.numero}`, msg);
    return html`
      <li class="convite" data-convite="${v.id}">
        ${avatar(f.nome)}
        <div class="convite__id"><strong class="convite__nome">${f.nome}</strong><span class="convite__contato">${contato(f)}</span></div>
        <label class="convite__situacao"><span class="sr-only">Situação de ${f.nome}</span>
          <select class="campo" data-situacao data-situacao-valor="${v.situacao}">${SITUACOES_CONVITE.map(([k, r]) => html`<option value="${k}" ${k === v.situacao ? "selected" : ""}>${r}</option>`)}</select></label>
        <span class="convite__data">${v.enviadoEm ? `Enviado em ${dataHoraBr(v.enviadoEm)}` : "Ainda não enviado"}</span>
        <div class="convite__acoes">
          ${wa ? html`<a class="botao botao--peq" href="${wa}" target="_blank" rel="noopener" data-enviou="whatsapp">${icone("whatsapp", 15)}WhatsApp</a>` : ""}
          ${em ? html`<a class="botao botao--peq" href="${em}" data-enviou="email">${icone("email", 15)}E-mail</a>` : ""}
          <button class="botao botao--peq" data-copiar>${icone("copiar", 15)}Copiar</button>
          <button class="botao-icone" data-tirar="${v.id}" aria-label="Tirar ${f.nome} da cotação">${icone("fechar", 16)}</button>
        </div>
      </li>`;
  });
  return html`
    <fieldset class="painel__campos" ${bloqueada ? "disabled" : ""}>
      ${!ajustes.empresa.nome || !ajustes.solicitante ? html`<p class="faixa" data-tom="aviso">${icone("info", 16)}<span>Preencha empresa e solicitante em <a href="#/ajustes">Ajustes</a> para personalizar as mensagens.</span></p>` : ""}
      ${cot.convites.length ? html`<ul class="lista-convites">${linhas}</ul>`
        : estadoVazio({ icone: "fornecedores", titulo: "Nenhum fornecedor convidado", texto: "Escolha os fornecedores da base que vão receber o pedido de cotação.",
          acoes: html`<button class="botao botao--primario" data-acao="base">${icone("fornecedores", 16)}Adicionar da base</button><button class="botao" data-acao="novo">${icone("mais", 16)}Novo fornecedor</button>` })}
      ${cot.convites.length ? html`
        <div class="acoes-linha acoes-linha--rodape">
          <button class="botao" data-acao="base">${icone("fornecedores", 16)}Adicionar da base</button>
          <button class="botao" data-acao="novo">${icone("mais", 16)}Novo fornecedor</button>
          <button class="botao" data-acao="mensagem">${icone("email", 16)}Ver mensagem</button>
          <span class="espaco"></span>
          <button class="botao botao--primario" data-acao="sequencia" ${pendentes ? "" : "disabled"}>${icone("enviar", 16)}Disparar em sequência (${pendentes})</button>
        </div>` : ""}
    </fieldset>`;
}

export function ligarFornecedores(raiz, ctx) {
  const { cot, forn, ajustes, store } = ctx;
  const editar = (fn, meta) => store.atualizarCotacao(cot.id, fn, meta);
  const registrarEnvio = (convite, canal) => {
    convite.situacao = "enviado"; convite.enviadoEm = new Date().toISOString(); convite.canal = canal;
  };

  raiz.querySelectorAll("[data-convite]").forEach((li) => {
    const id = li.dataset.convite;
    li.querySelector("[data-situacao]")?.addEventListener("change", (e) => editar((c) => {
      const v = c.convites.find((x) => x.id === id);
      v.situacao = e.target.value;
      if (v.situacao === "enviado" && !v.enviadoEm) { v.enviadoEm = new Date().toISOString(); }
      if (v.situacao === "nao_enviado") { v.enviadoEm = ""; v.canal = ""; }
      if (c.status === "rascunho" && v.situacao !== "nao_enviado") c.status = "aguardando_propostas";
    }));
    li.querySelectorAll("[data-enviou]").forEach((a) => a.addEventListener("click", () => {
      // O navegador abre o WhatsApp ou o programa de e-mail; aqui só anotamos que foi enviado.
      setTimeout(() => editar((c) => { registrarEnvio(c.convites.find((x) => x.id === id), a.dataset.enviou); if (c.status === "rascunho") c.status = "aguardando_propostas"; }), 80);
    }));
    li.querySelector("[data-copiar]")?.addEventListener("click", async () => {
      const f = forn.get(cot.convites.find((x) => x.id === id).fornecedorId);
      try { await navigator.clipboard.writeText(montarMensagem(ajustes.modeloMensagem, { cotacao: cot, fornecedor: f, ajustes })); avisar("Mensagem copiada."); }
      catch { avisar("Não foi possível copiar. Use \"Ver mensagem\" e copie de lá."); }
    });
  });
  raiz.querySelectorAll("[data-tirar]").forEach((b) => b.addEventListener("click", () =>
    editar((c) => { c.convites = c.convites.filter((x) => x.id !== b.dataset.tirar); })));
  raiz.querySelectorAll('[data-acao="base"]').forEach((b) => b.addEventListener("click", () => dialogoBase(ctx)));
  raiz.querySelectorAll('[data-acao="novo"]').forEach((b) => b.addEventListener("click", () => abrirFormFornecedor(store, null,
    (f) => editar((c) => c.convites.push({ id: novoId(), fornecedorId: f.id, situacao: "nao_enviado", enviadoEm: "", canal: "" })))));
  raiz.querySelector('[data-acao="mensagem"]')?.addEventListener("click", () => {
    const f = forn.get(cot.convites.find((v) => forn.get(v.fornecedorId))?.fornecedorId);
    abrirDialogo({ titulo: "Mensagem de solicitação", subtitulo: "O modelo é editável em Ajustes. O nome de cada fornecedor entra no lugar de {fornecedor}.",
      corpo: html`<pre class="mensagem">${montarMensagem(ajustes.modeloMensagem, { cotacao: cot, fornecedor: f, ajustes })}</pre>`,
      rodape: html`<a class="botao" href="#/ajustes" data-fechar>${icone("ajustes", 16)}Editar modelo</a>`,
      aoAbrir: (dlg) => dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close()) });
  });
  raiz.querySelector('[data-acao="sequencia"]')?.addEventListener("click", () => dialogoSequencia(ctx));
}

function dialogoBase({ cot, forn, store }) {
  const convidados = new Set(cot.convites.map((v) => v.fornecedorId));
  const disponiveis = [...forn.values()].filter((f) => !convidados.has(f.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const marcados = new Set();
  abrirDialogo({
    titulo: "Adicionar fornecedores da base",
    corpo: disponiveis.length ? html`<div class="catalogo">${disponiveis.map((f) => html`
      <label class="catalogo__linha"><input type="checkbox" value="${f.id}"><span>${f.nome}</span><small>${(f.categorias || []).join(", ")}</small></label>`)}</div>`
      : html`<p>Todos os fornecedores da base já estão nesta cotação. Use "Novo fornecedor" para cadastrar outro.</p>`,
    rodape: html`<button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-ok disabled>Adicionar</button>`,
    aoAbrir: (dlg) => {
      const ok = dlg.querySelector("[data-ok]");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      dlg.querySelector(".catalogo")?.addEventListener("change", (e) => { e.target.checked ? marcados.add(e.target.value) : marcados.delete(e.target.value); ok.disabled = !marcados.size; ok.textContent = marcados.size ? `Adicionar ${marcados.size}` : "Adicionar"; });
      ok.addEventListener("click", () => { store.atualizarCotacao(cot.id, (c) => marcados.forEach((id) => c.convites.push({ id: novoId(), fornecedorId: id, situacao: "nao_enviado", enviadoEm: "", canal: "" }))); dlg.close(); });
    },
  });
}

/** Passa pelos fornecedores ainda não solicitados, um de cada vez, com a mensagem pronta. */
function dialogoSequencia({ cot, forn, ajustes, store }) {
  const fila = cot.convites.filter((v) => v.situacao === "nao_enviado" && forn.get(v.fornecedorId)).map((v) => v.id);
  let posicao = 0;
  const dlg = abrirDialogo({ titulo: "Disparar em sequência", subtitulo: "Abra o canal, envie e marque como solicitado para seguir ao próximo.", largo: true, corpo: html``, aoFechar: () => {} });
  const corpo = dlg.querySelector(".dialogo__corpo");
  const desenhar = () => {
    if (posicao >= fila.length) {
      montar(corpo, html`<div class="vazio">${icone("ok", 34)}<h2 class="vazio__titulo">Tudo solicitado</h2><p class="vazio__texto">Agora é aguardar as propostas. Quem não responder aparece no topo de Cotações.</p><button class="botao botao--primario" data-fechar>Fechar</button></div>`);
      corpo.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      return;
    }
    const v = cot.convites.find((x) => x.id === fila[posicao]);
    const f = forn.get(v.fornecedorId);
    const msg = montarMensagem(ajustes.modeloMensagem, { cotacao: cot, fornecedor: f, ajustes });
    const wa = linkWhatsapp(f.whatsapp || f.telefone, msg), em = linkEmail(f.email, `Cotação ${cot.numero}`, msg);
    montar(corpo, html`
      <p class="sequencia__passo">Fornecedor ${posicao + 1} de ${fila.length}</p>
      <h3 class="sequencia__nome">${f.nome}</h3>
      <p class="sequencia__contato">${contato(f)}</p>
      <pre class="mensagem">${msg}</pre>
      <div class="acoes-linha">
        ${wa ? html`<a class="botao" href="${wa}" target="_blank" rel="noopener" data-canal="whatsapp">${icone("whatsapp", 16)}Abrir WhatsApp</a>` : ""}
        ${em ? html`<a class="botao" href="${em}" data-canal="email">${icone("email", 16)}Abrir e-mail</a>` : ""}
        <button class="botao" data-copiar>${icone("copiar", 16)}Copiar mensagem</button>
        <span class="espaco"></span>
        <button class="botao" data-pular>Pular</button>
        <button class="botao botao--primario" data-marcar>${icone("ok", 16)}Marcar como solicitado e seguir</button>
      </div>`);
    let canal = "";
    corpo.querySelectorAll("[data-canal]").forEach((a) => a.addEventListener("click", () => { canal = a.dataset.canal; }));
    corpo.querySelector("[data-copiar]").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(msg); canal ||= "whatsapp"; avisar("Mensagem copiada."); } catch { avisar("Não foi possível copiar."); }
    });
    corpo.querySelector("[data-pular]").addEventListener("click", () => { posicao++; desenhar(); });
    corpo.querySelector("[data-marcar]").addEventListener("click", () => {
      store.atualizarCotacao(cot.id, (c) => {
        const alvo = c.convites.find((x) => x.id === v.id);
        alvo.situacao = "enviado"; alvo.enviadoEm = new Date().toISOString(); alvo.canal = canal || "whatsapp";
        if (c.status === "rascunho") c.status = "aguardando_propostas";
      }, { silencioso: true });
      posicao++; desenhar();
    });
  };
  dlg.addEventListener("close", () => store.atualizarCotacao(cot.id, () => {}));
  desenhar();
}
