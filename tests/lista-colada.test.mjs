import test from "node:test";
import assert from "node:assert/strict";
import { lerListaColada } from "../src/domain/lista-colada.js";

const ler = (t) => lerListaColada(t).map((i) => [i.quantidade, i.unidade, i.descricao, i.conferir]);

test("quantidade, descrição e unidade padrão", () => {
  assert.deepEqual(ler("20 tomada 20A"), [[20, "un", "tomada 20A", false]]);
});
test("unidade depois da quantidade", () => {
  assert.deepEqual(ler("100 m cabo 2,5 mm²"), [[100, "m", "cabo 2,5 mm²", false]]);
});
test("descrição - quantidade unidade", () => {
  assert.deepEqual(ler("cimento CP II 50kg - 30 sc"), [[30, "sc", "cimento CP II 50kg", false]]);
});
test("aceita 'de', 'x', marcadores e unidades por extenso", () => {
  assert.deepEqual(ler("- 10 caixas de parafuso M6\n5x disjuntor 20A\n3 rolos fita isolante"), [
    [10, "cx", "parafuso M6", false], [5, "un", "disjuntor 20A", false], [3, "rl", "fita isolante", false],
  ]);
});
test("quantidade decimal e milhar", () => {
  assert.deepEqual(ler("2,5 kg solda\n1.000 un abraçadeira").map((i) => i[0]), [2.5, 1000]);
});
test("linhas vazias somem; linha sem quantidade pede conferência", () => {
  assert.deepEqual(ler("\n  \nluva de raspa\n"), [[1, "un", "luva de raspa", true]]);
});
test("número que é parte da descrição não vira unidade", () => {
  assert.deepEqual(ler("4 lâmpada led 9W"), [[4, "un", "lâmpada led 9W", false]]);
});
test("fim de linha com traço e texto que não é unidade vira conferência", () => {
  assert.equal(lerListaColada("tinta - branca")[0].conferir, true);
});
