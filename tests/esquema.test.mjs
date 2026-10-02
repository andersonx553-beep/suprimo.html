import test from "node:test";
import assert from "node:assert/strict";
import { migrar, lerBackup, validarEstrutura, montarBackup, VERSAO_ATUAL, AJUSTES_PADRAO } from "../src/data/esquema.js";

const cotacaoOk = { id: "c1", numero: "COT-0001", itens: [], convites: [], propostas: [] };
const backupOk = (extra = {}) => JSON.stringify({ sistema: "suprimo", versaoEsquema: 1, cotacoes: [cotacaoOk], fornecedores: [{ id: "f", nome: "Volt" }], ...extra });

test("migra passo a passo até a versão alvo", () => {
  const migracoes = { 1: (d) => ({ ...d, a: 1 }), 2: (d) => ({ ...d, b: d.a + 1 }) };
  const r = migrar({ versaoEsquema: 1 }, migracoes, 3);
  assert.deepEqual([r.a, r.b, r.versaoEsquema], [1, 2, 3]);
});
test("dados sem versão contam como versão 1", () => {
  assert.equal(migrar({}, { 1: (d) => ({ ...d, ok: true }) }, 2).ok, true);
});
test("versão já atual passa sem mudar", () => {
  assert.equal(migrar({ versaoEsquema: VERSAO_ATUAL, x: 1 }).x, 1);
});
test("versão mais nova que o sistema é recusada com mensagem clara", () => {
  assert.throws(() => migrar({ versaoEsquema: 9 }), /versão mais nova/);
});
test("migração que falta é erro explícito", () => {
  assert.throws(() => migrar({ versaoEsquema: 1 }, {}, 2), /Não há migração do esquema 1 para 2/);
});

test("backup válido volta com ajustes completos", () => {
  const d = lerBackup(backupOk({ ajustes: { minPropostas: 2 } }));
  assert.equal(d.ajustes.minPropostas, 2);
  assert.equal(d.ajustes.prazoRespostaDias, AJUSTES_PADRAO.prazoRespostaDias);
});
test("arquivo que não é JSON", () => {
  assert.throws(() => lerBackup("<html>"), /não é um JSON válido/);
});
test("JSON de outro sistema", () => {
  assert.throws(() => lerBackup(JSON.stringify({ cotacoes: [] })), /não é um backup do Suprimo/);
});
test("preço fora de centavos inteiros é recusado", () => {
  const ruim = { ...cotacaoOk, propostas: [{ precos: { i1: { centavos: 18.9 } } }] };
  assert.throws(() => lerBackup(backupOk({ cotacoes: [ruim] })), /centavos inteiros/);
});
test("exportar e ler de novo preserva os dados", () => {
  const b = montarBackup({ cotacoes: [cotacaoOk], fornecedores: [{ id: "f", nome: "V" }], ajustes: AJUSTES_PADRAO });
  assert.deepEqual(validarEstrutura(b), []);
  assert.equal(lerBackup(JSON.stringify(b)).cotacoes[0].numero, "COT-0001");
});
