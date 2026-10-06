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
  assert.doesNotMatch(texto, /Assinatura do síndico/);
});

test("fornecedor escolhido e assinatura do síndico saem no PDF, sem pedido automático", () => {
  const c = cot(); c.status = "decidida"; c.decisao = { modo: "unico", propostaId: "p1", justificativa: "", decididaEm: "2026-10-06T10:00:00Z" };
  const texto = imprimir(c);
  assert.match(texto, /Fornecedor selecionado para aprovação do síndico: Fornecedor Teste/);
  assert.match(texto, /Assinatura do síndico/);
  assert.match(texto, /fora do Suprimo/);
  assert.match(texto, /Manta alumínio 4 mm/);
  assert.doesNotMatch(texto, /Chefe do almoxarifado · autorizo a compra/);
});
