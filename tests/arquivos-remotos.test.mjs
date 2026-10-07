import test from "node:test";
import assert from "node:assert/strict";
import { criarClienteArquivos } from "../src/lib/arquivos-remotos.js";

test("cliente envia token e opera arquivos no endpoint remoto", async () => {
  const chamadas = [], blob = new Blob(["xml"], { type: "application/xml" });
  const cliente = criarClienteArquivos({ auth: { currentUser: { async getIdToken() { return "token-seguro"; } } }, fetcher: async (url, init) => {
    chamadas.push({ url, init });
    if (init.method === "GET") return new Response(blob);
    if (init.method === "HEAD") return new Response(null, { status: 404 });
    return new Response(null, { status: 204 });
  } });
  await cliente.enviar("id 1", blob);
  assert.equal(chamadas[0].init.headers.Authorization, "Bearer token-seguro");
  assert.equal(chamadas[0].init.headers["Content-Type"], "application/xml");
  assert.equal(chamadas[0].init.body, blob);
  assert.equal(await (await cliente.baixar("id 1")).text(), "xml");
  assert.equal(await cliente.existe("id 1"), false);
  await cliente.apagar("id 1");
  assert.match(chamadas[3].url, /id%201$/);
});

test("cliente explica falha de upload retornada pela API", async () => {
  const cliente = criarClienteArquivos({ auth: { currentUser: { async getIdToken() { return "token"; } } }, fetcher: async () => new Response(JSON.stringify({ error: "Bucket ausente" }), { status: 503 }) });
  await assert.rejects(() => cliente.enviar("a", new Blob(["x"])), /Bucket ausente/);
});
