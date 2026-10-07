const COLECOES = ["cotacoes", "fornecedores", "documentos", "ajustes", "meta"];
const ID_AJUSTES = "ajustes";
const ID_VERSAO = "versaoEsquema";

const listar = async (sdk, db, uid, nome) => {
  const snapshot = await sdk.getDocs(sdk.collection(db, "users", uid, nome));
  return snapshot.docs.map((d) => d.data());
};

/** Repositório Firestore isolado por UID; anexos binários continuam no IndexedDB deste aparelho. */
export function criarAdaptadorFirebase({ db, uid, sdk, local }) {
  const colecao = (nome) => sdk.collection(db, "users", uid, nome);
  const documento = (nome, id) => sdk.doc(db, "users", uid, nome, id);

  async function gravarLote(nome, valores) {
    for (let inicio = 0; inicio < valores.length; inicio += 450) {
      const lote = sdk.writeBatch(db);
      for (const valor of valores.slice(inicio, inicio + 450)) lote.set(documento(nome, valor.id), valor);
      await lote.commit();
    }
  }

  return {
    persistente: true,
    async carregar() {
      const [cotacoes, fornecedores, documentos, ajustes, meta] = await Promise.all(COLECOES.map((nome) => listar(sdk, db, uid, nome)));
      return {
        cotacoes, fornecedores, documentos,
        ajustes: ajustes.find((a) => a.id === ID_AJUSTES) ?? null,
        versaoEsquema: meta.find((m) => m.id === ID_VERSAO)?.valor ?? 1,
      };
    },
    gravar(nome, objeto) { return sdk.setDoc(documento(nome, objeto.id), objeto); },
    apagar(nome, id) { return sdk.deleteDoc(documento(nome, id)); },
    async limparTudo() {
      for (const nome of COLECOES) {
        const itens = await listar(sdk, db, uid, nome);
        for (let inicio = 0; inicio < itens.length; inicio += 450) {
          const lote = sdk.writeBatch(db);
          for (const item of itens.slice(inicio, inicio + 450)) lote.delete(documento(nome, item.id));
          await lote.commit();
        }
      }
      await local.limparTudo();
    },
    salvarAnexo: (id, blob) => local.salvarAnexo(id, blob),
    lerAnexo: (id) => local.lerAnexo(id),
    apagarAnexo: (id) => local.apagarAnexo(id),
    guardarVersao(valor) { return sdk.setDoc(documento("meta", ID_VERSAO), { id: ID_VERSAO, valor }); },
    async importarInicial(dados) {
      const [cotacoes, fornecedores, documentos, ajustes] = await Promise.all([
        listar(sdk, db, uid, "cotacoes"), listar(sdk, db, uid, "fornecedores"), listar(sdk, db, uid, "documentos"), listar(sdk, db, uid, "ajustes"),
      ]);
      if (cotacoes.length || fornecedores.length || documentos.length || ajustes.some((a) => a.id === ID_AJUSTES)) {
        throw new Error("Já existem dados na nuvem. A migração inicial foi interrompida para não sobrescrevê-los.");
      }
      await gravarLote("fornecedores", dados.fornecedores ?? []);
      await gravarLote("cotacoes", dados.cotacoes ?? []);
      await gravarLote("documentos", dados.documentos ?? []);
      if (dados.ajustes) await sdk.setDoc(documento("ajustes", ID_AJUSTES), { id: ID_AJUSTES, ...dados.ajustes });
      await this.guardarVersao(dados.versaoEsquema ?? 2);
    },
    observar(onData, onError = () => {}) {
      const colecoes = ["cotacoes", "fornecedores", "documentos", "ajustes", "meta"];
      const recebidos = new Map();
      const parar = colecoes.map((nome) => sdk.onSnapshot(colecao(nome), (snapshot) => {
        recebidos.set(nome, snapshot.docs.map((d) => d.data()));
        if (recebidos.size !== colecoes.length) return;
        const ajustes = recebidos.get("ajustes");
        const meta = recebidos.get("meta");
        onData({ cotacoes: recebidos.get("cotacoes"), fornecedores: recebidos.get("fornecedores"), documentos: recebidos.get("documentos"),
          ajustes: ajustes.find((a) => a.id === ID_AJUSTES) ?? null, versaoEsquema: meta.find((m) => m.id === ID_VERSAO)?.valor ?? 1 });
      }, onError));
      return () => parar.forEach((fn) => fn());
    },
  };
}
