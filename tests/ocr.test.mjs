import test from "node:test";
import assert from "node:assert/strict";
import { tipoDocumento, extrairDocumento, trechosOcr } from "../src/importacao/ocr.js";
import { itensPorTextoOcr, completarDadosOcr } from "../src/importacao/ocr-texto.js";
import { validarOrcamento } from "../src/importacao/validar.js";

test("identifica PDF, PNG e JPG pelos bytes e rejeita outros formatos", () => {
  assert.equal(tipoDocumento(new TextEncoder().encode("%PDF-1.7\n")), "application/pdf");
  assert.equal(tipoDocumento(Uint8Array.from([137,80,78,71,13,10,26,10,0])), "image/png");
  assert.equal(tipoDocumento(Uint8Array.from([255,216,255,224,0])), "image/jpeg");
  assert.equal(tipoDocumento(new TextEncoder().encode("arquivo falso")), null);
});

test("linhas de dois layouts OCR preservam preço de três casas e verificam multiplicação", () => {
  const texto = `1 | IMPERMANTA MAX 3MM - ROLO 1 X 10 M | UNID. 24 | R$ 275,000 | R$ 6.600,00
2 | IMPERMANTA MAX ALUMINIO 4MM | UNID. 34 | R$ 409,000 | R$ 13.906,00
3 | PRIMER ACQUA 18 L | UNID. 5 | R$ 165,000 | R$ 825,00
1021369 SSH P34 ALU TIPO II 4MM SIKA UN 34 R$ 464,630 R$ 15.797,42
1027936 SSH P44 PE TIPO II 3MM SIKA UN 24 R$ 351,140 R$ 8.427,36
021059 SIKA ECO PRIMER BD 18L UN 5 R$ 159,000 R$ 795,00`;
  const itens = itensPorTextoOcr(texto);
  assert.equal(itens.length, 6);
  assert.deepEqual(itens.map((i) => i.totalCentavos), [660000,1390600,82500,1579742,842736,79500]);
  assert.deepEqual(itens.map((i) => i.unitarioCentavos), [27500,40900,16500,46463,35114,15900]);
  assert.equal(itens[3].codigo, "1021369");
});

test("a conferência OCR permanece visível mesmo quando os totais fecham", () => {
  const d = { fornecedor: {}, orcamento: {}, condicoes: {}, itens: [], diagnostico: { metodo: "ocr" } };
  assert.ok(validarOrcamento(d, { hoje: "2026-10-06" }).some((a) => a.id === "ocr-conferencia"));
  completarDadosOcr(d, "PROPOSTA COMERCIAL 951/2026 30/09/2026\nCOND. DE PAGAMENTO: 30/60 DIAS\nTOTAL R$ 21.331,00");
  assert.equal(d.orcamento.numero, "951/2026");
  assert.equal(d.orcamento.emissao, "2026-09-30");
  assert.equal(d.condicoes.totalCentavos, 2133100);
});

test("caixas OCR geram trechos posicionados por página", () => {
  const data = { blocks: [{ paragraphs: [{ lines: [{ bbox: {y1: 40}, words: [{ text: "PROPOSTA", bbox: {x0: 20,x1: 100,y0: 15,y1: 40} }] }] }] }] };
  assert.deepEqual(trechosOcr(data, 2, 1200), [{ p:2, x:10, x2:50, y:20, h:12.5, texto:"PROPOSTA" }]);
});

test("rejeita imagem ilegível antes de iniciar OCR", async () => {
  await assert.rejects(() => extrairDocumento(new TextEncoder().encode("texto puro")), (e) => e.codigo === "invalido");
});
