// Repositórios: a interface que as telas usam. Toda função é assíncrona de propósito,
// para a fase 3 trocar o miolo por Firestore sem mexer nas telas.
import { armazenamento as arm } from "./armazenamento.js";
import { AJUSTES_PADRAO, criarExemplo } from "./exemplo.js";

function colecao(chave) {
  return {
    async listar() { return arm.ler(chave, []); },
    async obter(id) { return (arm.ler(chave, [])).find((x) => x.id === id) ?? null; },
    async salvar(obj) {
      const lista = arm.ler(chave, []);
      const i = lista.findIndex((x) => x.id === obj.id);
      if (i >= 0) lista[i] = obj; else lista.push(obj);
      arm.gravar(chave, lista);
      return obj;
    },
    async remover(id) { arm.gravar(chave, arm.ler(chave, []).filter((x) => x.id !== id)); },
  };
}

export const cotacoes = colecao("cotacoes");
export const fornecedores = colecao("fornecedores");

export const ajustes = {
  async obter() { return { ...AJUSTES_PADRAO, ...arm.ler("ajustes", {}) }; },
  async salvar(a) { arm.gravar("ajustes", a); return a; },
};

export const precos = {
  async listar() { return arm.ler("precos", []); },
  async registrar(lista) { arm.gravar("precos", [...arm.ler("precos", []), ...lista]); },
  /** { [chave]: último preço pago } */
  async ultimoPorItem() {
    const mapa = {};
    for (const p of [...arm.ler("precos", [])].sort((a, b) => a.data.localeCompare(b.data))) mapa[p.chave] = p.preco;
    return mapa;
  },
};

export async function carregarExemplo({ forcar = false } = {}) {
  if (!forcar && arm.ler("iniciado", false)) return;
  const ex = criarExemplo();
  arm.gravar("cotacoes", ex.cotacoes);
  arm.gravar("fornecedores", ex.fornecedores);
  arm.gravar("precos", ex.precos);
  arm.gravar("iniciado", true);
}
