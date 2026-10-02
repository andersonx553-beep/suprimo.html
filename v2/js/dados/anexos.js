// Arquivos originais das propostas (PDF ou imagem), só para consulta. Ficam no IndexedDB do navegador.
const BANCO = "suprimo2-anexos";
const LOJA = "anexos";

function abrir() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}
async function transacao(modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction(LOJA, modo);
    const r = fn(t.objectStore(LOJA));
    t.oncomplete = () => { db.close(); ok(r?.result); };
    t.onerror = () => { db.close(); erro(t.error); };
  });
}

export const anexos = {
  async salvar(arquivo) {
    const id = "anx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await transacao("readwrite", (l) => l.put(arquivo, id));
    return { id, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size };
  },
  obter: (id) => transacao("readonly", (l) => l.get(id)),
  remover: (id) => transacao("readwrite", (l) => l.delete(id)),
};
