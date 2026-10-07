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

test("Firestore isola os registros por usuário e deixa arquivos no armazenamento local", async () => {
  const f = firebaseFalso(), local = localFalso(), db = {};
  const a = criarAdaptadorFirebase({ db, uid: "uid-rafael", sdk: f.sdk, local });
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
  assert.equal([...f.dados.keys()].some((chave) => chave.includes("anexos")), false);
});

test("migração inicial não substitui registros que já estejam na nuvem", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u1", sdk: f.sdk, local: localFalso() });
  await a.gravar("cotacoes", { id: "existente", numero: "COT-0001" });
  await assert.rejects(() => a.importarInicial({ cotacoes: [{ id: "existente", numero: "antiga" }], fornecedores: [] }), /Já existem dados na nuvem/);
  assert.equal((await a.carregar()).cotacoes[0].numero, "COT-0001");
});

test("Firestore envia snapshots consolidados com os dados recebidos", async () => {
  const f = firebaseFalso(), a = criarAdaptadorFirebase({ db: {}, uid: "u2", sdk: f.sdk, local: localFalso() });
  let remoto;
  const parar = a.observar((dados) => { remoto = dados; });
  await a.gravar("fornecedores", { id: "f1", nome: "Fornecedor" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(remoto.fornecedores[0].nome, "Fornecedor");
  parar();
});
