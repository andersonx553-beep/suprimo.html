// Único ponto que conhece o localStorage. Na fase 3, o repositório troca por Firestore e as telas não mudam.
const PREFIXO = "suprimo2:";

export const armazenamento = {
  ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(PREFIXO + chave);
      return bruto == null ? padrao : JSON.parse(bruto);
    } catch { return padrao; }
  },
  gravar(chave, valor) {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  },
  apagar(chave) {
    try { localStorage.removeItem(PREFIXO + chave); } catch { /* sem armazenamento */ }
  },
};
