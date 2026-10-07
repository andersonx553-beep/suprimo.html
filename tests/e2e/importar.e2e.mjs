// Roteiro de navegador da importação de orçamento (PC e celular). Precisa do Playwright instalado e do site no ar:
//   python3 -m http.server 8000   (em outro terminal)
//   URL=http://localhost:8000/index.html node tests/e2e/importar.e2e.mjs [pasta-das-capturas]
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_APP = process.env.URL || "http://localhost:8000/index.html";
const SAIDA = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "suprimo-e2e-"));
const FIX = new URL("../fixtures/", import.meta.url).pathname;
const VALIDO = FIX + "orcamento-ponto-hidro-texto.pdf";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suprimo-arq-"));
const arq = (nome, bytes) => { const p = path.join(tmp, nome); fs.writeFileSync(p, bytes); return p; };

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) falhas++; console.log(`${cond ? "OK   " : "FALHA"} ${msg}`); };

const TEXTO = arq("orcamento.txt", "isto não é um pdf");
const FALSO = arq("falso.pdf", "isto também não é um pdf");
const GRANDE = arq("grande.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(10 * 1024 * 1024 + 10)]));
const COPIA = arq("copia-do-mesmo-orcamento.pdf", Buffer.concat([fs.readFileSync(VALIDO), Buffer.from("\n%% copia com bytes diferentes\n")]));

const browser = await chromium.launch();
const erros = [];
async function pagina(opcoes) {
  const ctx = await browser.newContext(opcoes);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(String(e)));
  p.on("console", (m) => m.type() === "error" && !/Failed to load|ERR_/.test(m.text()) && erros.push(m.text()));
  await p.route(/fonts\.g/, (r) => r.abort());
  return p;
}
const enviar = async (p, arquivo) => { await p.setInputFiles("[data-arquivo]", arquivo); };
const msg = async (p) => (await p.locator(".faixa[role=alert]").innerText()).trim();
const naRota = (p, fim) => p.waitForFunction((f) => location.hash.endsWith(f), fim);
const semRolagemLateral = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// ============ PC ============
const p = await pagina({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await p.goto(URL_APP);
await p.waitForSelector("[data-nova]");
await p.click("[data-nova]"); await p.fill('#fn [name="titulo"]', "Hidráulica do condomínio"); await p.click("[data-criar]");
await p.waitForSelector('[data-acao="colar"]');
await p.goto(URL_APP + "#/cotacoes/COT-0001/propostas");
await p.click('a:has-text("Importar orçamento")');
await p.waitForSelector("[data-escolher]");
ok(p.url().endsWith("#/cotacoes/COT-0001/importar"), "botão da aba Propostas abre a tela Importar orçamento");
await p.screenshot({ path: `${SAIDA}/1-escolher-pc.png` });

// --- arquivos inválidos ---
await enviar(p, TEXTO); ok((await msg(p)).includes("PDF, JPG, PNG ou XML"), "recusa .txt: " + (await msg(p)));
await enviar(p, FALSO); ok((await msg(p)).includes("PDF, JPG, PNG ou XML"), "recusa .pdf falso (sem cabeçalho %PDF)");
await enviar(p, GRANDE); ok((await msg(p)).includes("10 MB"), "recusa acima de 10 MB");
await enviar(p, FIX + "orcamento-com-senha.pdf"); ok((await msg(p)).includes("tem senha"), "PDF com senha: " + (await msg(p)).slice(0, 60));

// --- PDF válido: conferência ---
await enviar(p, VALIDO);
await p.waitForSelector(".conferencia");
const val = (cam) => p.inputValue(`[data-caminho="${cam}"]`);
ok((await val("fornecedor.cnpj")) === "34.582.117/0001-42", "CNPJ lido e formatado");
ok((await val("orcamento.numero")) === "ORC-2026-0847", "número do orçamento");
ok((await val("orcamento.validade")) === "2026-10-20", "validade");
ok((await val("condicoes.totalCentavos")) === "1712,60", "total");
ok((await p.locator("[data-itens] tr").count()) === 10, "10 itens na conferência");
ok((await p.locator(".alertas__titulo").innerText()).includes("Os números fecham"), "sem alertas quando os números fecham");
await p.waitForSelector(".conferencia__paginas canvas");
ok(await p.locator(".conferencia__paginas canvas").first().isVisible(), "PDF desenhado ao lado dos dados no PC");
ok((await p.locator("[data-liga]").first().inputValue()) === "novo", "cotação sem itens: itens do orçamento entram como novos");
await p.screenshot({ path: `${SAIDA}/3-conferencia-pc.png` });
await p.screenshot({ path: `${SAIDA}/3b-conferencia-pc-completa.png`, fullPage: true });

// nada salvo antes de confirmar: cancela e confere
await p.click("[data-cancelar]"); await naRota(p, "/propostas");
ok((await p.locator(".vazio__titulo").innerText()).length > 0 && (await p.locator('[data-proposta]').count()) === 0, "cancelar sem mexer volta sem salvar nada");
await p.goto(URL_APP + "#/fornecedores"); await p.waitForSelector(".vazio__titulo");
ok((await p.locator("tbody tr").count()) === 0, "nenhum fornecedor criado antes de confirmar");

// --- correção manual + alertas + cancelar com mudanças ---
await p.goto(URL_APP + "#/cotacoes/COT-0001/importar"); await enviar(p, VALIDO); await p.waitForSelector(".conferencia");
const tot3 = p.locator('[data-itens] tr:nth-child(3) [data-item="totalCentavos"]');
await tot3.fill("43,00"); await tot3.blur();
const alertas = await p.locator(".alertas .faixa").allInnerTexts();
ok(alertas.some((a) => a.includes("Item 3") && a.includes("43,00")), "item com total errado gera alerta (e não é corrigido)");
ok(alertas.some((a) => a.includes("soma dos itens")), "soma ≠ subtotal gera alerta");
ok((await tot3.inputValue()) === "43,00", "o valor errado continua como está: nada corrigido em silêncio");
await tot3.fill("42,50"); await tot3.blur();
ok((await p.locator(".alertas__titulo").innerText()).includes("Os números fecham"), "corrigir à mão limpa os alertas");
await p.fill('[data-caminho="orcamento.numero"]', ""); await p.press('[data-caminho="orcamento.numero"]', "Tab");
ok((await p.locator('[data-caminho-rotulo="orcamento.numero"]').getAttribute("data-faltando")) === "true", "campo vazio é destacado como não encontrado");
await p.fill('[data-caminho="orcamento.numero"]', "ORC-2026-0847"); await p.press('[data-caminho="orcamento.numero"]', "Tab");
await p.fill('[data-caminho="fornecedor.cnpj"]', "34582117000143"); await p.press('[data-caminho="fornecedor.cnpj"]', "Tab");
ok((await p.locator(".alertas .faixa").allInnerTexts()).some((a) => a.includes("dígitos verificadores")), "CNPJ com dígito errado gera alerta");
await p.fill('[data-caminho="fornecedor.cnpj"]', "34.582.117/0001-42"); await p.press('[data-caminho="fornecedor.cnpj"]', "Tab");
await p.fill('[data-caminho="orcamento.validade"]', "2026-10-01"); await p.press('[data-caminho="orcamento.validade"]', "Tab");
ok((await p.locator(".alertas .faixa").allInnerTexts()).some((a) => a.includes("anterior à emissão")), "validade anterior à emissão gera alerta");
await p.fill('[data-caminho="orcamento.validade"]', "2026-10-20"); await p.press('[data-caminho="orcamento.validade"]', "Tab");
await p.click("[data-add-item]"); ok((await p.locator("[data-itens] tr").count()) === 11, "adicionar item");
await p.locator("[data-itens] tr:last-child [data-tirar]").click(); ok((await p.locator("[data-itens] tr").count()) === 10, "excluir item");
await p.click("[data-cancelar]"); await p.waitForSelector("dialog[open]");
ok((await p.locator("dialog").innerText()).includes("Descartar"), "cancelar com mudanças pede confirmação");
await p.click("dialog .botao--perigo"); await naRota(p, "/propostas");
await p.goto(URL_APP + "#/fornecedores"); await p.waitForSelector(".vazio__titulo");
ok((await p.locator("tbody tr").count()) === 0, "depois de descartar, continua sem salvar nada");

// --- confirmar ---
await p.goto(URL_APP + "#/cotacoes/COT-0001/importar"); await enviar(p, VALIDO); await p.waitForSelector(".conferencia");
await p.click("[data-confirmar]"); await naRota(p, "/propostas"); await p.waitForSelector("[data-proposta]");
ok((await p.locator(".faixa", { hasText: "ORC-2026-0847" }).count()) === 1, "proposta importada aparece como confirmada, com o número do orçamento");
ok((await p.locator(".seletor-proposta__item").first().innerText()).includes("PONTOHIDRO"), "fornecedor criado pelo CNPJ");
ok((await p.locator("tr[data-item]").count()) === 10, "10 itens novos entraram na cotação com seus preços");
ok((await p.inputValue('[data-campo="desconto"]')) === "88,30" && (await p.inputValue('[data-campo="freteTipo"]')) === "FOB" && (await p.inputValue('[data-campo="frete"]')) === "35,00", "desconto, frete e tipo de frete gravados");
await p.waitForSelector(".visualizador iframe"); ok(true, "PDF guardado e aberto ao lado da proposta");
await p.screenshot({ path: `${SAIDA}/4-proposta-importada-pc.png` });
await p.goto(URL_APP + "#/cotacoes/COT-0001/mapa"); await p.waitForSelector("table.mapa");
ok((await p.locator(".mapa-quadro tfoot tr[data-linha=total]").innerText()).includes("1.712,60"), "mapa mostra custo total 1.712,60 (subtotal − desconto + frete)");
await p.screenshot({ path: `${SAIDA}/5-mapa-com-desconto-pc.png` });

// --- duplicidade ---
await p.goto(URL_APP + "#/cotacoes/COT-0001/importar"); await enviar(p, VALIDO);
ok((await msg(p)).includes("Este orçamento já foi importado."), "mesmo PDF: 'Este orçamento já foi importado.'");
await p.screenshot({ path: `${SAIDA}/6-duplicado-pc.png` });
await enviar(p, COPIA); await p.waitForSelector(".conferencia");
ok((await p.locator(".alertas .faixa", { hasText: "Já existe o orçamento ORC-2026-0847" }).count()) === 1, "mesmo CNPJ + número em outro arquivo: aviso extra");
await p.click("[data-cancelar]"); await naRota(p, "/propostas");

// --- segunda cotação, mesmo fornecedor (CNPJ existente) ---
await p.goto(URL_APP + "#/cotacoes"); await p.click("[data-nova]"); await p.fill('#fn [name="titulo"]', "Outra obra"); await p.click("[data-criar]"); await p.waitForSelector('[data-acao="colar"]');
await p.goto(URL_APP + "#/cotacoes/COT-0002/importar"); await enviar(p, COPIA); await p.waitForSelector(".conferencia");
ok((await p.locator("[data-fornecedor-nota]").innerText()).includes("já está cadastrado"), "CNPJ existente: o orçamento entra no fornecedor cadastrado");
await p.click("[data-confirmar]"); await naRota(p, "/propostas");
await p.goto(URL_APP + "#/fornecedores"); await p.waitForSelector("tbody tr");
ok((await p.locator("tbody tr").count()) === 1, "fornecedor não foi duplicado");

// --- persistência e remover libera o PDF ---
await p.reload(); await p.waitForSelector("tbody tr");
await p.goto(URL_APP + "#/cotacoes/COT-0001/propostas"); await p.waitForSelector("[data-proposta]");
ok(true, "proposta importada persiste depois de recarregar a página (IndexedDB)");
await p.click("[data-remover-proposta]"); await p.waitForSelector(".vazio__titulo");
await p.goto(URL_APP + "#/cotacoes/COT-0001/importar"); await enviar(p, VALIDO); await p.waitForSelector(".conferencia");
ok(true, "remover a proposta libera o mesmo PDF para importar de novo");

// --- tema claro ---
await p.evaluate(() => { document.documentElement.dataset.theme = "claro"; });
await p.screenshot({ path: `${SAIDA}/7-conferencia-claro-pc.png` });
ok(await semRolagemLateral(p), "PC: página sem rolagem lateral");

// ============ celular ============
const m = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, hasTouch: true });
await m.goto(URL_APP); await m.waitForSelector("[data-nova]");
await m.goto(URL_APP + "#/cotacoes"); await m.click("[data-nova]"); await m.fill('#fn [name="titulo"]', "Celular"); await m.click("[data-criar]"); await m.waitForSelector('[data-acao="colar"]');
await m.goto(URL_APP + "#/cotacoes/COT-0001/propostas"); await m.waitForSelector('a:has-text("Importar orçamento")');
await m.screenshot({ path: `${SAIDA}/8-propostas-celular.png` });
await m.click('a:has-text("Importar orçamento")'); await m.waitForSelector("[data-escolher]");
ok(await semRolagemLateral(m), "celular: tela de envio sem rolagem lateral");
await m.screenshot({ path: `${SAIDA}/9-escolher-celular.png` });
await enviar(m, VALIDO); await m.waitForSelector(".conferencia");
ok(await semRolagemLateral(m), "celular: conferência sem rolagem lateral");
ok(!(await m.locator(".conferencia__pdf").isVisible()), "celular: PDF não ocupa a tela (botão Ver PDF)");
// Em Chromium headless o PDF aberto numa aba vira download; por isso conferimos a chamada que o app faz.
await m.evaluate(() => { window.__abriu = null; window.open = (u, alvo) => { window.__abriu = { u, alvo }; return null; }; });
await m.click("[data-ver-pdf]");
const aberto = await m.evaluate(() => window.__abriu);
ok(aberto?.u?.startsWith("blob:") && aberto.alvo === "_blank", "celular: Ver PDF abre o arquivo em outra aba");
await m.screenshot({ path: `${SAIDA}/10-conferencia-celular.png` });
await m.locator("[data-itens]").scrollIntoViewIfNeeded(); await m.screenshot({ path: `${SAIDA}/11-itens-celular.png` });
const campo = m.locator('[data-itens] tr:nth-child(2) [data-item="quantidade"]'); await campo.fill("11"); await campo.blur();
ok((await m.locator(".alertas .faixa").allInnerTexts()).some((a) => a.includes("Item 2")), "celular: correção manual gera alerta");
await m.screenshot({ path: `${SAIDA}/12-alertas-celular.png` });
await m.click("[data-confirmar]"); await m.waitForSelector("dialog[open]");
ok((await m.locator("dialog").innerText()).includes("não fecham"), "celular: confirmar com número divergente pede confirmação explícita");
await m.click("dialog .botao--primario"); await naRota(m, "/propostas"); await m.waitForSelector("[data-proposta]");
ok(await semRolagemLateral(m), "celular: proposta importada sem rolagem lateral");
await m.screenshot({ path: `${SAIDA}/13-proposta-celular.png` });

console.log(`\nerros de console: ${JSON.stringify(erros)}`);
console.log(`${total - falhas} de ${total} verificações passaram. Capturas em ${SAIDA}`);
await browser.close();
process.exit(falhas || erros.length ? 1 : 0);
