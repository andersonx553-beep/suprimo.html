// OCR local no navegador para JPG/PNG e PDFs sem camada de texto. O arquivo não é enviado ao servidor.
// Código do Tesseract.js/worker vai junto com o Suprimo; o núcleo WASM e os idiomas são baixados na primeira leitura.
import { extrairOrcamento, ErroOrcamento, LIMITE_BYTES, pareceUmPdf } from "./extrair.js";
import { montarLinhas } from "./linhas.js";
import { interpretarOrcamento } from "./interpretar.js";
import { completarDadosOcr, itensPorTextoOcr } from "./ocr-texto.js";
import { carregarPdfjs } from "../lib/pdfjs.js";
import { lerOrcamentoXml } from "./xml.js";

const MAX_PAGINAS = 12;
const MAX_PIXELS = 7_000_000;
const MAX_LADO = 3000;

export function tipoDocumento(bytes) {
  if (pareceUmPdf(bytes)) return "application/pdf";
  if (bytes.length > 8 && bytes[0] === 0x89 && [0x50, 0x4e, 0x47].every((v, i) => bytes[i + 1] === v)) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const inicio = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^\uFEFF/, "").trimStart();
  if (/^<\?xml\b|^<orcamentoSuprimo\b/i.test(inicio)) return "application/xml";
  return null;
}

const falha = (codigo, mensagem) => new ErroOrcamento(codigo, mensagem);
const cancelarSePreciso = (sinal) => { if (sinal?.aborted) throw falha("cancelado", "Leitura cancelada."); };
const canvasNovo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

async function* paginasDoArquivo(bytes, tipo, pdfjs, sinal) {
  if (tipo !== "application/pdf") {
    let bitmap;
    try { bitmap = await createImageBitmap(new Blob([bytes], { type: tipo })); }
    catch { throw falha("corrompido", "Não foi possível abrir esta imagem. Tente outro JPG ou PNG."); }
    try {
      cancelarSePreciso(sinal);
      const fator = Math.min(2, MAX_LADO / Math.max(bitmap.width, bitmap.height), Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
      const canvas = canvasNovo(Math.max(1, Math.round(bitmap.width * fator)), Math.max(1, Math.round(bitmap.height * fator)));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      yield { canvas, pagina: 1, total: 1 };
    } finally { bitmap.close(); }
    return;
  }
  let tarefa;
  try {
    tarefa = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, isEvalSupported: false });
    const pdf = await tarefa.promise;
    if (pdf.numPages > MAX_PAGINAS) throw falha("paginas", `Este PDF tem ${pdf.numPages} páginas. O OCR aceita até ${MAX_PAGINAS} por arquivo.`);
    for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
      cancelarSePreciso(sinal);
      const page = await pdf.getPage(pagina), base = page.getViewport({ scale: 1 });
      const fator = Math.min(2.5, MAX_LADO / Math.max(base.width, base.height), Math.sqrt(MAX_PIXELS / (base.width * base.height)));
      const vp = page.getViewport({ scale: fator });
      const canvas = canvasNovo(Math.ceil(vp.width), Math.ceil(vp.height));
      await page.render({ canvasContext: canvas.getContext("2d"), canvas, viewport: vp }).promise;
      yield { canvas, pagina, total: pdf.numPages };
      page.cleanup();
    }
  } catch (e) {
    if (e instanceof ErroOrcamento) throw e;
    throw falha("corrompido", "Não foi possível renderizar este PDF para OCR.");
  } finally { await tarefa?.destroy?.(); }
}

/** Segunda passagem: retira linhas de grade extensas e fundo colorido, depois recorta a área com texto. */
function limparGrade(original) {
  const w = original.width, h = original.height;
  const c = canvasNovo(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(original, 0, 0);
  const imagem = ctx.getImageData(0, 0, w, h), p = imagem.data;
  const linhas = new Uint32Array(h), colunas = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const escuro = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114 < 180;
    if (escuro) { linhas[y]++; colunas[x]++; }
    p[i] = p[i + 1] = p[i + 2] = escuro ? 0 : 255; p[i + 3] = 255;
  }
  const tirarLinha = (y) => linhas[y] > w * 0.30;
  const tirarColuna = (x) => colunas[x] > h * 0.30;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (tirarLinha(y) || (y > 0 && tirarLinha(y - 1)) || (y + 1 < h && tirarLinha(y + 1))
      || tirarColuna(x) || (x > 0 && tirarColuna(x - 1)) || (x + 1 < w && tirarColuna(x + 1))) p[i] = p[i + 1] = p[i + 2] = 255;
    if (p[i] === 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  ctx.putImageData(imagem, 0, 0);
  if (x0 >= x1 || y0 >= y1) return original;
  x0 = Math.max(0, x0 - 20); y0 = Math.max(0, y0 - 20); x1 = Math.min(w, x1 + 21); y1 = Math.min(h, y1 + 21);
  const recorte = canvasNovo(x1 - x0, y1 - y0);
  recorte.getContext("2d").drawImage(c, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
  return recorte;
}

function pontuar(data) {
  const itens = itensPorTextoOcr(data.text);
  const corretos = itens.filter((i) => Math.abs(Math.round(i.quantidade * i.unitarioCentavos) - i.totalCentavos) <= 1).length;
  return { itens, score: corretos * 10 + itens.length * 3 + (data.confidence ?? 0) / 100 };
}

/** Transforma caixas de palavras em trechos posicionados para o interpretador já usado em PDFs digitais. */
export function trechosOcr(data, pagina, larguraImagem) {
  const escala = 600 / larguraImagem;
  return (data.blocks ?? []).flatMap((b) => (b.paragraphs ?? []).flatMap((p) => (p.lines ?? []).flatMap((l) => (l.words ?? [])
    .filter((w) => w.text?.trim() && w.bbox)
    .map((w) => ({ p: pagina, x: w.bbox.x0 * escala, x2: w.bbox.x1 * escala, y: l.bbox.y1 * escala,
      h: (w.bbox.y1 - w.bbox.y0) * escala, texto: w.text.trim() })))));
}

/** Entrada da UI: PDF com texto usa o caminho antigo; imagem/PDF digitalizado usa OCR com conferência. */
export async function extrairDocumento(bytes, { aoProgresso = () => {}, sinal, pdfjs, criarWorker } = {}) {
  const tipo = tipoDocumento(bytes);
  if (!tipo) throw falha("invalido", "Use um PDF, JPG, PNG ou XML válido.");
  if (bytes.length > LIMITE_BYTES) throw falha("grande", "O arquivo passa de 10 MB. Envie um arquivo menor.");
  cancelarSePreciso(sinal);
  if (tipo === "application/xml") return { dados: lerOrcamentoXml(bytes), tipo };
  let textoSemItens = null;
  if (tipo === "application/pdf") {
    pdfjs ??= await carregarPdfjs();
    try {
      const dados = await extrairOrcamento(bytes, { pdfjs });
      if (dados.itens.length) return { dados, tipo };
      textoSemItens = dados;
      aoProgresso({ fase: "Tentando OCR na tabela" });
    }
    catch (e) { if (!(e instanceof ErroOrcamento) || e.codigo !== "sem_texto") throw e; }
  }
  aoProgresso({ fase: "Preparando OCR" });
  criarWorker ??= (await import("../../vendor/tesseract/tesseract.esm.min.js")).default.createWorker;
  let worker;
  const abortar = () => { worker?.terminate().catch(() => {}); };
  sinal?.addEventListener("abort", abortar, { once: true });
  const paginas = [];
  try {
    worker = await criarWorker(["por", "eng"], 1, {
      workerPath: new URL("../../vendor/tesseract/worker.min.js", import.meta.url).href,
      workerBlobURL: false,
      logger: (m) => { if (m.status === "recognizing text") aoProgresso({ fase: "Reconhecendo texto", progresso: m.progress }); },
    });
    cancelarSePreciso(sinal);
    for await (const { canvas, pagina, total } of paginasDoArquivo(bytes, tipo, pdfjs, sinal)) {
      aoProgresso({ fase: "Lendo página", pagina, total });
      const primeira = (await worker.recognize(canvas, {}, { blocks: true })).data;
      let escolhida = primeira, imagemEscolhida = canvas, resultado = pontuar(primeira);
      if (resultado.itens.length === 0 || primeira.confidence < 65) {
        aoProgresso({ fase: "Refinando imagem", pagina, total });
        const limpa = limparGrade(canvas);
        const segunda = (await worker.recognize(limpa, {}, { blocks: true })).data;
        const outra = pontuar(segunda);
        if (outra.score > resultado.score) { escolhida = segunda; resultado = outra; imagemEscolhida = limpa; }
      }
      paginas.push({ data: escolhida, itens: resultado.itens, trechos: trechosOcr(escolhida, pagina, imagemEscolhida.width) });
      cancelarSePreciso(sinal);
    }
  } catch (e) {
    if (sinal?.aborted) throw falha("cancelado", "Leitura cancelada.");
    if (textoSemItens) return { dados: textoSemItens, tipo };
    if (e instanceof ErroOrcamento) throw e;
    throw falha("ocr_indisponivel", "Não foi possível iniciar o OCR. Confira sua conexão e tente novamente.");
  } finally {
    sinal?.removeEventListener("abort", abortar);
    await worker?.terminate().catch(() => {});
  }
  const texto = paginas.map((p) => p.data.text).join("\n");
  if (texto.replace(/\s/g, "").length < 30) {
    if (textoSemItens) return { dados: textoSemItens, tipo };
    throw falha("sem_texto", "A imagem não tem texto legível. Tente uma foto mais nítida e bem iluminada.");
  }
  const trechos = paginas.flatMap((p) => p.trechos);
  const dados = completarDadosOcr(interpretarOrcamento(montarLinhas(trechos), { largura: 600 }), texto);
  const itens = paginas.flatMap((p) => p.itens);
  if (itens.length > dados.itens.length) dados.itens = itens;
  if (!dados.itens.length && textoSemItens) return { dados: textoSemItens, tipo };
  if (dados.condicoes.subtotalCentavos == null && dados.itens.length && dados.itens.every((i) => i.totalCentavos != null)) {
    dados.condicoes.subtotalCentavos = dados.itens.reduce((s, i) => s + i.totalCentavos, 0);
  }
  dados.diagnostico = { ...dados.diagnostico, metodo: "ocr", paginas: paginas.length,
    confianca: Math.round(paginas.reduce((s, p) => s + (p.data.confidence ?? 0), 0) / paginas.length), revisaoObrigatoria: true };
  return { dados, tipo };
}
