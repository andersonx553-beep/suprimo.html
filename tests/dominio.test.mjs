import test from "node:test";
import assert from "node:assert/strict";
import { lerCentavos, totalLinha } from "../src/domain/dinheiro.js";
import { proximoNumero } from "../src/domain/numeracao.js";
import { cnpjValido } from "../src/domain/cnpj.js";
import { montarFila } from "../src/domain/fila.js";
import { desempenho } from "../src/domain/desempenho.js";
import { ultimosPrecosPagos } from "../src/domain/precos.js";
import { duplicarCotacao } from "../src/domain/duplicar.js";
import { montarMensagem, linkWhatsapp, linkMaps, MODELO_PADRAO } from "../src/domain/convite.js";
import { proximoPasso, voltar } from "../src/domain/status.js";

test("lê reais em centavos", () => {
  assert.equal(lerCentavos("18,90"), 1890);
  assert.equal(lerCentavos("R$ 1.250,5"), 125050);
  assert.equal(lerCentavos("0,1") + lerCentavos("0,2"), 30);
  assert.equal(lerCentavos(""), null);
  assert.equal(lerCentavos("abc"), null);
  assert.equal(totalLinha(1890, 2.5), 4725);
});

test("numeração só avança", () => {
  assert.deepEqual(proximoNumero(0), { numero: "COT-0001", contador: 1 });
  assert.deepEqual(proximoNumero(41), { numero: "COT-0042", contador: 42 });
  assert.equal(proximoNumero(undefined).numero, "COT-0001");
});

test("valida CNPJ", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("11.222.333/0001-82"), false);
  assert.equal(cnpjValido("00000000000000"), false);
});

const hoje = "2026-10-10";
const forn = new Map([["f1", { nome: "Volt" }]]);
const cot = (extra) => ({ id: "c", numero: "COT-0001", titulo: "t", convites: [], propostas: [], decisao: null, ...extra });

test("fila: prazo vencido antes de convite sem resposta, e cada linha aponta a aba certa", () => {
  const fila = montarFila([cot({ status: "aguardando_propostas", prazoPropostas: "2026-10-08",
    convites: [{ fornecedorId: "f1", situacao: "enviado", enviadoEm: "2026-10-05T10:00:00Z" }] })], forn, hoje);
  assert.deepEqual(fila.map((i) => [i.motivo, i.aba]), [["Prazo vencido", "propostas"], ["Sem resposta", "fornecedores"]]);
});
test("fila: quem respondeu e prazo distante não aparecem; esperando decisão aparece", () => {
  const fila = montarFila([
    cot({ id: "a", status: "aguardando_propostas", prazoPropostas: "2026-10-20", convites: [{ fornecedorId: "f1", situacao: "respondeu", enviadoEm: "2026-10-05T10:00:00Z" }] }),
    cot({ id: "b", status: "em_analise" }),
    cot({ id: "c", status: "concluida" }),
  ], forn, hoje);
  assert.deepEqual(fila.map((i) => [i.cotacaoId, i.motivo]), [["b", "Esperando decisão"]]);
});

test("desempenho: vitória só conta em cotação decidida ou concluída", () => {
  const p = { id: "p1", fornecedorId: "f1" };
  const convite = (situacao) => [{ fornecedorId: "f1", situacao }];
  const cs = [
    cot({ status: "concluida", convites: convite("respondeu"), propostas: [p], decisao: { modo: "unico", propostaId: "p1" } }),
    cot({ status: "aguardando_propostas", convites: convite("enviado") }),
    cot({ status: "em_analise", convites: convite("respondeu"), propostas: [p], decisao: { modo: "unico", propostaId: "p1" } }),
  ];
  assert.deepEqual(desempenho("f1", cs), { convites: 3, respostas: 2, vitorias: 1 });
});

test("último preço pago vem só de cotações concluídas, o mais recente vence", () => {
  const base = (num, status, concluidaEm, centavos) => cot({ numero: num, status, concluidaEm, itens: [{ id: "i", descricao: "Tomada 20A" }],
    propostas: [{ id: "p", fornecedorId: "f1", precos: { i: { centavos } } }], decisao: { modo: "unico", propostaId: "p" } });
  const m = ultimosPrecosPagos([base("COT-2", "concluida", "2026-09-01", 1500), base("COT-1", "concluida", "2026-05-01", 1000), base("COT-3", "decidida", "", 9999)]);
  assert.equal(m.get("tomada 20a").centavos, 1500);
});

test("duplicar copia itens e convidados e zera propostas e decisão", () => {
  let n = 0;
  const origem = cot({ titulo: "Elétrica", itens: [{ id: "x", descricao: "a", quantidade: 1, unidade: "un", especificacao: "" }],
    convites: [{ id: "c1", fornecedorId: "f1", situacao: "respondeu", enviadoEm: "z", canal: "email" }],
    propostas: [{ id: "p" }], decisao: { modo: "unico" }, status: "concluida" });
  const nova = duplicarCotacao(origem, { id: "n", numero: "COT-0002", agora: "2026-10-02T10:00:00Z", novoId: () => `id${++n}`, prazoPropostas: "2026-10-05" });
  assert.equal(nova.status, "rascunho");
  assert.equal(nova.titulo, "Elétrica (cópia)");
  assert.notEqual(nova.itens[0].id, "x");
  assert.deepEqual([nova.propostas.length, nova.decisao, nova.convites[0].situacao], [0, null, "nao_enviado"]);
});

test("mensagem troca as variáveis e links saem codificados", () => {
  const msg = montarMensagem(MODELO_PADRAO, {
    cotacao: { numero: "COT-0007", solicitante: "Rai", destino: "", prazoPropostas: "2026-10-05", itens: [{ quantidade: 20, unidade: "un", descricao: "Tomada 20A", especificacao: "" }] },
    fornecedor: { nome: "Volt" }, ajustes: { empresa: { nome: "Almox X" }, destinoPadrao: "Galpão 2" },
  });
  assert.match(msg, /Olá, Volt!/);
  assert.match(msg, /- 20 un Tomada 20A/);
  assert.match(msg, /Galpão 2/);
  assert.match(msg, /05\/10\/2026/);
  assert.match(msg, /COT-0007/);
  assert.equal(linkWhatsapp("(11) 99999-0001", "oi tudo").startsWith("https://wa.me/5511999990001?text=oi%20tudo"), true);
  assert.equal(linkWhatsapp("", "x"), null);
  assert.equal(linkMaps("material elétrico"), "https://www.google.com/maps/search/?api=1&query=material%20el%C3%A9trico");
});

test("status: passos e volta", () => {
  assert.equal(proximoPasso("rascunho").para, "aguardando_propostas");
  assert.equal(proximoPasso("decidida").para, "concluida");
  assert.equal(proximoPasso("cancelada"), null);
  assert.equal(voltar("concluida"), "em_analise");
});
