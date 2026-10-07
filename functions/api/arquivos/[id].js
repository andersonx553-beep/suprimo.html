const MAX_BYTES = 25 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(["application/pdf", "application/xml", "text/xml", "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const EMAIL_AUTORIZADO = "andersonx553@gmail.com";
const resposta = (status, error) => new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const b64url = (valor) => Uint8Array.from(atob(valor.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(valor.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

async function verificarToken(request, env) {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("Entre com a conta Google autorizada.");
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("Sessão inválida. Entre novamente.");
  let cabecalho, claims;
  try { cabecalho = JSON.parse(new TextDecoder().decode(b64url(partes[0]))); claims = JSON.parse(new TextDecoder().decode(b64url(partes[1]))); } catch { throw new Error("Sessão inválida. Entre novamente."); }
  const agora = Math.floor(Date.now() / 1000), projeto = env.FIREBASE_PROJECT_ID;
  if (cabecalho.alg !== "RS256" || !cabecalho.kid || !projeto || claims.aud !== projeto || claims.iss !== `https://securetoken.google.com/${projeto}` || !claims.sub || claims.sub.length > 128 || claims.exp <= agora || claims.iat > agora || claims.auth_time > agora || claims.email?.toLowerCase() !== EMAIL_AUTORIZADO || claims.email_verified !== true) throw new Error("A conta ou a sessão não tem autorização para estes arquivos.");
  const key = new Request(JWKS_URL), cache = caches.default;
  let jwks = await cache.match(key);
  if (!jwks) { const upstream = await fetch(JWKS_URL); if (!upstream.ok) throw new Error("Não foi possível validar a sessão. Tente novamente."); jwks = new Response(await upstream.clone().text(), { headers: { "Cache-Control": "public, max-age=3600" } }); await cache.put(key, jwks.clone()); }
  const chave = (await jwks.json()).keys.find((k) => k.kid === cabecalho.kid && k.alg === "RS256");
  if (!chave) throw new Error("Chave de sessão inválida. Entre novamente.");
  const pub = await crypto.subtle.importKey("jwk", chave, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pub, b64url(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`))) throw new Error("Sessão inválida. Entre novamente.");
  return claims.sub;
}
async function tratar(request, context) {
  let uid; try { uid = await verificarToken(request, context.env); } catch (e) { return resposta(401, e.message); }
  const id = context.params.id;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id || "")) return resposta(400, "Identificador do arquivo inválido.");
  const bucket = context.env.ARQUIVOS; if (!bucket) return resposta(503, "Armazenamento de arquivos não configurado no Cloudflare Pages.");
  const key = `${uid}/${id}`;
  if (request.method === "PUT") {
    const tipo = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!MIME_PERMITIDOS.has(tipo)) return resposta(415, "Tipo de arquivo não permitido.");
    const corpo = await request.arrayBuffer(); if (!corpo.byteLength || corpo.byteLength > MAX_BYTES) return resposta(413, "O arquivo deve ter até 25 MB.");
    await bucket.put(key, corpo, { httpMetadata: { contentType: tipo, cacheControl: "private, no-store" } });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  if (request.method === "HEAD") {
    const objeto = await bucket.head(key);
    return new Response(null, { status: objeto ? 204 : 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (request.method === "GET") {
    const objeto = await bucket.get(key); if (!objeto) return resposta(404, "Arquivo não encontrado na nuvem.");
    const headers = new Headers(); objeto.writeHttpMetadata(headers); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.set("Content-Disposition", "inline");
    return new Response(objeto.body, { headers });
  }
  if (request.method === "DELETE") { await bucket.delete(key); return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }); }
  return resposta(405, "Método não permitido.");
}
export const onRequestPut = tratar;
export const onRequestGet = tratar;
export const onRequestHead = tratar;
export const onRequestDelete = tratar;
