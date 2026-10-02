// Peças pequenas e repetidas: etiqueta de status, avatar de fornecedor, estado vazio.
import { html } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { rotuloStatus } from "../../domain/status.js";

export const etiquetaStatus = (status) => html`<span class="etiqueta" data-status="${status}">${rotuloStatus(status)}</span>`;
export const iniciais = (nome) => String(nome).replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
export const avatar = (nome) => html`<span class="avatar" aria-hidden="true">${iniciais(nome)}</span>`;

/** Estado vazio: diz o próximo passo e entrega o botão que o executa. */
export const estadoVazio = ({ icone: nome = "pacote", titulo, texto = "", acoes }) => html`
  <div class="vazio">${icone(nome, 34)}<h2 class="vazio__titulo">${titulo}</h2>${texto ? html`<p class="vazio__texto">${texto}</p>` : ""}<div class="vazio__acoes">${acoes}</div></div>`;

export const SITUACOES_CONVITE = [
  ["nao_enviado", "Não enviado"], ["enviado", "Enviado"], ["respondeu", "Respondeu"], ["recusou", "Recusou"],
];
export const rotuloSituacao = (s) => SITUACOES_CONVITE.find(([k]) => k === s)?.[1] ?? s;
