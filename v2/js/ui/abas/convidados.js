import { esc } from "../util.js";
import { icone } from "../icones.js";
import { dataBr, hojeIso } from "../../dominio/formato.js";
import { montarMensagem, linkWhatsapp, linkEmail } from "../../dominio/convite.js";

export function renderConvidados({ cot, forn, ajustes }) {
  const convidados = new Set(cot.convites.map((c) => c.fornecedorId));
  const disponiveis = [...forn.values()].filter((f) => !convidados.has(f.id));
  const linhas = cot.convites.map((c) => {
    const f = forn.get(c.fornecedorId);
    if (!f) return "";
    const msg = montarMensagem(ajustes.modeloConvite, { cotacao: cot, fornecedor: f, ajustes });
    const wa = linkWhatsapp(f.whatsapp, msg);
    const em = linkEmail(f.email, `Cotação ${cot.numero}`, msg);
    return `<tr>
      <td><span class="forn-nome">${esc(f.nome)}</span></td>
      <td class="muted mono">${esc(f.whatsapp || f.email || "sem contato")}</td>
      <td class="mono">${c.enviadoEm ? dataBr(c.enviadoEm) : "—"}</td>
      <td>${c.enviadoEm ? esc(c.canal === "email" ? "E-mail" : "WhatsApp") : `<span class="muted">não enviado</span>`}</td>
      <td><label class="marcar"><input type="checkbox" data-respondeu="${f.id}" ${c.respondeu ? "checked" : ""}> Respondeu</label></td>
      <td class="acao">
        ${wa ? `<a class="btn btn-peq" href="${wa}" target="_blank" rel="noopener" data-enviou="${f.id}" data-canal="whatsapp">${icone("whatsapp", 15)}WhatsApp</a>` : ""}
        ${em ? `<a class="btn btn-peq" href="${em}" data-enviou="${f.id}" data-canal="email">${icone("email", 15)}E-mail</a>` : ""}
      </td></tr>`;
  }).join("");

  const amostra = cot.convites.length && forn.get(cot.convites[0].fornecedorId)
    ? montarMensagem(ajustes.modeloConvite, { cotacao: cot, fornecedor: forn.get(cot.convites[0].fornecedorId), ajustes }) : "";

  return `
    <div class="tabela-quadro"><table class="tabela tabela-lista">
      <thead><tr><th>Fornecedor</th><th>Contato</th><th>Enviado em</th><th>Canal</th><th>Retorno</th><th></th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="6" class="vazio-linha">Nenhum fornecedor convidado.</td></tr>`}</tbody></table></div>
    <div class="linha-acao">
      ${disponiveis.length ? `<select id="novo-convite" aria-label="Fornecedor para convidar">${disponiveis.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join("")}</select>
        <button class="btn" data-acao="convidar">${icone("mais", 16)}Convidar da base</button>` : `<span class="muted">Todos os fornecedores da base já foram convidados.</span>`}
    </div>
    ${amostra ? `<details class="mensagem"><summary>Ver mensagem de convite</summary><pre>${esc(amostra)}</pre></details>` : ""}`;
}

export function ligarConvidados(raiz, { salvar }) {
  raiz.querySelector('[data-acao="convidar"]')?.addEventListener("click", () => {
    const id = raiz.querySelector("#novo-convite").value;
    salvar((c) => c.convites.push({ fornecedorId: id, enviadoEm: "", canal: "", respondeu: false }));
  });
  raiz.querySelectorAll("[data-respondeu]").forEach((el) => el.addEventListener("change", () =>
    salvar((c) => { c.convites.find((v) => v.fornecedorId === el.dataset.respondeu).respondeu = el.checked; })));
  // Abrir o WhatsApp ou o e-mail registra a data do envio.
  raiz.querySelectorAll("[data-enviou]").forEach((a) => a.addEventListener("click", () =>
    setTimeout(() => salvar((c) => {
      const v = c.convites.find((x) => x.fornecedorId === a.dataset.enviou);
      v.enviadoEm = hojeIso(); v.canal = a.dataset.canal;
      if (c.status === "Rascunho") c.status = "Aguardando propostas";
    }), 50)));
}
