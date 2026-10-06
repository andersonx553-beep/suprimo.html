// Plano B para linhas de tabela reconhecidas por OCR. Não substitui a conferência humana.
import { lerData, lerDinheiro, lerQuantidade } from "./numeros.js";

const MOEDA = /\bR\s*[$S]\s*([\d.]+[,.]\d{2,3})/gi;
const UNIDADE_QTD = /\b([IJ]?UNID\.?|UND\.?|[IJ]?UN|PC|RL|KG|M|L)\s*[|\]\[\s]*?(\d{1,5}(?:[.,]\d{1,2})?)\s*$/i;

function dinheiroOcr(valor) {
  const v = String(valor).trim();
  // Ponto decimal só é aceito quando não há vírgula e a moeda foi reconhecida ao lado.
  const normal = v.includes(",") ? v : v.replace(/\.(\d{2,3})$/, ",$1");
  return lerDinheiro(normal);
}

export function itensPorTextoOcr(texto) {
  const itens = [];
  for (const bruto of String(texto ?? "").split(/\r?\n/)) {
    const linha = bruto.trim().replace(/^[|\[\]\s]+/, "");
    const inicio = linha.match(/^(\d{1,7})[.\s|\]]+(.+)$/);
    if (!inicio) continue;
    const valores = [...linha.matchAll(MOEDA)].map((m) => ({ pos: m.index, centavos: dinheiroOcr(m[1]) })).filter((m) => m.centavos != null);
    if (valores.length < 2) continue;
    const antes = linha.slice(0, valores[0].pos).replace(/[|\[\]\s]+$/, "");
    const unidade = antes.match(UNIDADE_QTD);
    if (!unidade) continue;
    const quantidade = lerQuantidade(unidade[2]);
    const totalCentavos = valores.at(-1).centavos;
    if (!quantidade || totalCentavos == null) continue;
    const candidatos = valores.slice(0, -1);
    const unitarioCentavos = [...candidatos].reverse().find((v) => Math.abs(Math.round(v.centavos * quantidade) - totalCentavos) <= 1)?.centavos
      ?? candidatos[0].centavos;
    const descricao = antes.slice(inicio[0].length - inicio[2].length, unidade.index).replace(/^[|\[\]\s]+|[|\[\]\s]+$/g, "").trim();
    if (descricao.length < 6) continue;
    itens.push({
      numero: inicio[1].length <= 3 ? Number(inicio[1]) : itens.length + 1,
      codigo: inicio[1].length > 3 ? inicio[1] : null,
      descricao, unidade: unidade[1].replace(/^[IJ](?=UN)/i, "").toUpperCase(), quantidade, unitarioCentavos, totalCentavos,
    });
  }
  return itens;
}

/** Complementa campos que o texto com coordenadas perdeu, sem inventar preço, frete ou validade. */
export function completarDadosOcr(dados, texto) {
  const linhas = String(texto ?? "").split(/\r?\n/).map((s) => s.trim());
  const topo = linhas.slice(0, 12).join(" ");
  const fornecedor = dados.fornecedor;
  if (fornecedor.razaoSocial && fornecedor.nomeFantasia && !/[A-ZÀ-Ý]{3}/.test(fornecedor.nomeFantasia)) fornecedor.nomeFantasia = null;
  if (!fornecedor.razaoSocial) fornecedor.razaoSocial = topo.match(/([A-Za-zÀ-ÿ][^|\n]{8,100}\bLtda\b)/i)?.[1]?.trim() ?? null;
  if (!fornecedor.nomeFantasia && !fornecedor.razaoSocial) fornecedor.nomeFantasia = linhas.find((s) => /^.{0,10}\b[A-Z][A-Z ]{4,}\b(?:MATRIZ)?\s*$/.test(s))?.replace(/^[^A-Z]+/, "") ?? null;

  const orc = dados.orcamento;
  if (!orc.numero) orc.numero = topo.match(/\b\d{3,6}\/20\d{2}\b/)?.[0]
    ?? topo.match(/(?:OR[CÇ]AMENTO|PROPOSTA)\s*N[º°O.]?[.:\s]*(\d{3,7})/i)?.[1] ?? null;
  if (!orc.emissao) orc.emissao = lerData(topo.match(/(?:EMISS\S*|DATA)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]
    ?? topo.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/)?.[0] ?? "");
  if (orc.validadeDias > 90) { orc.validadeDias = null; orc.validadeTexto = null; } // OCR pode confundir "10" com "410".

  const c = dados.condicoes;
  if (!c.pagamento || c.pagamento === "=") {
    c.pagamento = linhas.map((l) => l.match(/(?:COND\.?\s*DE\s*PAGAMENTO|FORMA\s+DE\s+PAGAMENTO)\s*:?\s*([^|\n]+)/i)?.[1]?.trim())
      .find((v) => v && v !== "=") ?? null;
  }
  if (c.totalCentavos == null) {
    const ultima = linhas.filter((l) => /(?:TOTAL(?:\s*C\/\s*DESCONTO)?|VALOR\s+TOTAL)\s*[\]|:]?/i.test(l) && /R\s*[$S]/i.test(l)).at(-1);
    const valores = [...String(ultima ?? "").matchAll(MOEDA)];
    c.totalCentavos = valores.length ? dinheiroOcr(valores.at(-1)[1]) : null;
  }
  if (c.freteCentavos == null) {
    const logistica = linhas.find((l) => /log[ií]stica\s*:/i.test(l) && /R\s*[$S]/i.test(l));
    const v = logistica?.match(MOEDA)?.[0];
    if (v) c.freteCentavos = dinheiroOcr(v.replace(/^.*?R\s*[$S]\s*/i, ""));
  }
  return dados;
}
