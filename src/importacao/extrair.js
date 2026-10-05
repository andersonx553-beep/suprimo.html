// extrairOrcamento(pdf): ponto único de entrada da extração. Hoje lê o texto do PDF (pdfjs) e aplica regras.
// Para acrescentar OCR ou IA no futuro, basta outra função com o mesmo retorno; o fluxo da tela não muda.
import { montarLinhas } from "./linhas.js";
import { interpretarOrcamento } from "./interpretar.js";

export const LIMITE_BYTES = 10 * 1024 * 1024;

/** Erro com `codigo` estável para a tela escolher a mensagem: 'invalido' | 'grande' | 'senha' | 'corrompido' | 'sem_texto'. */
export class ErroOrcamento extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.name = "ErroOrcamento"; this.codigo = codigo; }
}

export const MENSAGENS = {
  invalido: "Este arquivo não é um PDF. Escolha o orçamento em PDF.",
  grande: "O arquivo passa de 10 MB. Envie um PDF menor.",
  senha: "Este PDF tem senha. Abra no leitor de PDF, salve uma cópia sem senha e envie de novo.",
  corrompido: "Não foi possível abrir este PDF. Ele pode estar corrompido. Tente salvar de novo e enviar.",
  sem_texto: "Este documento é digitalizado e precisa de OCR. A leitura de PDF digitalizado ainda não existe no Suprimo.",
};
const erro = (codigo) => new ErroOrcamento(codigo, MENSAGENS[codigo]);

/** O arquivo começa com "%PDF-"? (o tipo informado pelo navegador pode mentir) */
export const pareceUmPdf = (bytes) => bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";

/** Lê os trechos de texto de cada página, com posição. Isolado porque é a única parte que fala com o pdfjs. */
export async function lerTrechos(pdfjs, bytes) {
  let doc, tarefa;
  try {
    tarefa = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, isEvalSupported: false });
    doc = await tarefa.promise;
  } catch (e) {
    if (e?.name === "PasswordException" || /password/i.test(e?.message ?? "")) throw erro("senha");
    throw erro("corrompido");
  }
  const trechos = [];
  let largura = 600;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vp = pagina.getViewport({ scale: 1 });
      if (n === 1) largura = vp.width;
      const conteudo = await pagina.getTextContent();
      for (const it of conteudo.items) {
        if (typeof it.str !== "string") continue;
        trechos.push({ p: n, x: it.transform[4], x2: it.transform[4] + it.width, y: vp.height - it.transform[5], h: it.height || Math.abs(it.transform[3]), texto: it.str });
      }
    }
  } catch { throw erro("corrompido"); }
  const paginas = doc.numPages;
  await tarefa.destroy?.();
  return { trechos, largura, paginas };
}

/**
 * @param {Uint8Array|ArrayBuffer} pdf  bytes do arquivo
 * @param {{pdfjs?:any}} [opcoes]       biblioteca pdfjs (no navegador vem de vendor/, nos testes de node_modules)
 * @returns {Promise<ReturnType<typeof interpretarOrcamento> & {diagnostico:object}>} JSON no formato do gabarito
 */
export async function extrairOrcamento(pdf, { pdfjs } = {}) {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  if (!pareceUmPdf(bytes)) throw erro("invalido");
  if (bytes.length > LIMITE_BYTES) throw erro("grande");
  pdfjs ??= await (await import("../lib/pdfjs.js")).carregarPdfjs();
  const { trechos, largura, paginas } = await lerTrechos(pdfjs, bytes);

  const caracteres = trechos.reduce((s, t) => s + t.texto.replace(/\s/g, "").length, 0);
  // Pouco texto = PDF de imagem. Não simulamos leitura: avisamos e paramos.
  if (caracteres < 120 || caracteres / paginas < 60) throw erro("sem_texto");

  const resultado = interpretarOrcamento(montarLinhas(trechos), { largura });
  resultado.diagnostico = { ...resultado.diagnostico, paginas, caracteres };
  return resultado;
}
