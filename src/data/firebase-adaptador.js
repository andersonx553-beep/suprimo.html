const COLECOES = ["cotacoes", "fornecedores", "documentos", "ajustes", "meta"];
const ID_AJUSTES = "ajustes";
const ID_VERSAO = "versaoEsquema";

const listar = async (sdk, db, uid, nome) => {
  const snapshot = await sdk.getDocs(sdk.collection(db, "users", uid, nome));
  return snapshot.docs.map((d) => d.data());
};

/** Repositório Firestore isolado por UID; os anexos ficam no R2 e usam IndexedDB como cache. */
export function criarAdaptadorFirebase({ db, uid, sdk, local, arquivos }) {
  const anexosDosDados = (dados) => [...new Set([
    ...(dados.cotacoes ?? []).flatMap((c) => (c.propostas ?? []).flatMap((p) => (p.anexos ?? []).map((a) => a.id))),
    ...(dados.documentos ?? []).map((d) => d.anexoId),
  ].filter(Boolean))];
  const colecao = (nome) => sdk.collection(db, "users", uid, nome);
  const documento = (nome, id) => sdk.doc(db, "users", uid, nome, id);

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
      const cotacoesRemotas = await listar(sdk, db, uid, "cotacoes");
      const documentosRemotos = await listar(sdk, db, uid, "documentos");
      const anexos = anexosDosDados({ cotacoes: cotacoesRemotas, documentos: documentosRemotos });
      for (const id of anexos) await arquivos?.apagar(id).catch(() => {});
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
    async sincronizarAnexos(dadosNuvem) {
      const ids = anexosDosDados(dadosNuvem);
      for (const id of ids) {
        if (await arquivos.existe(id)) continue;
        const blob = await local.lerAnexo(id);
        if (blob) await arquivos.enviar(id, blob);
      }
    },
    async salvarAnexo(id, blob) {
      if (!arquivos) throw new Error("Armazenamento remoto não configurado. Configure o bucket R2 no Cloudflare Pages.");
      await arquivos.enviar(id, blob);
      try { await local.salvarAnexo(id, blob); } catch { /* R2 continua como armazenamento principal. */ }
    },
    async lerAnexo(id) {
      const localBlob = await local.lerAnexo(id);
      if (localBlob) return localBlob;
      if (!arquivos) throw new Error("Armazenamento remoto não configurado no Cloudflare Pages.");
      const blob = await arquivos.baixar(id);
      try { await local.salvarAnexo(id, blob); } catch { /* Cache opcional. */ }
      return blob;
    },
    async apagarAnexo(id) {
      if (arquivos) await arquivos.apagar(id);
      await local.apagarAnexo(id);
    },
    guardarVersao(valor) { return sdk.setDoc(documento("meta", ID_VERSAO), { id: ID_VERSAO, valor }); },
    async importarInicial(dados) {
      const [cotacoes, fornecedores, documentos, ajustes] = await Promise.all([
        listar(sdk, db, uid, "cotacoes"), listar(sdk, db, uid, "fornecedores"), listar(sdk, db, uid, "documentos"), listar(sdk, db, uid, "ajustes"),
      ]);
      if (cotacoes.length || fornecedores.length || documentos.length || ajustes.some((a) => a.id === ID_AJUSTES)) {
        throw new Error("Já existem dados na nuvem. A migração inicial foi interrompida para não sobrescrevê-los.");
      }
      const entradas = [
        ...(dados.fornecedores ?? []).map((valor) => ["fornecedores", valor]),
        ...(dados.cotacoes ?? []).map((valor) => ["cotacoes", valor]),
        ...(dados.documentos ?? []).map((valor) => ["documentos", valor]),
        ...(dados.ajustes ? [["ajustes", { id: ID_AJUSTES, ...dados.ajustes }]] : []),
        ["meta", { id: ID_VERSAO, valor: dados.versaoEsquema ?? 2 }],
      ];
      if (entradas.length > 450) throw new Error("Há mais de 450 registros para migrar de uma vez. Nenhum dado foi enviado; exporte um backup e reduza os registros antes de tentar novamente.");
      const idsAnexos = anexosDosDados(dados);
      const carregados = [];
      for (const id of idsAnexos) {
        const blob = await local.lerAnexo(id);
        if (!blob) throw new Error(`O arquivo ${id} não foi encontrado neste aparelho. A migração foi cancelada sem enviar registros.`);
        carregados.push([id, blob]);
      }
      const enviados = [];
      try {
        for (const [id, blob] of carregados) { if (!arquivos) throw new Error("Configure o bucket R2 no Cloudflare Pages antes de migrar arquivos."); await arquivos.enviar(id, blob); enviados.push(id); }
        const lote = sdk.writeBatch(db);
        for (const [nome, valor] of entradas) lote.set(documento(nome, valor.id), valor);
        await lote.commit();
      } catch (erro) {
        for (const id of enviados) await arquivos.apagar(id).catch(() => {});
        throw erro;
      }
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
