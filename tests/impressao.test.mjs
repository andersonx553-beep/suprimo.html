import test from "node:test";
import assert from "node:assert/strict";
import { compararCotacao } from "../src/domain/mapa.js";
import { folhaImpressao } from "../src/ui/componentes/folha-impressao.js";

const cot = () => ({
  numero: "COT-0001", titulo: "Materiais", solicitante: "Almoxarifado", destino: "Condomínio", status: "em_analise", decisao: null,
  itens: [{ id: "i1", descricao: "Manta 4 mm", quantidade: 2, unidade: "un" }],
  propostas: [{ id: "p1", fornecedorId: "f1", precos: { i1: { centavos: 4000 } }, freteCentavos: 0, descontoCentavos: 0,
    pagamento: { texto: "Boleto 30 dias", dias: 30 }, validadeTexto: "5 dias", orcamento: { numero: "48", itens: [{ descricao: "Manta alumínio 4 mm", quantidade: 2, unidade: "UN", unitarioCentavos: 4000, itemId: "i1" }] } }],
});
const forn = new Map([["f1", { nome: "Fornecedor Teste" }]]);
const ajustes = { empresa: { nome: "Condomínio" }, minPropostas: 1 };
const imprimir = (c) => folhaImpressao({ cot: c, res: compararCotacao(c, { hoje: "2026-10-06", minPropostas: 1 }), forn, ajustes }).toString();

test("rascunho não traz assinatura de aprovação", () => {
  const texto = imprimir(cot());
  assert.match(texto, /RASCUNHO/);
  assert.match(texto, /Forma de pagamento/);
  assert.match(texto, /A definir após escolha da proposta/);
  assert.doesNotMatch(texto, /Visto síndico/);
});

test("fornecedor escolhido e assinatura do síndico saem no PDF, sem pedido automático", () => {
  const c = cot(); c.status = "decidida"; c.decisao = { modo: "unico", propostaId: "p1", justificativa: "", decididaEm: "2026-10-06T10:00:00Z" };
  const texto = imprimir(c);
  assert.match(texto, /Fornecedor indicado para aprovação: Fornecedor Teste/);
  assert.match(texto, /assets\/aquaville-logo\.png/);
  assert.match(texto, /data-itens="1"/);
  assert.match(texto, /Solicitante/);
  assert.match(texto, /Solicitante<\/strong><span>Condomínio<\/span>/);
  assert.match(texto, /Cotação feita por/);
  assert.match(texto, /Boleto 30 dias/);
  assert.doesNotMatch(texto, /Boleto 30 dias · 30 dias/);
  assert.match(texto, /Visto supervisor/);
  assert.match(texto, /Visto síndico/);
  assert.match(texto, /Rubrica/);
  assert.match(texto, /Destino/);
  assert.match(texto, /O pedido será feito posteriormente pelo responsável/);
  assert.match(texto, /Orçamento 48/);
  assert.doesNotMatch(texto, /Manta alumínio 4 mm/);
  assert.doesNotMatch(texto, /Chefe do almoxarifado · autorizo a compra/);
});

test("na compra dividida, identifica os itens escolhidos direto na tabela", () => {
  const c = cot();
  c.propostas.push({ id: "p2", fornecedorId: "f2", precos: { i1: { centavos: 3500 } }, freteCentavos: 0, descontoCentavos: 0, pagamento: { texto: "Pix", dias: null }, validadeTexto: "7 dias", orcamento: { numero: "49", itens: [{ descricao: "Manta 4 mm", quantidade: 2, unidade: "UN", unitarioCentavos: 3500, itemId: "i1" }] } });
  c.status = "decidida";
  c.decisao = { modo: "porItem", porItem: { i1: "p2" }, justificativa: "", decididaEm: "2026-10-06T10:00:00Z" };
  const texto = folhaImpressao({ cot: c, res: compararCotacao(c, { hoje: "2026-10-06", minPropostas: 1 }), forn: new Map([...forn, ["f2", { nome: "Outro Fornecedor" }]]), ajustes }).toString();
  assert.match(texto, /Compra dividida/);
  assert.match(texto, /data-selecionada="true"/);
  assert.match(texto, /Escolhido/);
  assert.match(texto, /Conforme fornecedores e itens escolhidos no mapa comparativo/);
  assert.match(texto, /Visto supervisor/);
  assert.match(texto, /Visto síndico/);
});

test("usa o endereço Aquaville da folha quando a cotação não define outro destino", () => {
  const c = cot(); c.destino = "";
  const texto = imprimir(c);
  assert.match(texto, /Av\. Mar Mediterrâneo, 202 - Porto das Dunas, Aquiraz\/CE/);
});

test("a folha declara A4 paisagem e calcula redução para listas longas", async () => {
  const fs = await import("node:fs/promises");
  const css = await fs.readFile(new URL("../src/styles/main.css", import.meta.url), "utf8");
  assert.match(css, /@page\s*\{\s*size:\s*297mm 210mm;\s*margin:\s*4mm/);
  const cssImpressao = await fs.readFile(new URL("../src/styles/print.css", import.meta.url), "utf8");
  assert.match(cssImpressao, /zoom:\s*var\(--folha-escala,\s*1\)/);
  const c = cot();
  c.itens = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, descricao: `Item ${i}`, quantidade: 1, unidade: "un" }));
  c.propostas[0].precos = Object.fromEntries(c.itens.map((item) => [item.id, { centavos: 1000 }]));
  const texto = imprimir(c);
  assert.match(texto, /data-itens="30"/);
  assert.match(texto, /--folha-escala:\s*0\.7333333333333333/);
});