import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { onRequestGet, onRequestPut } from "../functions/api/arquivos/[id].js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "teste-kid", alg: "RS256", use: "sig" };
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
function token(overrides = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", kid: "teste-kid", typ: "JWT" });
  const claims = encode({ aud: "suprimo-fb90d", iss: "https://securetoken.google.com/suprimo-fb90d", sub: "uid-teste", iat: agora, auth_time: agora, exp: agora + 3600, email: "andersonx553@gmail.com", email_verified: true, ...overrides });
  const signed = `${header}.${claims}`;
  return `${signed}.${sign("RSA-SHA256", Buffer.from(signed), privateKey).toString("base64url")}`;
}
function setup() {
  const dados = new Map(), chaveCache = new Map();
  globalThis.caches = { default: { async match(r) { return chaveCache.get(r.url)?.clone(); }, async put(r, v) { chaveCache.set(r.url, v.clone()); } } };
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { "Cache-Control": "public, max-age=300" } });
  const bucket = { async put(k, v, options) { dados.set(k, { v, type: options.httpMetadata.contentType }); }, async get(k) { const x = dados.get(k); return x && { body: new Blob([x.v]).stream(), writeHttpMetadata(h) { h.set("Content-Type", x.type); } }; }, async head(k) { return dados.has(k) ? {} : null; }, async delete(k) { dados.delete(k); } };
  const context = (id = "f1") => ({ env: { ARQUIVOS: bucket, FIREBASE_PROJECT_ID: "suprimo-fb90d" }, params: { id } });
  return { dados, context };
}

test("Pages API valida token e grava/entrega arquivo apenas no prefixo autenticado", async () => {
  const { dados, context } = setup();
  const put = await onRequestPut(new Request("https://suprimo.test/api/arquivos/f1", { method: "PUT", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/pdf" }, body: "%PDF" }), context());
  assert.equal(put.status, 204);
  assert.equal(dados.has("uid-teste/f1"), true);
  const get = await onRequestGet(new Request("https://suprimo.test/api/arquivos/f1", { headers: { Authorization: `Bearer ${token()}` } }), context());
  assert.equal(await get.text(), "%PDF");
  const errado = await onRequestGet(new Request("https://suprimo.test/api/arquivos/f1", { headers: { Authorization: `Bearer ${token({ sub: "uid-outro" })}` } }), context());
  assert.equal(errado.status, 404);
});

test("Pages API rejeita token válido com e-mail de outra conta antes de tocar no bucket", async () => {
  const { dados, context } = setup();
  const r = await onRequestPut(new Request("https://suprimo.test/api/arquivos/f1", { method: "PUT", headers: { Authorization: `Bearer ${token({ email: "outro@example.com" })}`, "Content-Type": "application/pdf" }, body: "%PDF" }), context());
  assert.equal(r.status, 401);
  assert.equal(dados.size, 0);
});

test("Pages API identifica PDF quando o celular envia MIME genérico", async () => {
  const { dados, context } = setup();
  const r = await onRequestPut(new Request("https://suprimo.test/api/arquivos/gen", { method: "PUT", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/octet-stream" }, body: "%PDF-1.7\nconteudo" }), context("gen"));
  assert.equal(r.status, 204);
  assert.equal(dados.get("uid-teste/gen").type, "application/pdf");
});
