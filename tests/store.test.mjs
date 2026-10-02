import test from "node:test";
import assert from "node:assert/strict";
import { criarStore } from "../src/state/store.js";
import { criarMemoria } from "../src/data/banco.js";
import { lerBackup } from "../src/data/esquema.js";

const novo = async () => { const s = criarStore(criarMemoria()); await s.iniciar(); return s; };

test("numera em sequência e não reaproveita número de cotação apagada", async () => {
  const s = await novo();
  const a = s.criarCotacao({ titulo: "A" });
  const b = s.criarCotacao({ titulo: "B" });
  await s.removerCotacao(b.id);
  assert.deepEqual([a.numero, s.criarCotacao({ titulo: "C" }).numero], ["COT-0001", "COT-0003"]);
});

test("mudança avisa quem assinou, e a silenciosa vem marcada", async () => {
  const s = await novo();
  const c = s.criarCotacao({ titulo: "A" });
  const avisos = [];
  s.assinar((m) => avisos.push(m));
  s.atualizarCotacao(c.id, (x) => { x.titulo = "B"; });
  s.atualizarCotacao(c.id, (x) => { x.titulo = "C"; }, { silencioso: true });
  assert.deepEqual(avisos.map((m) => !!m.silencioso), [false, true]);
  assert.equal(s.cotacao("COT-0001").titulo, "C");
});

test("persiste no adaptador e recarrega igual", async () => {
  const adaptador = criarMemoria();
  const s = criarStore(adaptador); await s.iniciar();
  s.criarCotacao({ titulo: "A" });
  s.salvarAjustes({ minPropostas: 2 });
  await new Promise((r) => setTimeout(r, 0));
  const s2 = criarStore(adaptador); await s2.iniciar();
  assert.equal(s2.estado.cotacoes.length, 1);
  assert.equal(s2.estado.ajustes.minPropostas, 2);
  assert.equal(s2.estado.ajustes.contadorCotacao, 1);
});

test("demonstração entra com numeração própria e sai sem sobrar nada", async () => {
  const s = await novo();
  s.criarCotacao({ titulo: "Minha" });
  await s.carregarExemplo();
  assert.deepEqual(s.estado.cotacoes.map((c) => c.numero), ["COT-0001", "COT-0002", "COT-0003"]);
  assert.equal(s.temExemplo(), true);
  await s.removerExemplo();
  assert.deepEqual([s.estado.cotacoes.length, s.estado.fornecedores.length, s.temExemplo()], [1, 0, false]);
});

test("backup exportado volta pela importação, e a demonstração é válida", async () => {
  const s = await novo();
  await s.carregarExemplo();
  const dados = lerBackup(JSON.stringify(s.exportar()));
  const s2 = await novo();
  await s2.importar(dados);
  assert.equal(s2.estado.cotacoes.length, 2);
  assert.equal(s2.estado.fornecedores.length, 3);
});

test("duplicar leva itens e convidados para um rascunho novo", async () => {
  const s = await novo();
  await s.carregarExemplo();
  const copia = s.duplicarCotacao(s.estado.cotacoes.at(-1).id);
  assert.deepEqual([copia.status, copia.itens.length, copia.convites.length, copia.propostas.length], ["rascunho", 5, 3, 0]);
});

test("apagar tudo zera dados e contador", async () => {
  const s = await novo();
  await s.carregarExemplo();
  await s.apagarTudo();
  assert.deepEqual([s.estado.cotacoes.length, s.estado.fornecedores.length, s.estado.ajustes.contadorCotacao], [0, 0, 0]);
});
