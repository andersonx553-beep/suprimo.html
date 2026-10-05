// Roda extrairOrcamento no PDF de fixtures e compara com o gabarito, campo por campo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extrairOrcamento, ErroOrcamento } from "../src/importacao/extrair.js";

const pdf = new Uint8Array(fs.readFileSync(new URL("./fixtures/orcamento-ponto-hidro-texto.pdf", import.meta.url)));
const gabarito = JSON.parse(fs.readFileSync(new URL("./fixtures/gabarito-orcamento-ponto-hidro.json", import.meta.url), "utf8"));

/** { "fornecedor.cnpj": "...", "itens.0.descricao": "..." } */
function achatar(obj, prefixo = "", saida = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object") achatar(v, caminho, saida); else saida[caminho] = v;
  }
  return saida;
}

const resultado = await extrairOrcamento(pdf, { pdfjs });
const esperado = achatar(gabarito);
const obtido = achatar(resultado);

for (const [campo, valor] of Object.entries(esperado)) {
  test(`gabarito: ${campo}`, () => assert.deepEqual(obtido[campo], valor));
}

test("resumo do gabarito: quantos campos bateram", () => {
  const falhas = Object.entries(esperado).filter(([k, v]) => JSON.stringify(obtido[k]) !== JSON.stringify(v)).map(([k, v]) => `${k}: esperado ${JSON.stringify(v)}, obtido ${JSON.stringify(obtido[k])}`);
  const total = Object.keys(esperado).length;
  process.stdout.write(`\n# GABARITO: ${total - falhas.length} de ${total} campos bateram${falhas.length ? "\n# FALHARAM:\n#   " + falhas.join("\n#   ") : ""}\n`);
  assert.equal(falhas.length, 0);
});

test("a coluna de fotos é ignorada (o texto 'PVC' dentro da imagem não vira item)", () => {
  assert.equal(resultado.itens.length, 10);
  assert.ok(resultado.itens.every((i) => i.descricao !== "PVC" && !i.descricao.startsWith("PVC ")));
});

test("'1.000 L' na descrição não é valor em dinheiro", () => {
  const caixa = resultado.itens.find((i) => i.codigo === "CX-POL-1000");
  assert.equal(caixa.descricao, "Caixa d'água polietileno 1.000 L com tampa - Fortlev");
  assert.equal(caixa.quantidade, 1);
  assert.equal(caixa.unitarioCentavos, 48900);
});

test("desconto com '–' é subtração: sai positivo e entra subtraindo no total", () => {
  const c = resultado.condicoes;
  assert.equal(c.descontoCentavos, 8830);
  assert.equal(c.subtotalCentavos - c.descontoCentavos + c.freteCentavos, c.totalCentavos);
});

test("arquivo que não é PDF é recusado com mensagem clara", async () => {
  await assert.rejects(() => extrairOrcamento(new TextEncoder().encode("isto é um texto qualquer, não um PDF"), { pdfjs }), (e) => e instanceof ErroOrcamento && e.codigo === "invalido" && /não é um PDF/.test(e.message));
});

test("PDF acima de 10 MB é recusado", async () => {
  const grande = new Uint8Array(10 * 1024 * 1024 + 1); grande.set(new TextEncoder().encode("%PDF-1.4"));
  await assert.rejects(() => extrairOrcamento(grande, { pdfjs }), (e) => e.codigo === "grande");
});

test("PDF corrompido dá erro útil, não trava", async () => {
  await assert.rejects(() => extrairOrcamento(new TextEncoder().encode("%PDF-1.4\nlixo sem estrutura"), { pdfjs }), (e) => e instanceof ErroOrcamento && e.codigo === "corrompido");
});

test("PDF com senha: mensagem clara, sem tentar abrir", async () => {
  const comSenha = new Uint8Array(fs.readFileSync(new URL("./fixtures/orcamento-com-senha.pdf", import.meta.url)));
  await assert.rejects(() => extrairOrcamento(comSenha, { pdfjs }), (e) => e instanceof ErroOrcamento && e.codigo === "senha" && /tem senha/.test(e.message));
});

test("PDF digitalizado (só imagem): avisa que precisa de OCR e para, sem simular leitura", async () => {
  const imagem = new Uint8Array(fs.readFileSync(new URL("./fixtures/orcamento-digitalizado.pdf", import.meta.url)));
  await assert.rejects(() => extrairOrcamento(imagem, { pdfjs }), (e) => e instanceof ErroOrcamento && e.codigo === "sem_texto" && /precisa de OCR/.test(e.message));
});
