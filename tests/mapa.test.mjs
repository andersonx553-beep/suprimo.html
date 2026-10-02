import test from "node:test";
import assert from "node:assert/strict";
import { compararCotacao, calcularDivisao, melhorPorItem } from "../src/domain/mapa.js";
import { resumirDecisao, justificativaObrigatoria, problemasDaDecisao } from "../src/domain/decisao.js";

const itens = [
  { id: "i1", descricao: "Tomada 20A", quantidade: 10, unidade: "un" },
  { id: "i2", descricao: "Cabo 2,5 mm²", quantidade: 100, unidade: "m" },
];
const prop = (id, precos, extra = {}) => ({
  id, fornecedorId: `f${id}`, freteCentavos: 0, prazoEntregaDias: 5, validade: "2030-01-01",
  precos: Object.fromEntries(Object.entries(precos).map(([k, v]) => [k, typeof v === "number" ? { centavos: v } : v])), ...extra,
});
const hoje = "2026-10-02";
const comparar = (propostas, extra = {}) => compararCotacao({ itens, propostas }, { hoje, ...extra });

test("marca o menor preço de cada linha", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }), prop("B", { i1: 800, i2: 400 })]);
  assert.equal(r.colunas[1].celulas[0].menor, true);
  assert.equal(r.colunas[0].celulas[0].menor, false);
  assert.equal(r.colunas[0].celulas[1].menor, true);
});

test("linha com um só preço comparável não marca menor", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }), prop("B", { i1: 800 })]);
  assert.equal(r.colunas[0].celulas[1].menor, undefined);
});

test("custo total soma itens e frete em centavos exatos", () => {
  const r = comparar([prop("A", { i1: 10, i2: 20 }, { freteCentavos: 2550 })]);
  const c = r.colunas[0];
  assert.deepEqual([c.subtotal, c.freteCentavos, c.custoTotal], [2100, 2550, 4650]);
});

test("o frete pode trocar o vencedor", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }, { freteCentavos: 20000 }), prop("B", { i1: 1100, i2: 300 })]);
  assert.equal(r.sugestaoId, "B");
});

test("empate no custo total vai para o menor prazo de entrega", () => {
  const r = comparar([
    prop("A", { i1: 1000, i2: 300 }, { prazoEntregaDias: 7 }),
    prop("B", { i1: 1000, i2: 300 }, { prazoEntregaDias: 2 }),
  ]);
  assert.equal(r.sugestaoId, "B");
});

test("incompleta mostra 'não cotou' e fica fora da sugestão", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }), prop("B", { i1: 100 })]);
  assert.equal(r.colunas[1].celulas[1].estado, "naoCotou");
  assert.equal(r.colunas[1].incompleta, true);
  assert.equal(r.sugestaoId, "A");
});

test("sem nenhuma proposta completa, não há sugestão", () => {
  assert.equal(comparar([prop("A", { i1: 1000 })]).sugestaoId, null);
});

test("unidade diferente é sinalizada, não entra na linha e tira a proposta da sugestão", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }), prop("B", { i1: 500, i2: { centavos: 28000, unidade: "rl" } })]);
  const b = r.colunas[1];
  assert.equal(b.celulas[1].estado, "unidadeDivergente");
  assert.equal(b.subtotal, 5000);
  assert.equal(r.colunas[0].celulas[1].menor, undefined);
  assert.equal(r.sugestaoId, "A");
});

test("'Und.' e 'un' contam como a mesma unidade", () => {
  const r = comparar([prop("A", { i1: { centavos: 1000, unidade: "Und." }, i2: 300 })]);
  assert.equal(r.colunas[0].celulas[0].estado, "ok");
});

test("validade vencida é sinalizada; vencer hoje ainda vale", () => {
  const r = comparar([prop("A", { i1: 1, i2: 1 }, { validade: "2026-10-01" }), prop("B", { i1: 1, i2: 1 }, { validade: "2026-10-02" })]);
  assert.deepEqual(r.colunas.map((c) => c.vencida), [true, false]);
});

test("avisa quando há menos propostas que o mínimo, sem bloquear", () => {
  const uma = [prop("A", { i1: 1, i2: 1 })];
  assert.equal(comparar(uma, { minPropostas: 3 }).poucasPropostas, true);
  assert.equal(comparar(uma, { minPropostas: 1 }).poucasPropostas, false);
  assert.equal(comparar(uma, { minPropostas: 3 }).sugestaoId, "A");
});

test("avisa preço mais de 15% acima do último pago", () => {
  const ultimoPreco = new Map([["tomada 20a", { centavos: 1000 }]]);
  const r = comparar([prop("A", { i1: 1160, i2: 1 }), prop("B", { i1: 1150, i2: 1 })], { ultimoPreco });
  assert.ok(r.colunas[0].celulas[0].altaSobreUltimo);
  assert.equal(r.colunas[1].celulas[0].altaSobreUltimo, undefined);
});

test("compra dividida: frete de cada fornecedor entra uma vez; incompleta pode ganhar o que cotou", () => {
  const r = comparar([
    prop("A", { i1: 1000, i2: 400 }, { freteCentavos: 2000 }),
    prop("B", { i2: 300 }, { freteCentavos: 3000 }),
  ]);
  assert.equal(r.colunas[1].incompleta, true);
  const d = calcularDivisao(r, { i1: "A", i2: "B" });
  assert.equal(d.totalItens, 10 * 1000 + 100 * 300);
  assert.equal(d.totalFrete, 5000);
  assert.equal(d.custoTotal, 45000);
  assert.equal(calcularDivisao(r, { i1: "A", i2: "A" }).fretes.length, 1);
  assert.equal(calcularDivisao(r, { i1: "A" }).faltaEscolher, 1);
});

test("melhor por item escolhe o menor preço comparável", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 400 }), prop("B", { i1: 900 })]);
  assert.deepEqual(melhorPorItem(r), { i1: "B", i2: "A" });
});

test("justificativa é obrigatória quando não é o menor custo total", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 300 }), prop("B", { i1: 1200, i2: 300 })]);
  const sugerida = { modo: "unico", propostaId: "A", justificativa: "" };
  const outra = { modo: "unico", propostaId: "B", justificativa: "" };
  assert.equal(justificativaObrigatoria(r, sugerida), false);
  assert.equal(justificativaObrigatoria(r, outra), true);
  assert.equal(problemasDaDecisao(r, outra).length, 1);
  assert.equal(problemasDaDecisao(r, { ...outra, justificativa: "Entrega mais rápida" }).length, 0);
});

test("compra dividida mais barata que a sugestão não exige justificativa", () => {
  const r = comparar([prop("A", { i1: 1000, i2: 400 }), prop("B", { i1: 900, i2: 500 })]);
  const d = { modo: "porItem", porItem: { i1: "B", i2: "A" }, justificativa: "" };
  assert.equal(resumirDecisao(r, d).custoTotal, 9000 + 40000);
  assert.equal(justificativaObrigatoria(r, d), false);
});

test("fornecedor único precisa ter cotado tudo", () => {
  const r = comparar([prop("A", { i1: 1000 })]);
  assert.equal(problemasDaDecisao(r, { modo: "unico", propostaId: "A", justificativa: "x" }).length, 1);
});

test("100 itens e 8 propostas calculam em poucos milissegundos", () => {
  const muitos = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, descricao: `Item ${i}`, quantidade: 3, unidade: "un" }));
  const propostas = Array.from({ length: 8 }, (_, p) => prop(`P${p}`, Object.fromEntries(muitos.map((m, i) => [m.id, 1000 + p * 7 + i]))));
  const t0 = performance.now();
  const r = compararCotacao({ itens: muitos, propostas }, { hoje });
  assert.ok(performance.now() - t0 < 100);
  assert.equal(r.sugestaoId, "P0");
});
