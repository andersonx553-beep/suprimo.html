/** SHA-256 em hexadecimal. Precisa de contexto seguro (https ou localhost), como o resto do navegador moderno. */
export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("Este endereço não permite calcular o hash do arquivo. Abra o Suprimo por https ou localhost.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
