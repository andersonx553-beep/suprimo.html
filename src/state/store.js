// Store pequeno: guarda tudo em memória, grava no adaptador a cada mudança e avisa quem assinou.
// As telas leem daqui e se redesenham no evento "mudou". Mudança com `{ silencioso: true }` (edição campo a campo) não redesenha.
import { AJUSTES_PADRAO, VERSAO_ATUAL, migrar, montarBackup } from "../data/esquema.js";
import { criarExemplo } from "../data/exemplo.js";
import { proximoNumero } from "../domain/numeracao.js";
import { duplicarCotacao } from "../domain/duplicar.js";
import { hoje, somarDias } from "../lib/formato.js";

/** @typedef {import('../domain/tipos.js').Cotacao} Cotacao @typedef {import('../domain/tipos.js').Fornecedor} Fornecedor */

export const novoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

export function criarStore(adaptador) {
  /** @type {{cotacoes:Cotacao[], fornecedores:Fornecedor[], ajustes:typeof AJUSTES_PADRAO, pronto:boolean}} */
  const estado = { cotacoes: [], fornecedores: [], ajustes: { ...AJUSTES_PADRAO }, pronto: false };
  const ouvintes = new Set();
  const falhas = new Set();

  const emitir = (meta = {}) => ouvintes.forEach((fn) => fn(meta));
  /** Roda a gravação sem travar a tela; se falhar, avisa quem assinou `aoFalhar`. */
  const persistir = (promessa) => promessa.catch((e) => falhas.forEach((fn) => fn(e)));

  const store = {
    estado,
    persistente: adaptador.persistente,
    assinar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    aoFalhar(fn) { falhas.add(fn); },

    async iniciar() {
      const lido = await adaptador.carregar();
      const migrado = migrar({ versaoEsquema: lido.versaoEsquema, cotacoes: lido.cotacoes, fornecedores: lido.fornecedores, ajustes: lido.ajustes });
      estado.cotacoes = migrado.cotacoes;
      estado.fornecedores = migrado.fornecedores;
      estado.ajustes = { ...AJUSTES_PADRAO, ...(migrado.ajustes ?? {}) };
      if (lido.versaoEsquema !== VERSAO_ATUAL) {
        await Promise.all([...estado.cotacoes.map((c) => adaptador.gravar("cotacoes", c)), ...estado.fornecedores.map((f) => adaptador.gravar("fornecedores", f))]);
      }
      await adaptador.guardarVersao?.(VERSAO_ATUAL);
      estado.pronto = true;
      emitir({ origem: "iniciar" });
    },

    /** Busca por número (COT-0001) ou por id. */
    cotacao: (chave) => estado.cotacoes.find((c) => c.numero === chave || c.id === chave) ?? null,
    fornecedor: (id) => estado.fornecedores.find((f) => f.id === id) ?? null,
    fornecedoresPorId: () => new Map(estado.fornecedores.map((f) => [f.id, f])),

    // ----- cotações -----
    criarCotacao({ titulo }) {
      const { numero, contador } = proximoNumero(estado.ajustes.contadorCotacao);
      const agora = new Date().toISOString();
      /** @type {Cotacao} */
      const c = {
        id: novoId(), numero, titulo, solicitante: estado.ajustes.solicitante, destino: estado.ajustes.destinoPadrao,
        prazoPropostas: somarDias(hoje(), estado.ajustes.prazoRespostaDias), observacoes: "", status: "rascunho",
        criadaEm: agora, atualizadaEm: agora, concluidaEm: "", itens: [], convites: [], propostas: [], decisao: null,
      };
      estado.ajustes = { ...estado.ajustes, contadorCotacao: contador };
      estado.cotacoes.push(c);
      persistir(Promise.all([adaptador.gravar("cotacoes", c), adaptador.gravar("ajustes", { id: "ajustes", ...estado.ajustes })]));
      emitir({ origem: "cotacao" });
      return c;
    },
    duplicarCotacao(id) {
      const origem = store.cotacao(id);
      const { numero, contador } = proximoNumero(estado.ajustes.contadorCotacao);
      const copia = duplicarCotacao(origem, { id: novoId(), numero, agora: new Date().toISOString(), novoId, prazoPropostas: somarDias(hoje(), estado.ajustes.prazoRespostaDias) });
      estado.ajustes = { ...estado.ajustes, contadorCotacao: contador };
      estado.cotacoes.push(copia);
      persistir(Promise.all([adaptador.gravar("cotacoes", copia), adaptador.gravar("ajustes", { id: "ajustes", ...estado.ajustes })]));
      emitir({ origem: "cotacao" });
      return copia;
    },
    /** Altera a cotação no lugar, grava e avisa. @param {(c:Cotacao)=>void} alterar */
    atualizarCotacao(id, alterar, meta = {}) {
      const c = store.cotacao(id);
      if (!c) return null;
      alterar(c);
      c.atualizadaEm = new Date().toISOString();
      persistir(adaptador.gravar("cotacoes", c));
      emitir({ origem: "cotacao", cotacaoId: c.id, ...meta });
      return c;
    },
    async removerCotacao(id) {
      const c = store.cotacao(id);
      estado.cotacoes = estado.cotacoes.filter((x) => x.id !== c.id);
      for (const p of c.propostas) for (const a of p.anexos ?? []) persistir(adaptador.apagarAnexo(a.id));
      persistir(adaptador.apagar("cotacoes", c.id));
      emitir({ origem: "cotacao" });
    },

    // ----- fornecedores -----
    salvarFornecedor(f, meta = {}) {
      const i = estado.fornecedores.findIndex((x) => x.id === f.id);
      if (i >= 0) estado.fornecedores[i] = f; else estado.fornecedores.push(f);
      persistir(adaptador.gravar("fornecedores", f));
      emitir({ origem: "fornecedor", ...meta });
      return f;
    },
    removerFornecedor(id) {
      estado.fornecedores = estado.fornecedores.filter((f) => f.id !== id);
      persistir(adaptador.apagar("fornecedores", id));
      emitir({ origem: "fornecedor" });
    },

    // ----- ajustes -----
    salvarAjustes(parcial, meta = {}) {
      estado.ajustes = { ...estado.ajustes, ...parcial };
      persistir(adaptador.gravar("ajustes", { id: "ajustes", ...estado.ajustes }));
      emitir({ origem: "ajustes", ...meta });
    },

    // ----- anexos -----
    async salvarAnexo(arquivo) {
      const id = novoId();
      await adaptador.salvarAnexo(id, arquivo);
      return { id, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size };
    },
    lerAnexo: (id) => adaptador.lerAnexo(id),
    apagarAnexo: (id) => adaptador.apagarAnexo(id),

    // ----- backup, demonstração e limpeza -----
    exportar() { return montarBackup({ cotacoes: estado.cotacoes, fornecedores: estado.fornecedores, ajustes: estado.ajustes }); },
    /** Substitui tudo pelos dados já validados e migrados de `lerBackup`. */
    async importar(dados) {
      await adaptador.limparTudo();
      estado.cotacoes = dados.cotacoes;
      estado.fornecedores = dados.fornecedores;
      estado.ajustes = { ...AJUSTES_PADRAO, ...dados.ajustes };
      await Promise.all([...estado.cotacoes.map((c) => adaptador.gravar("cotacoes", c)), ...estado.fornecedores.map((f) => adaptador.gravar("fornecedores", f)),
        adaptador.gravar("ajustes", { id: "ajustes", ...estado.ajustes }), adaptador.guardarVersao?.(VERSAO_ATUAL)]);
      emitir({ origem: "importar" });
    },
    async apagarTudo() {
      await adaptador.limparTudo();
      Object.assign(estado, { cotacoes: [], fornecedores: [], ajustes: { ...AJUSTES_PADRAO } });
      await adaptador.guardarVersao?.(VERSAO_ATUAL);
      emitir({ origem: "limpar" });
    },
    temExemplo: () => estado.cotacoes.some((c) => c.exemplo) || estado.fornecedores.some((f) => f.exemplo),
    /** Junta a demonstração ao que já existe, com numeração própria. */
    async carregarExemplo() {
      const ex = criarExemplo(novoId);
      let contador = estado.ajustes.contadorCotacao;
      for (const c of ex.cotacoes) { const n = proximoNumero(contador); c.numero = n.numero; contador = n.contador; }
      estado.fornecedores.push(...ex.fornecedores);
      estado.cotacoes.push(...ex.cotacoes);
      estado.ajustes = { ...estado.ajustes, contadorCotacao: contador };
      await Promise.all([...ex.fornecedores.map((f) => adaptador.gravar("fornecedores", f)), ...ex.cotacoes.map((c) => adaptador.gravar("cotacoes", c)),
        adaptador.gravar("ajustes", { id: "ajustes", ...estado.ajustes })]);
      emitir({ origem: "exemplo" });
      return ex.cotacoes.at(-1);
    },
    async removerExemplo() {
      const cs = estado.cotacoes.filter((c) => c.exemplo), fs = estado.fornecedores.filter((f) => f.exemplo);
      estado.cotacoes = estado.cotacoes.filter((c) => !c.exemplo);
      estado.fornecedores = estado.fornecedores.filter((f) => !f.exemplo);
      await Promise.all([...cs.map((c) => adaptador.apagar("cotacoes", c.id)), ...fs.map((f) => adaptador.apagar("fornecedores", f.id))]);
      emitir({ origem: "exemplo" });
    },
  };
  return store;
}
