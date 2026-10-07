import test from "node:test";
import assert from "node:assert/strict";
import { criarAdaptadorFirebase } from "../src/data/firebase-adaptador.js";

function firebaseFalso() {
  const dados = new Map();
  const ouvintes = new Map();
  const caminho = (...partes) => partes.slice(1).join("/");
  const sdk = {
    collection: (_db, ...partes) => ({ path: partes.join("/") }),
    doc: (_db, ...partes) => ({ path: partes.join("/") }),
    async getDocs(ref) {
      const prefixo = `${ref.path}/`;
      const docs = [...dados].filter(([chave]) => chave.startsWith(prefixo) && !chave.slice(prefixo.length).includes("/"))
        .map(([id, valor]) => ({ id: id.slice(prefixo.length), data: () => structuredClone(valor) }));
      return { docs };
    },
    async setDoc(ref, valor) { dados.set(ref.path, structuredClone(valor)); notificar(ref.path); },
    async deleteDoc(ref) { dados.delete(ref.path); notificar(ref.path); },
    writeBatch() {
      const operacoes = [];
      return {
        set: (ref, valor) => operacoes.push(() => dados.set(ref.path, structuredClone(valor))),
        delete: (ref) => operacoes.push(() => dados.delete(ref.path)),
        async commit() { operacoes.forEach((op) => op()); },
      };
    },
    onSnapshot(ref, callback) { ouvintes.set(ref.path, callback); callback(sdkSnapshot(ref.path)); return () => ouvintes.delete(ref.path); },
  };
  function sdkSnapshot(path) {
    const prefixo = `${path}/`;
    return { docs: [...dados].filter(([chave]) => chave.startsWith(prefixo) && !chave.slice(prefixo.length).includes("/"))
      .map(([id, valor]) => ({ id: id.slice(prefixo.length), data: () => structuredClone(valor) })) };
  }
  function notificar(path) {
    const colecao = path.split("/").slice(0, -1).join("/");
    ouvintes.get(colecao)?.(sdkSnapshot(colecao));
  }
  return { sdk, dados, caminho };
}

const localFalso = () => ({
  blobs: new Map(),
  async limparTudo() { this.blobs.clear(); },
  async salvarAnexo(id, arquivo) { this.blobs.set(id, arquivo); },
  async lerAnexo(id) { return this.blobs.get(id); },
  async apagarAnexo(id) { this.blobs.delete(id); },
});

function arquivosFalsos() {
  const blobs = new Map();
  return { blobs, async enviar(id, blob) { blobs.set(id, blob); }, async baixar(id) { const blob = blobs.get(id); if (!blob) throw new Error("404"); return blob; }, async apagar(id) { blobs.delete(id); }, async existe(id) { return blobs.has(id); } };
}

test("Firestore isola registros e anexos remotos por UID", async () => {
  const f = firebaseFalso(), local = localFalso(), arquivos = arquivosFalsos(), db = {};
  const a = criarAdaptadorFirebase({ db, uid: "uid-rafael", sdk: f.sdk, local, arquivos });
  await a.gravar("cotacoes", { id: "c1", numero: "COT-0001" });
  await a.gravar("ajustes", { id: "ajustes", solicitante: "Rafael" });
  const lido = await a.carregar();
  assert.equal(lido.cotacoes[0].numero, "COT-0001");
  assert.equal(lido.ajustes.solicitante, "Rafael");
  assert.ok(f.dados.has("users/uid-rafael/cotacoes/c1"));
  assert.equal(f.dados.has("users/outro-uid/cotacoes/c1"), false);

  const arquivo = new Blob(["orçamento"]);
  await a.salvarAnexo("arquivo1", arquivo);
  assert.equal(await a.lerAnexo("arquivo1"), arquivo);
  assert.equal(arquivos.blobs.get("arquivo1"), arquivo);
  assert.equal([...f.dados.keys()].some((chave) => chave.includes("anexos")), false);
  const outroAparelho = criarAdaptadorFirebase({ db, uid: "uid-rafael", sdk: f.sdk, local: localFalso(), arquivos });
  assert.equal(await (await outroAparelho.lerAnexo("arquivo1")).text(), "orçamento");
});

test("migração inicial não substitui registros que já estejam na nuvem", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u1", sdk: f.sdk, local: localFalso(), arquivos: arquivosFalsos() });
  await a.gravar("cotacoes", { id: "existente", numero: "COT-0001" });
  await assert.rejects(() => a.importarInicial({ cotacoes: [{ id: "existente", numero: "antiga" }], fornecedores: [] }), /Já existem dados na nuvem/);
  assert.equal((await a.carregar()).cotacoes[0].numero, "COT-0001");
});

test("migração inicial envia anexos antes de confirmar os registros", async () => {
  const f = firebaseFalso(), local = localFalso(), arquivos = arquivosFalsos();
  const a = criarAdaptadorFirebase({ db: {}, uid: "u4", sdk: f.sdk, local, arquivos });
  const arquivo = new Blob(["xml"], { type: "application/xml" });
  await local.salvarAnexo("xml-1", arquivo);
  await a.importarInicial({ cotacoes: [{ id: "c1", propostas: [{ anexos: [{ id: "xml-1" }] }] }], documentos: [{ id: "d1", anexoId: "xml-1" }] });
  assert.equal(arquivos.blobs.get("xml-1"), arquivo);
  assert.equal((await a.carregar()).cotacoes.length, 1);
});

test("migração sem arquivo local aborta sem gravar registros", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u5", sdk: f.sdk, local: localFalso(), arquivos: arquivosFalsos() });
  await assert.rejects(() => a.importarInicial({ cotacoes: [{ id: "c1", propostas: [{ anexos: [{ id: "faltando" }] }] }] }), /não foi encontrado neste aparelho/);
  assert.equal(f.dados.size, 0);
});

test("migração acima do limite atômico falha antes de gravar qualquer registro", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u3", sdk: f.sdk, local: localFalso(), arquivos: arquivosFalsos() });
  const cotacoes = Array.from({ length: 451 }, (_, i) => ({ id: `c${i}`, numero: `COT-${i}` }));
  await assert.rejects(() => a.importarInicial({ cotacoes, fornecedores: [] }), /mais de 450 registros/);
  assert.equal(f.dados.size, 0);
});

test("Firestore envia snapshots consolidados com os dados recebidos", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u2", sdk: f.sdk, local: localFalso(), arquivos: arquivosFalsos() });
  let remoto;
  const parar = a.observar((dados) => { remoto = dados; });
  await a.gravar("fornecedores", { id: "f1", nome: "Fornecedor" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(remoto.fornecedores[0].nome, "Fornecedor");
  parar();
});
