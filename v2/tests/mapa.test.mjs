import test from "node:test";
import assert from "node:assert/strict";
import { compararCotacao, calcularDivisao } from "../js/dominio/mapa.js";

const itens = [
  { id: "i1", descricao: "Tomada 20A", qtd: 10, un: "un" },
  { id: "i2", descricao: "Cabo 2,5 mm²", qtd: 100, un: "m" },
];
const prop = (id, precos, extra = {}) => ({ id, fornecedorId: "f" + id, precos, frete: 0, validade: "2030-01-01", ...extra });
const hoje = "2026-10-02";

test("marca o menor preço de cada linha", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 10 }, i2: { preco: 3 } }),
    prop("B", { i1: { preco: 8 }, i2: { preco: 4 } }),
  ] }, { hoje });
  assert.equal(r.colunas[0].celulas[0].menor, false);
  assert.equal(r.colunas[1].celulas[0].menor, true);
  assert.equal(r.colunas[0].celulas[1].menor, true);
  assert.equal(r.colunas[1].celulas[1].menor, false);
});

test("custo total soma itens e frete, sem erro de ponto flutuante", () => {
  const r = compararCotacao({ itens, propostas: [prop("A", { i1: { preco: 0.1 }, i2: { preco: 0.2 } }, { frete: 25.5 })] }, { hoje });
  const c = r.colunas[0];
  assert.equal(c.subtotal, 2100);
  assert.equal(c.frete, 2550);
  assert.equal(c.custoTotal, 4650);
});

test("frete pode virar a sugestão para outro fornecedor", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 10 }, i2: { preco: 3 } }, { frete: 200 }),
    prop("B", { i1: { preco: 11 }, i2: { preco: 3 } }, { frete: 0 }),
  ] }, { hoje });
  assert.equal(r.sugestaoId, "B");
});

test("proposta incompleta mostra 'não cotou' e fica fora da sugestão", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 10 }, i2: { preco: 3 } }),
    prop("B", { i1: { preco: 1 } }),
  ] }, { hoje });
  const b = r.colunas[1];
  assert.equal(b.celulas[1].estado, "naoCotou");
  assert.equal(b.incompleta, true);
  assert.equal(b.elegivel, false);
  assert.equal(r.sugestaoId, "A");
});

test("sem nenhuma proposta completa, não há sugestão", () => {
  const r = compararCotacao({ itens, propostas: [prop("A", { i1: { preco: 10 } })] }, { hoje });
  assert.equal(r.sugestaoId, null);
});

test("unidade diferente da pedida é sinalizada e não entra na comparação", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 10 }, i2: { preco: 3 } }),
    prop("B", { i1: { preco: 5 }, i2: { preco: 280, un: "rl" } }),
  ] }, { hoje });
  const b = r.colunas[1];
  assert.equal(b.celulas[1].estado, "unidadeDivergente");
  assert.equal(b.subtotal, 5000);
  assert.equal(r.colunas[0].celulas[1].menor, undefined);
  assert.equal(r.sugestaoId, "A");
});

test("'Und.' e 'un' contam como a mesma unidade", () => {
  const r = compararCotacao({ itens, propostas: [prop("A", { i1: { preco: 10, un: "Und." }, i2: { preco: 3 } })] }, { hoje });
  assert.equal(r.colunas[0].celulas[0].estado, "ok");
});

test("validade vencida é sinalizada; vence hoje ainda vale", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 1 }, i2: { preco: 1 } }, { validade: "2026-10-01" }),
    prop("B", { i1: { preco: 1 }, i2: { preco: 1 } }, { validade: "2026-10-02" }),
  ] }, { hoje });
  assert.equal(r.colunas[0].vencida, true);
  assert.equal(r.colunas[1].vencida, false);
});

test("avisa quando há menos propostas que o mínimo", () => {
  const um = { itens, propostas: [prop("A", { i1: { preco: 1 }, i2: { preco: 1 } })] };
  assert.equal(compararCotacao(um, { hoje, minPropostas: 3 }).poucasPropostas, true);
  assert.equal(compararCotacao(um, { hoje, minPropostas: 1 }).poucasPropostas, false);
});

test("avisa preço mais de 15% acima do último pago", () => {
  const ultimoPreco = { "tomada 20a": 10 };
  const r = compararCotacao({ itens, propostas: [prop("A", { i1: { preco: 11.6 }, i2: { preco: 1 } }), prop("B", { i1: { preco: 11.5 }, i2: { preco: 1 } })] }, { hoje, ultimoPreco });
  assert.ok(r.colunas[0].celulas[0].altaSobreUltimo);
  assert.equal(r.colunas[1].celulas[0].altaSobreUltimo, undefined);
});

test("vencedor por item soma o frete de cada fornecedor escolhido uma vez", () => {
  const r = compararCotacao({ itens, propostas: [
    prop("A", { i1: { preco: 10 }, i2: { preco: 4 } }, { frete: 20 }),
    prop("B", { i1: { preco: 12 }, i2: { preco: 3 } }, { frete: 30 }),
  ] }, { hoje });
  const d = calcularDivisao(r, { i1: "A", i2: "B" });
  assert.equal(d.totalItens, 10 * 10 * 100 + 100 * 3 * 100);
  assert.equal(d.totalFrete, 5000);
  assert.equal(d.faltaEscolher, 0);
  const parcial = calcularDivisao(r, { i1: "A" });
  assert.equal(parcial.faltaEscolher, 1);
});
