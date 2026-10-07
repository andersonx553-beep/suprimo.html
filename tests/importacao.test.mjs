import test from "node:test";
import assert from "node:assert/strict";
import { montarLinhas } from "../src/importacao/linhas.js";
import { interpretarOrcamento } from "../src/importacao/interpretar.js";
import { lerDinheiro, lerQuantidade, lerData } from "../src/importacao/numeros.js";
import { validarOrcamento, camposFaltando, verificarDuplicidade } from "../src/importacao/validar.js";
import { sugerirCorrespondencias, semelhanca } from "../src/importacao/mapear.js";
import { montarImportacao } from "../src/importacao/aplicar.js";
import { sha256Hex } from "../src/importacao/hash.js";
import { criarStore } from "../src/state/store.js";
import { criarMemoria } from "../src/data/banco.js";
import { migrar, lerBackup } from "../src/data/esquema.js";
import { compararCotacao } from "../src/domain/mapa.js";

// ---- montagem de linhas a partir de trechos sintéticos ----
const t = (y, x, texto, w = texto.length * 4.5, h = 8.6) => ({ p: 1, x, x2: x + w, y, h, texto });
const ler = (trechos) => interpretarOrcamento(montarLinhas(trechos), { largura: 600 });

test("números brasileiros: R$, milhar, decimais e o que NÃO é dinheiro", () => {
  assert.equal(lerDinheiro("R$ 1.765,90"), 176590);
  assert.equal(lerDinheiro("R$ 464,630"), 46463);
  assert.equal(lerDinheiro("R$ 1,005"), 101);
  assert.equal(lerDinheiro("– R$ 88,30"), 8830);
  assert.equal(lerDinheiro("1.000 L"), null);
  assert.equal(lerDinheiro("1.000"), null);
  assert.equal(lerQuantidade("1.000"), 1000);
  assert.equal(lerQuantidade("2,5"), 2.5);
  assert.equal(lerData("31/02/2026"), null);
  assert.equal(lerData("05/10/26"), "2026-10-05");
});

test("letras coladas de ligadura ('con' + 'fi' + 'rmação') viram uma palavra só", () => {
  const linhas = montarLinhas([t(10, 100, "2 dias após con", 60), t(10, 160, "fi", 5), t(10, 165, "rmação", 28)]);
  assert.equal(linhas[0].celulas.length, 1);
  assert.equal(linhas[0].celulas[0].texto, "2 dias após confirmação");
});

test("sem cabeçalho de tabela: plano B por linha, e '1.000 L' na descrição não vira valor", () => {
  const r = ler([
    t(20, 40, "ORÇAMENTO Nº PROP-77/2026"),
    t(40, 40, "01 TB-001 Tubo PVC 25 mm UN 20 18,90 378,00", 300),
    t(55, 40, "02 Caixa d'água 1.000 L com tampa UN 1 489,00 489,00", 300),
  ]);
  assert.equal(r.diagnostico.metodoItens, "linhas");
  assert.equal(r.itens.length, 2);
  assert.deepEqual([r.itens[1].descricao, r.itens[1].quantidade, r.itens[1].unitarioCentavos], ["Caixa d'água 1.000 L com tampa", 1, 48900]);
  assert.equal(r.orcamento.numero, "PROP-77/2026");
});

const cab = (y) => [t(y, 30, "ITEM", 19), t(y, 100, "CÓDIGO", 32), t(y, 170, "DESCRIÇÃO", 47), t(y, 400, "UN", 11), t(y, 430, "QTD", 17), t(y, 460, "VL. UNIT.", 52), t(y, 525, "VL. TOTAL", 57)];

test("descrição que continua na linha de baixo é junta à do item", () => {
  const r = ler([...cab(100), t(130, 38, "01", 10), t(130, 112, "AB-1", 20), t(130, 170, "Registro de esfera VS soldável", 130), t(130, 407, "PC", 12), t(130, 442, "8", 5), t(130, 490, "14,90", 22), t(130, 556, "119,20", 26),
    t(142, 170, "25 mm - Amanco", 70)]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].descricao, "Registro de esfera VS soldável 25 mm - Amanco");
});

test("validade em dias e CNPJ inválido são sinalizados, não aceitos como certos", () => {
  const r = ler([t(20, 40, "Empresa Teste Ltda"), t(32, 40, "CNPJ 11.222.333/0001-99"), t(20, 400, "Emissão: 05/10/2026"), t(32, 400, "Validade: 15 dias")]);
  assert.equal(r.fornecedor.cnpjValido, false);
  assert.equal(r.fornecedor.cnpj, "11222333000199");
  assert.equal(r.orcamento.validade, null);
  assert.equal(r.orcamento.validadeDias, 15);
});

test("frete grátis e desconto sem traço", () => {
  const r = ler([t(10, 40, "Frete", 20), t(10, 120, "CIF – incluso", 60), t(30, 40, "Desconto (10%)", 70), t(30, 300, "R$ 100,00", 40), t(50, 40, "Subtotal", 40), t(50, 300, "R$ 1.000,00", 50), t(70, 40, "TOTAL GERAL", 60), t(70, 300, "R$ 900,00", 40)]);
  assert.deepEqual([r.condicoes.freteTipo, r.condicoes.freteCentavos, r.condicoes.descontoCentavos, r.condicoes.descontoPercentual, r.condicoes.totalCentavos], ["CIF", 0, 10000, 10, 90000]);
});

test("cabeçalho em duas linhas, QTE e validade em DD úteis", () => {
  const r = interpretarOrcamento(montarLinhas([
    t(20, 220, "Fornecedor Exemplo Ltda", 140), t(20, 530, "N°", 10), t(20, 600, "951/2026", 40),
    t(30, 520, "DATA", 20), t(30, 600, "30/09/2026", 45),
    t(100, 80, "DESCRIÇÃO", 50), t(100, 500, "VALOR", 30),
    t(104, 60, "ITEM", 20), t(104, 417, "UNID.", 20), t(104, 450, "QTE.", 20), t(104, 580, "TOTAL", 30),
    t(116, 68, "1", 5), t(116, 83, "Manta 3MM", 110), t(116, 414, "UNID.", 19),
    t(116, 440, "24,00", 17), t(116, 481, "R$", 9), t(116, 529, "275,00", 23),
    t(116, 557, "R$", 9), t(116, 600, "6.600,00", 30),
    t(180, 530, "TOTAL R$", 40), t(180, 593, "6.600,00", 38),
    t(200, 60, "Validade da Proposta:", 90), t(200, 183, "10 DD ÚTEIS", 60),
  ]), { largura: 842 });
  assert.deepEqual([r.itens.length, r.itens[0].quantidade, r.itens[0].unitarioCentavos, r.itens[0].totalCentavos], [1, 24, 27500, 660000]);
  assert.deepEqual([r.condicoes.subtotalCentavos, r.condicoes.totalCentavos, r.orcamento.validadeTexto], [660000, 660000, "10 DD ÚTEIS"]);
});

test("preço com três casas, logística zero e pagamento em observação", () => {
  const r = ler([
    t(20, 390, "EMPRESA MATRIZ", 90), t(100, 18, "ORÇAMENTO Nº.: 48401", 130), t(100, 304, "Emissão: 29/09/2026", 110),
    t(200, 16, "Código", 25), t(200, 51, "Descrição dos produtos", 90), t(200, 310, "Und", 16), t(200, 337, "Qtde", 19),
    t(200, 375, "Vlr Unitário", 43), t(200, 424, "Desc. Unit.", 42), t(200, 474, "Vlr. c/ Desc.", 45), t(200, 529, "Total c/ Desc.", 52),
    t(212, 16, "021369", 27), t(212, 51, "Manta ALU 4MM", 170), t(212, 312, "UN", 11), t(212, 341, "34", 10),
    t(212, 374, "R$ 464,630", 41), t(212, 431, "R$ 0,000", 33), t(212, 476, "R$ 464,630", 41), t(212, 530, "R$ 15.797,42", 49),
    t(245, 537, "SUBTOTAL", 45), t(260, 526, "R$ 15.797,42", 52),
    t(275, 414, "(+) Logística:", 55), t(275, 548, "R$ 0,00", 31),
    t(290, 378, "(=) Total c/ Desconto:", 92), t(290, 518, "R$ 15.797,42", 61),
    t(320, 97, "FRETE CIF(FORTALEZA).", 130),
    t(340, 97, "FORMA DE PAGAMENTO:", 114), t(340, 217, "BOLETO BANCÁRIO 30 DD", 126),
    t(360, 97, "VALIDADE DA PROPOSTA: 05 DIAS", 180),
  ]);
  assert.deepEqual([r.itens[0].unitarioCentavos, r.itens[0].totalCentavos, r.condicoes.freteCentavos, r.condicoes.totalCentavos], [46463, 1579742, 0, 1579742]);
  assert.equal(r.condicoes.pagamento, "BOLETO BANCÁRIO 30 DD");
  assert.equal(r.condicoes.freteTexto, "CIF(FORTALEZA).");
});

// ---- validações ----
const base = () => ({
  fornecedor: { razaoSocial: "X Ltda", cnpj: "34582117000142" },
  orcamento: { numero: "1", emissao: "2026-10-05", validade: "2026-10-20" },
  condicoes: { prazoEntrega: "2 dias", pagamento: "28 dias", freteCentavos: 3500, descontoCentavos: 8830, subtotalCentavos: 176590, totalCentavos: 171260 },
  itens: [{ numero: 1, descricao: "A", quantidade: 20, unitarioCentavos: 1890, totalCentavos: 37800 }, { numero: 2, descricao: "B", quantidade: 10, unitarioCentavos: 29500 - 26550, totalCentavos: 138790 }],
});
// itens que somam exatamente 176590
const ok = () => { const d = base(); d.itens = [{ numero: 1, descricao: "A", quantidade: 20, unitarioCentavos: 1890, totalCentavos: 37800 }, { numero: 2, descricao: "B", quantidade: 1, unitarioCentavos: 138790, totalCentavos: 138790 }]; return d; };
const ids = (d, hoje = "2026-10-05") => validarOrcamento(d, { hoje }).map((a) => a.id);

test("validações: documento coerente não gera alerta", () => assert.deepEqual(ids(ok()), []));
test("validação: quantidade × unitário ≠ total do item", () => { const d = ok(); d.itens[0].totalCentavos = 37900; assert.ok(ids(d).includes("item-0")); });
test("validação: soma dos itens ≠ subtotal", () => { const d = ok(); d.itens[1].totalCentavos += 500; d.itens[1].unitarioCentavos += 500; assert.ok(ids(d).includes("subtotal")); });
test("validação: subtotal − desconto + frete ≠ total", () => { const d = ok(); d.condicoes.totalCentavos += 1000; assert.ok(ids(d).includes("total")); });
test("validação: arredondamento de 1 centavo é aceito", () => { const d = ok(); d.condicoes.totalCentavos += 1; assert.ok(!ids(d).includes("total")); });
test("validação: validade anterior à emissão e orçamento vencido", () => {
  const d = ok(); d.orcamento.validade = "2026-10-01";
  assert.ok(ids(d).includes("validade-anterior"));
  const v = ok(); assert.ok(ids(v, "2026-11-01").includes("vencido"));
  assert.ok(!ids(v, "2026-10-20").includes("vencido"));
});
test("validação: CNPJ com dígitos errados", () => { const d = ok(); d.fornecedor.cnpj = "34582117000143"; assert.ok(ids(d).includes("cnpj")); });
test("número do arquivo diferente do documento gera aviso sem trocar o número lido", () => {
  const d = ok(); d.orcamento.numero = "951/2026";
  const alertas = validarOrcamento(d, { hoje: "2026-10-05", nomeArquivo: "COTAÇÃO 952 AQUAVILLE.pdf" });
  assert.ok(alertas.some((a) => a.id === "numero-arquivo"));
  assert.equal(d.orcamento.numero, "951/2026");
});
test("campos não encontrados são listados para destacar", () => {
  const d = ok(); d.orcamento.numero = null; d.condicoes.prazoEntrega = "";
  assert.deepEqual(camposFaltando(d).sort(), ["condicoes.prazoEntrega", "orcamento.numero"]);
});
test("duplicidade: mesmo arquivo e mesmo CNPJ + número", () => {
  const docs = [{ fileHash: "aaa", cnpj: "34582117000142", numeroOrcamento: "ORC-1" }];
  assert.ok(verificarDuplicidade(docs, { hash: "aaa", cnpj: "x", numero: "y" }).mesmoArquivo);
  const r = verificarDuplicidade(docs, { hash: "bbb", cnpj: "34582117000142", numero: "ORC-1" });
  assert.equal(r.mesmoArquivo, null); assert.ok(r.mesmoOrcamento);
  assert.equal(verificarDuplicidade(docs, { hash: "bbb", cnpj: "34582117000142", numero: "ORC-2" }).mesmoOrcamento, null);
});
test("SHA-256 conhecido", async () => assert.equal(await sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));

// ---- ligação dos itens ----
test("semelhança e sugestão: liga o que se parece, sem repetir item", () => {
  const orc = [{ descricao: "Tubo PVC soldável 25 mm x 6 m - Tigre" }, { descricao: "Tubo PVC soldável 32 mm x 6 m - Tigre" }, { descricao: "Sifão sanfonado universal branco" }];
  const cot = [{ id: "a", descricao: "Tubo PVC soldável 32 mm (barra 6 m)" }, { id: "b", descricao: "Tubo PVC soldável 25 mm (barra 6 m)" }];
  assert.deepEqual(sugerirCorrespondencias(orc, cot), ["b", "a", null]);
  assert.ok(semelhanca("Cabo flexível 2,5 mm²", "cabo flexivel 2,5 mm²") > 0.9);
  assert.ok(semelhanca("Tubo 25 mm", "Tubo 32 mm") < 0.5);
});

// ---- montar a proposta ----
const cotacaoBase = () => ({ id: "c1", numero: "COT-0001", itens: [{ id: "i1", descricao: "Tubo PVC 25 mm", quantidade: 20, unidade: "br" }, { id: "i2", descricao: "Torneira", quantidade: 4, unidade: "un" }], convites: [], propostas: [], decisao: null });
const dadosBase = () => ({
  fornecedor: { razaoSocial: "Ponto Hidro Ltda", nomeFantasia: "PONTOHIDRO", cnpj: "34582117000142", telefone: "(85) 3254-7781", email: "o@p.com" },
  orcamento: { numero: "ORC-1", emissao: "2026-10-05", validade: "2026-10-20", vendedor: "M" },
  condicoes: { prazoEntrega: "2 dias úteis", prazoEntregaDias: 2, pagamento: "Boleto 28 dias", pagamentoDias: 28, freteTipo: "FOB", freteCentavos: 3500, descontoCentavos: 8830, subtotalCentavos: 176590, totalCentavos: 171260 },
  itens: [{ numero: 1, codigo: "T1", descricao: "Tubo PVC soldável 25 mm", unidade: "BR", quantidade: 20, unitarioCentavos: 1890, totalCentavos: 37800 },
    { numero: 2, codigo: "S1", descricao: "Sifão", unidade: "PC", quantidade: 10, unitarioCentavos: 970, totalCentavos: 9700 },
    { numero: 3, codigo: "T2", descricao: "Torneira de jardim", unidade: "CX", quantidade: 4, unitarioCentavos: 3290, totalCentavos: 13160 }],
});
let seq = 0;
const montar = (extra = {}) => montarImportacao({ cotacao: cotacaoBase(), dados: dadosBase(), correspondencia: ["i1", "novo", "i2"], fornecedores: [], arquivo: { nome: "o.pdf", tamanho: 10, tipo: "application/pdf" }, hash: "h1", agora: "2026-10-05T10:00:00Z", novoId: () => `id${++seq}`, ...extra });

test("proposta importada: status confirmada, preços por item, item novo, unidade diferente sinalizada", () => {
  const p = montar();
  assert.equal(p.proposta.status, "confirmada");
  assert.equal(p.proposta.origem, "importada");
  assert.equal(p.novosItens.length, 1);
  assert.equal(p.novosItens[0].descricao, "Sifão");
  assert.deepEqual(p.proposta.precos.i1, { centavos: 1890 });
  assert.deepEqual(p.proposta.precos.i2, { centavos: 3290, unidade: "CX" });
  assert.equal(p.proposta.precos[p.novosItens[0].id].centavos, 970);
  assert.deepEqual([p.proposta.freteCentavos, p.proposta.freteTipo, p.proposta.descontoCentavos, p.proposta.prazoEntregaDias, p.proposta.pagamento.dias, p.proposta.validade], [3500, "FOB", 8830, 2, 28, "2026-10-20"]);
  assert.equal(p.documento.fileHash, "h1");
  assert.equal(p.documento.cnpj, "34582117000142");
});
test("fornecedor: criado quando o CNPJ não existe; reaproveitado quando existe", () => {
  assert.equal(montar().fornecedorNovo, true);
  const existente = { id: "f9", nome: "Já cadastrado", cnpj: "34582117000142" };
  const r = montar({ fornecedores: [existente] });
  assert.equal(r.fornecedorNovo, false);
  assert.equal(r.fornecedor.id, "f9");
  assert.equal(r.proposta.fornecedorId, "f9");
});
test("dois itens do orçamento ligados ao mesmo item da cotação: fica o primeiro e avisa", () => {
  const r = montar({ correspondencia: ["i1", "i1", ""] });
  assert.equal(r.avisos.length, 1);
  assert.equal(r.proposta.precos.i1.centavos, 1890);
});
test("o desconto do orçamento entra no custo total do mapa", () => {
  const cot = cotacaoBase();
  const r = montar({ correspondencia: ["i1", "", "i2"] });
  cot.propostas.push({ ...r.proposta, precos: { i1: { centavos: 1890 }, i2: { centavos: 3290 } } });
  const res = compararCotacao(cot, { hoje: "2026-10-05" });
  assert.equal(res.colunas[0].custoTotal, 37800 + 13160 - 8830 + 3500);
});

// ---- esquema v1 → v2 ----
test("migração 1→2: propostas antigas viram 'confirmada/manual' e nasce a lista de documentos", () => {
  const v1 = { versaoEsquema: 1, cotacoes: [{ id: "c", numero: "COT-0001", itens: [], convites: [], propostas: [{ id: "p", fornecedorId: "f", precos: {}, freteCentavos: 100 }] }], fornecedores: [] };
  const v2 = migrar(v1);
  assert.equal(v2.versaoEsquema, 2);
  assert.deepEqual(v2.documentos, []);
  assert.deepEqual([v2.cotacoes[0].propostas[0].status, v2.cotacoes[0].propostas[0].origem, v2.cotacoes[0].propostas[0].descontoCentavos, v2.cotacoes[0].propostas[0].freteCentavos], ["confirmada", "manual", 0, 100]);
});
test("backup antigo (v1) é importado já migrado", () => {
  const txt = JSON.stringify({ sistema: "suprimo", versaoEsquema: 1, cotacoes: [{ id: "c", numero: "COT-0001", itens: [], convites: [], propostas: [{ id: "p", precos: {} }] }], fornecedores: [] });
  const d = lerBackup(txt);
  assert.equal(d.cotacoes[0].propostas[0].status, "confirmada");
  assert.deepEqual(d.documentos, []);
});

// ---- gravação, duplicidade e rollback ----
const novoStore = async (adaptador = criarMemoria()) => { const s = criarStore(adaptador); await s.iniciar(); return s; };
const prepara = async (s, hash = "h1") => {
  const c = s.criarCotacao({ titulo: "Hidráulica" });
  s.atualizarCotacao(c.id, (x) => x.itens.push({ id: "i1", descricao: "Tubo PVC 25 mm", quantidade: 20, unidade: "br", especificacao: "" }));
  const plano = montarImportacao({ cotacao: s.cotacao(c.id), dados: dadosBase(), correspondencia: ["i1", "", ""], fornecedores: s.estado.fornecedores, arquivo: { nome: "o.pdf", tamanho: 3, tipo: "application/pdf" }, hash, agora: "2026-10-05T10:00:00Z", novoId: () => `n${++seq}` });
  return { c, plano };
};

test("confirmar: grava proposta, fornecedor novo, convite 'respondeu', documento e o PDF", async () => {
  const s = await novoStore();
  const { c, plano } = await prepara(s);
  await s.confirmarImportacao({ cotacaoId: c.id, plano, arquivo: new Blob(["%PDF-1.4"]) });
  const cot = s.cotacao(c.id);
  assert.equal(cot.propostas.length, 1);
  assert.equal(cot.propostas[0].status, "confirmada");
  assert.equal(cot.convites[0].situacao, "respondeu");
  assert.equal(s.estado.fornecedores.length, 1);
  assert.equal(s.estado.documentos.length, 1);
  assert.ok(await s.lerAnexo(plano.documento.anexoId));
});
test("XML e PDF do mesmo orçamento ficam na mesma proposta e o PDF abre primeiro", async () => {
  const s = await novoStore();
  const c = s.criarCotacao({ titulo: "Hidráulica" });
  const plano = montarImportacao({ cotacao: c, dados: dadosBase(), correspondencia: ["novo", "novo", "novo"], fornecedores: [],
    arquivo: { nome: "orcamento.xml", tamanho: 20, tipo: "application/xml" },
    anexoPdf: { nome: "original.pdf", tamanho: 8, tipo: "application/pdf" }, hash: "xml-pdf", agora: "2026-10-07T12:00:00Z", novoId: () => `n${++seq}` });
  await s.confirmarImportacao({ cotacaoId: c.id, plano, arquivo: new Blob(["<orcamentoSuprimo/>"]), anexoPdf: new Blob(["%PDF-1.4"]) });
  assert.deepEqual(s.cotacao(c.id).propostas[0].anexos.map((a) => a.nome), ["original.pdf", "orcamento.xml"]);
  assert.equal((await s.lerAnexo(plano.anexoPdfMeta.id)).size, 8);
  assert.ok(await s.lerAnexo(plano.documento.anexoId));
  assert.equal(s.estado.documentos[0].anexoId, plano.documento.anexoId);
});
test("três XMLs na mesma cotação criam três propostas sem duplicar itens", async () => {
  const s = await novoStore();
  const c = s.criarCotacao({ titulo: "Hidráulica" });
  const eventos = [];
  s.assinar((meta) => eventos.push(meta));
  for (let n = 1; n <= 3; n++) {
    const d = dadosBase();
    d.fornecedor = { razaoSocial: `Fornecedor ${n}`, cnpj: "" };
    d.orcamento.numero = `ORC-${n}`;
    d.itens[0].unitarioCentavos = 1800 + n;
    const atual = s.cotacao(c.id);
    const ligacoes = sugerirCorrespondencias(d.itens, atual.itens).map((id) => id ?? (atual.itens.length ? "" : "novo"));
    assert.equal(ligacoes.filter(Boolean).length, 3);
    const plano = montarImportacao({ cotacao: atual, dados: d, correspondencia: ligacoes, fornecedores: s.estado.fornecedores,
      arquivo: { nome: `orcamento-${n}.xml`, tamanho: 8, tipo: "application/xml" }, hash: `lote-${n}`,
      agora: "2026-10-07T13:00:00Z", novoId: () => `n${++seq}` });
    await s.confirmarImportacao({ cotacaoId: c.id, plano, arquivo: new Blob([`xml ${n}`]), silencioso: true });
  }
  assert.equal(s.cotacao(c.id).propostas.length, 3);
  assert.equal(s.cotacao(c.id).itens.length, 3);
  assert.equal(s.estado.fornecedores.length, 3);
  assert.equal(s.estado.documentos.length, 3);
  const item = s.cotacao(c.id).itens[0].id;
  assert.deepEqual(s.cotacao(c.id).propostas.map((p) => p.precos[item]?.centavos), [1801, 1802, 1803]);
  assert.ok(eventos.every((meta) => meta.silencioso));
});
test("falha ao gravar o PDF opcional desfaz XML e registro", async () => {
  const mem = criarMemoria(), s = await novoStore(mem);
  const c = s.criarCotacao({ titulo: "Hidráulica" });
  const plano = montarImportacao({ cotacao: c, dados: dadosBase(), correspondencia: ["novo", "novo", "novo"], fornecedores: [],
    arquivo: { nome: "orcamento.xml", tamanho: 3, tipo: "application/xml" },
    anexoPdf: { nome: "original.pdf", tamanho: 8, tipo: "application/pdf" }, hash: "xml-falha", agora: "2026-10-07T12:00:00Z", novoId: () => `n${++seq}` });
  const salvar = mem.salvarAnexo;
  mem.salvarAnexo = (id, blob) => id === plano.anexoPdfMeta.id ? Promise.reject(Error("sem espaço")) : salvar(id, blob);
  await assert.rejects(() => s.confirmarImportacao({ cotacaoId: c.id, plano, arquivo: new Blob(["xml"]), anexoPdf: new Blob(["pdf"]) }), /sem espaço/);
  assert.equal(await mem.lerAnexo(plano.documento.anexoId), undefined);
  assert.equal(s.estado.documentos.length, 0);
  assert.equal(s.cotacao(c.id).propostas.length, 0);
});
test("PDF duplicado: segundo import com o mesmo hash é recusado e nada é gravado", async () => {
  const s = await novoStore();
  const a = await prepara(s, "mesmo-hash");
  await s.confirmarImportacao({ cotacaoId: a.c.id, plano: a.plano, arquivo: new Blob(["x"]) });
  assert.ok(s.documentoPorHash("mesmo-hash"));
  const b = await prepara(s, "mesmo-hash");
  await assert.rejects(() => s.confirmarImportacao({ cotacaoId: b.c.id, plano: b.plano, arquivo: new Blob(["x"]) }), /já foi importado/);
  assert.equal(s.cotacao(b.c.id).propostas.length, 0);
  assert.equal(s.estado.documentos.length, 1);
});
test("falha no meio da gravação desfaz tudo (sem meia importação)", async () => {
  const mem = criarMemoria();
  const s = await novoStore(mem);
  const { c, plano } = await prepara(s);
  const original = mem.gravar;
  mem.gravar = async (loja, obj) => { if (loja === "cotacoes" && obj.propostas?.length) throw new Error("disco cheio"); return original(loja, obj); };
  await assert.rejects(() => s.confirmarImportacao({ cotacaoId: c.id, plano, arquivo: new Blob(["x"]) }), /disco cheio/);
  assert.equal(s.cotacao(c.id).propostas.length, 0);
  assert.equal(s.estado.documentos.length, 0);
  assert.equal(s.estado.fornecedores.length, 0);
  assert.equal((await mem.carregar()).documentos.length, 0);
  assert.equal(await mem.lerAnexo(plano.documento.anexoId), undefined);
});
test("remover a proposta libera o mesmo PDF para importar de novo", async () => {
  const s = await novoStore();
  const a = await prepara(s, "h-liberar");
  await s.confirmarImportacao({ cotacaoId: a.c.id, plano: a.plano, arquivo: new Blob(["x"]) });
  s.removerProposta(a.c.id, a.plano.proposta.id);
  assert.equal(s.documentoPorHash("h-liberar"), null);
  const b = await prepara(s, "h-liberar");
  await s.confirmarImportacao({ cotacaoId: b.c.id, plano: b.plano, arquivo: new Blob(["x"]) });
  assert.equal(s.estado.documentos.length, 1);
});
test("backup carrega os documentos importados (sem o PDF) e a importação restaura", async () => {
  const s = await novoStore();
  const a = await prepara(s, "h-bkp");
  await s.confirmarImportacao({ cotacaoId: a.c.id, plano: a.plano, arquivo: new Blob(["x"]) });
  const dados = lerBackup(JSON.stringify(s.exportar()));
  assert.equal(dados.documentos.length, 1);
  const s2 = await novoStore();
  await s2.importar(dados);
  assert.ok(s2.documentoPorHash("h-bkp"));
});
