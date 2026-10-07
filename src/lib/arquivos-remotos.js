/** Cliente autenticado da API privada de anexos do Cloudflare Pages. */
export function criarClienteArquivos({ auth, fetcher = fetch, endpoint = "/api/arquivos" }) {
  async function requisicao(id, metodo, body) {
    const usuario = auth.currentUser;
    if (!usuario) throw new Error("Entre novamente para acessar os arquivos sincronizados.");
    const token = await usuario.getIdToken();
    const resposta = await fetcher(`${endpoint}/${encodeURIComponent(id)}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": body.type || "application/octet-stream" } : {}) }, ...(body ? { body } : {}) });
    if (!resposta.ok) { let detalhe = ""; try { detalhe = (await resposta.json()).error || ""; } catch {} throw new Error(detalhe || `Não foi possível acessar o arquivo (${resposta.status}).`); }
    return resposta;
  }
  return {
    async enviar(id, blob) { await requisicao(id, "PUT", blob); },
    async baixar(id) { return (await requisicao(id, "GET")).blob(); },
    async existe(id) {
      const usuario = auth.currentUser;
      if (!usuario) throw new Error("Entre novamente para acessar os arquivos sincronizados.");
      const token = await usuario.getIdToken();
      const resposta = await fetcher(`${endpoint}/${encodeURIComponent(id)}`, { method: "HEAD", headers: { Authorization: `Bearer ${token}` } });
      if (resposta.status === 404) return false;
      if (!resposta.ok) throw new Error(`Não foi possível verificar o arquivo (${resposta.status}).`);
      return true;
    },
    async apagar(id) { await requisicao(id, "DELETE"); },
  };
}
