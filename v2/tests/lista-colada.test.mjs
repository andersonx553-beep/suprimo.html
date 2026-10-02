import test from "node:test";
import assert from "node:assert/strict";
import { lerListaColada } from "../js/dominio/lista-colada.js";

test("quantidade, descrição e unidade padrão", () => {
  assert.deepEqual(lerListaColada("20 tomada 20A"), [{ qtd: 20, un: "un", descricao: "tomada 20A", conferir: false }]);
});

test("reconhece a unidade depois da quantidade", () => {
  const [i] = lerListaColada("100 m cabo 2,5 mm²");
  assert.deepEqual([i.qtd, i.un, i.descricao], [100, "m", "cabo 2,5 mm²"]);
});

test("aceita 'de', 'x', marcadores e unidades por extenso", () => {
  const r = lerListaColada("- 10 caixas de parafuso M6\n5x disjuntor 20A\n3 rolos fita isolante");
  assert.deepEqual(r.map((i) => [i.qtd, i.un, i.descricao]), [
    [10, "cx", "parafuso M6"], [5, "un", "disjuntor 20A"], [3, "rl", "fita isolante"],
  ]);
});

test("quantidade decimal e milhar", () => {
  const r = lerListaColada("2,5 kg solda\n1.000 un abraçadeira");
  assert.deepEqual(r.map((i) => i.qtd), [2.5, 1000]);
});

test("linhas vazias somem e linha sem quantidade pede conferência", () => {
  const r = lerListaColada("\n  \nluva de raspa\n");
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].qtd, r[0].un, r[0].conferir], [1, "un", true]);
});

test("número que faz parte da descrição não vira unidade", () => {
  const [i] = lerListaColada("4 lâmpada led 9W");
  assert.deepEqual([i.qtd, i.un, i.descricao], [4, "un", "lâmpada led 9W"]);
});
