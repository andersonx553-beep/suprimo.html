import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { gerarOrcamentoXml, lerOrcamentoXml } from "../src/importacao/xml.js";
import { extrairDocumento, tipoDocumento } from "../src/importacao/ocr.js";

const bytes = (s) => new TextEncoder().encode(s);
const dados = {
  fornecedor: { razaoSocial: "Hidráulica A & B Ltda.", cnpj: "12345678000195", telefone: "(85) 3000-0101" },
  orcamento: { numero: "ORC-2026-104", emissao: "2026-10-07", validade: "2026-10-15" },
  condicoes: { prazoEntrega: "5 dias", pagamento: "boleto 30 dias", freteTipo: "CIF", freteCentavos: 3500,
    descontoCentavos: 0, subtotalCentavos: 107280, totalCentavos: 110780 },
  itens: [
    { numero: 1, codigo: "ABC-25", descricao: "Tubo PVC <soldável> 25 mm & 6 m", unidade: "UN", quantidade: 12, unitarioCentavos: 5000, totalCentavos: 60000 },
    { numero: 2, descricao: "Joelho 25 mm", unidade: "UN", quantidade: 40, unitarioCentavos: 290, totalCentavos: 11600 },
  ],
};

test("XML Suprimo: ida e volta preserva caracteres, datas e centavos", () => {
  const xml = gerarOrcamentoXml(dados);
  assert.match(xml, /A &amp; B/);
  assert.equal(tipoDocumento(bytes(xml)), "application/xml");
  const lido = lerOrcamentoXml(bytes(xml), { DOMParserImpl: DOMParser });
  assert.equal(lido.fornecedor.razaoSocial, dados.fornecedor.razaoSocial);
  assert.equal(lido.itens[0].descricao, dados.itens[0].descricao);
  assert.deepEqual(lido.itens.map((i) => [i.quantidade, i.unitarioCentavos, i.totalCentavos]), [[12,5000,60000],[40,290,11600]]);
  assert.deepEqual([lido.condicoes.freteCentavos, lido.condicoes.totalCentavos], [3500,110780]);
  assert.equal(lido.diagnostico.metodo, "xml");
});

test("XML entra no ponto de importação sem iniciar OCR", async () => {
  const antigo = globalThis.DOMParser;
  globalThis.DOMParser = DOMParser;
  try {
    const { dados: lido, tipo } = await extrairDocumento(bytes(gerarOrcamentoXml(dados)), { criarWorker: () => { throw Error("OCR indevido"); } });
    assert.equal(tipo, "application/xml");
    assert.equal(lido.itens.length, 2);
  } finally { globalThis.DOMParser = antigo; }
});

test("exemplo de cinco itens importa com frete e total conferidos", () => {
  const arquivo = new Uint8Array(fs.readFileSync(new URL("./fixtures/orcamento-hidraulica-exemplo.xml", import.meta.url)));
  const lido = lerOrcamentoXml(arquivo, { DOMParserImpl: DOMParser });
  assert.equal(lido.itens.length, 5);
  assert.equal(lido.orcamento.numero, "HN-2026-104");
  assert.equal(lido.itens.reduce((n, i) => n + i.totalCentavos, 0), 107280);
  assert.equal(lido.condicoes.subtotalCentavos + lido.condicoes.freteCentavos, lido.condicoes.totalCentavos);
});

test("XML estranho, entidades, valores malformados e datas inválidas são recusados", () => {
  const xml = gerarOrcamentoXml(dados), opts = { DOMParserImpl: DOMParser };
  for (const entrada of [
    xml.replace('versao="1"', 'versao="2"'),
    xml.replace("<orcamentoSuprimo", '<!DOCTYPE orcamentoSuprimo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><orcamentoSuprimo'),
    xml.replace("<totalCentavos>110780</totalCentavos>", "<totalCentavos>1.107,80</totalCentavos>"),
    xml.replace("<emissao>2026-10-07</emissao>", "<emissao>2026-02-31</emissao>"),
    xml.replace("<quantidade>12</quantidade>", "<quantidade>0</quantidade>"),
    "<?xml version='1.0'?><NFe/>",
  ]) assert.throws(() => lerOrcamentoXml(bytes(entrada), opts), (e) => e.codigo === "xml_invalido");
});
