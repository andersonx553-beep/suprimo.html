import test from "node:test";
import assert from "node:assert/strict";
import { montarFila } from "../js/dominio/hoje.js";
import { desempenho } from "../js/dominio/desempenho.js";
import { cnpjValido } from "../js/dominio/cnpj.js";

const hoje = "2026-10-10";
const forn = new Map([["f1", { nome: "Volt" }]]);
const cot = (extra) => ({ id: "c", numero: "COT-0001", titulo: "t", convites: [], propostas: [], decisao: {}, ...extra });

test("prazo vencido vem antes de convite sem resposta", () => {
  const fila = montarFila([cot({ status: "Aguardando propostas", prazoPropostas: "2026-10-08", convites: [{ fornecedorId: "f1", enviadoEm: "2026-10-01", respondeu: false }] })], forn, hoje);
  assert.deepEqual(fila.map((i) => i.motivo), ["Prazo vencido", "Sem resposta"]);
  assert.equal(fila[0].aba, "propostas");
  assert.equal(fila[1].aba, "convidados");
});

test("quem já respondeu não entra na fila; prazo distante também não", () => {
  const fila = montarFila([cot({ status: "Aguardando propostas", prazoPropostas: "2026-10-20", convites: [{ fornecedorId: "f1", enviadoEm: "2026-10-01", respondeu: true }] })], forn, hoje);
  assert.equal(fila.length, 0);
});

test("aprovação pendente e entrega atrasada aparecem", () => {
  const fila = montarFila([
    cot({ id: "a", status: "Aguardando aprovação" }),
    cot({ id: "b", status: "Comprada", entregaPrevista: "2026-10-07" }),
    cot({ id: "c", status: "Comprada", entregaPrevista: "2026-10-12" }),
  ], forn, hoje);
  assert.deepEqual(fila.map((i) => i.motivo), ["Entrega atrasada", "Aguardando o chefe"]);
});

test("desempenho conta convites, respostas e vitórias só em cotação aprovada", () => {
  const p = { id: "p1", fornecedorId: "f1" };
  const cs = [
    cot({ convites: [{ fornecedorId: "f1", respondeu: true }], propostas: [p], decisao: { modo: "unico", propostaId: "p1", aprovacao: { estado: "aprovada" } } }),
    cot({ convites: [{ fornecedorId: "f1", respondeu: false }] }),
    cot({ convites: [{ fornecedorId: "f1", respondeu: true }], propostas: [p], decisao: { modo: "unico", propostaId: "p1", aprovacao: { estado: "recusada" } } }),
  ];
  assert.deepEqual(desempenho("f1", cs), { convites: 3, respostas: 2, vitorias: 1 });
});

test("valida dígitos do CNPJ", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("11.222.333/0001-82"), false);
  assert.equal(cnpjValido("11111111111111"), false);
});
