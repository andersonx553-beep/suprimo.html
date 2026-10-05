// Persistência. Dois adaptadores com a mesma interface: IndexedDB (real) e memória (testes e navegadores sem IndexedDB).
const NOME = "suprimo";
const VERSAO_BANCO = 2;
const LOJAS = ["cotacoes", "fornecedores", "ajustes", "anexos", "meta", "documentos"];

/**
 * @typedef {Object} Adaptador
 * @property {()=>Promise<{cotacoes:any[], fornecedores:any[], documentos:any[], ajustes:any|null, versaoEsquema:number}>} carregar
 * @property {(loja:string, obj:any)=>Promise<void>} gravar
 * @property {(loja:string, id:string)=>Promise<void>} apagar
 * @property {()=>Promise<void>} limparTudo
 * @property {(id:string, blob:Blob)=>Promise<void>} salvarAnexo
 * @property {(id:string)=>Promise<Blob|undefined>} lerAnexo
 * @property {(id:string)=>Promise<void>} apagarAnexo
 * @property {boolean} persistente
 */

const promessa = (req) => new Promise((ok, erro) => { req.onsuccess = () => ok(req.result); req.onerror = () => erro(req.error); });

/** @returns {Promise<Adaptador>} */
export async function abrirIndexedDB() {
  if (!globalThis.indexedDB) throw new Error("Este navegador não tem IndexedDB.");
  const db = await new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, VERSAO_BANCO);
    req.onupgradeneeded = () => {
      for (const loja of LOJAS) if (!req.result.objectStoreNames.contains(loja)) req.result.createObjectStore(loja, loja === "anexos" || loja === "meta" ? undefined : { keyPath: "id" });
      // Documentos importados: o hash do arquivo é único (o próprio banco impede importar o mesmo PDF duas vezes).
      const docs = req.transaction.objectStore("documentos");
      if (!docs.indexNames.contains("fileHash")) docs.createIndex("fileHash", "fileHash", { unique: true });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
    req.onblocked = () => erro(new Error("O banco está aberto em outra aba. Feche as outras abas do Suprimo."));
  });
  const loja = (nome, modo = "readonly") => db.transaction(nome, modo).objectStore(nome);
  const concluir = (nome, fn) => new Promise((ok, erro) => {
    const t = db.transaction(nome, "readwrite");
    fn(t.objectStore(nome));
    t.oncomplete = () => ok();
    t.onerror = () => erro(t.error);
  });
  return {
    persistente: true,
    async carregar() {
      const [cotacoes, fornecedores, documentos, ajustes, versao] = await Promise.all([
        promessa(loja("cotacoes").getAll()), promessa(loja("fornecedores").getAll()), promessa(loja("documentos").getAll()),
        promessa(loja("ajustes").get("ajustes")), promessa(loja("meta").get("versaoEsquema")),
      ]);
      return { cotacoes, fornecedores, documentos, ajustes: ajustes ?? null, versaoEsquema: versao ?? 1 };
    },
    gravar: (nome, obj) => concluir(nome, (l) => l.put(obj)),
    apagar: (nome, id) => concluir(nome, (l) => l.delete(id)),
    async limparTudo() { for (const nome of LOJAS) await concluir(nome, (l) => l.clear()); },
    salvarAnexo: (id, blob) => concluir("anexos", (l) => l.put(blob, id)),
    lerAnexo: (id) => promessa(loja("anexos").get(id)),
    apagarAnexo: (id) => concluir("anexos", (l) => l.delete(id)),
    guardarVersao: (v) => concluir("meta", (l) => l.put(v, "versaoEsquema")),
  };
}

/** @returns {Adaptador} */
export function criarMemoria(inicial = {}) {
  const dados = { cotacoes: new Map(), fornecedores: new Map(), ajustes: new Map(), anexos: new Map(), meta: new Map(), documentos: new Map() };
  (inicial.documentos ?? []).forEach((d) => dados.documentos.set(d.id, structuredClone(d)));
  (inicial.cotacoes ?? []).forEach((c) => dados.cotacoes.set(c.id, structuredClone(c)));
  (inicial.fornecedores ?? []).forEach((f) => dados.fornecedores.set(f.id, structuredClone(f)));
  if (inicial.ajustes) dados.ajustes.set("ajustes", structuredClone(inicial.ajustes));
  return {
    persistente: false,
    async carregar() {
      return { cotacoes: [...dados.cotacoes.values()].map((c) => structuredClone(c)), fornecedores: [...dados.fornecedores.values()].map((f) => structuredClone(f)),
        documentos: [...dados.documentos.values()].map((d) => structuredClone(d)),
        ajustes: dados.ajustes.get("ajustes") ?? null, versaoEsquema: dados.meta.get("versaoEsquema") ?? 1 };
    },
    async gravar(loja, obj) {
      // Mesma regra do IndexedDB: hash de arquivo repetido em outro documento é recusado.
      if (loja === "documentos" && [...dados.documentos.values()].some((d) => d.id !== obj.id && d.fileHash === obj.fileHash)) {
        throw Object.assign(new Error("Documento duplicado"), { name: "ConstraintError" });
      }
      dados[loja].set(obj.id, structuredClone(obj));
    },
    async apagar(loja, id) { dados[loja].delete(id); },
    async limparTudo() { Object.values(dados).forEach((m) => m.clear()); },
    async salvarAnexo(id, blob) { dados.anexos.set(id, blob); },
    async lerAnexo(id) { return dados.anexos.get(id); },
    async apagarAnexo(id) { dados.anexos.delete(id); },
    async guardarVersao(v) { dados.meta.set("versaoEsquema", v); },
  };
}
