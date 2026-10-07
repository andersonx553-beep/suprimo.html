// Formato XML próprio de orçamento do Suprimo (não é XML de NF-e).
// Valores monetários são centavos inteiros; datas são AAAA-MM-DD; quantidade usa ponto decimal.
import { ErroOrcamento } from "./extrair.js";

const erro = (mensagem) => new ErroOrcamento("xml_invalido", mensagem);
const limite = 10 * 1024 * 1024;
const filhos = (elemento) => Array.from(elemento?.childNodes ?? []).filter((x) => x.nodeType === 1);
const texto = (elemento, nome) => filhos(elemento).find((x) => x.tagName === nome)?.textContent?.trim() || null;
const filho = (elemento, nome) => filhos(elemento).find((x) => x.tagName === nome) ?? null;
const lista = (elemento, nome) => filhos(elemento).filter((x) => x.tagName === nome);
const etiqueta = (valor) => String(valor ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

function inteiro(valor, campo) {
  if (valor == null) return null;
  if (!/^(0|[1-9]\d{0,11})$/.test(valor)) throw erro(`${campo} deve ser um número inteiro de centavos.`);
  return Number(valor);
}
function quantidade(valor, campo) {
  if (valor == null || !/^(?:\d{1,9})(?:\.\d{1,3})?$/.test(valor) || Number(valor) <= 0) throw erro(`${campo} deve ser maior que zero (use ponto decimal).`);
  return Number(valor);
}
function data(valor, campo) {
  if (!valor) return null;
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw erro(`${campo} deve estar em AAAA-MM-DD.`);
  return valor;
}

/** A origem precisa ser um XML no formato documentado; nenhum XML fiscal é interpretado como orçamento. */
export function lerOrcamentoXml(bytes, { DOMParserImpl = globalThis.DOMParser } = {}) {
  if (bytes.length > limite) throw erro("O XML passa de 10 MB.");
  let origem;
  try { origem = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw erro("O XML precisa estar em UTF-8."); }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(origem)) throw erro("Por segurança, XML com DTD ou entidades externas não é aceito.");
  if (!DOMParserImpl) throw erro("Este navegador não oferece suporte à leitura de XML.");
  const xml = new DOMParserImpl().parseFromString(origem, "application/xml");
  if (xml.getElementsByTagName("parsererror").length || xml.documentElement?.tagName !== "orcamentoSuprimo" || xml.documentElement.getAttribute("versao") !== "1") {
    throw erro("XML inválido. Use um orçamento XML do Suprimo, versão 1 (não é XML de NF-e).");
  }
  const raiz = xml.documentElement;
  const f = filho(raiz, "fornecedor"), o = filho(raiz, "orcamento"), c = filho(raiz, "condicoes"), itensEl = filho(raiz, "itens");
  if (!f || !o || !c || !itensEl) throw erro("Faltam os blocos fornecedor, orcamento, condicoes ou itens.");
  const itens = lista(itensEl, "item").map((item, i) => {
    const descricao = texto(item, "descricao");
    if (!descricao) throw erro(`Item ${i + 1}: falta descrição.`);
    const numero = item.getAttribute("numero");
    if (numero && !/^[1-9]\d{0,4}$/.test(numero)) throw erro(`Item ${i + 1}: número inválido.`);
    return {
      numero: numero ? Number(numero) : i + 1, codigo: texto(item, "codigo"), descricao,
      unidade: texto(item, "unidade"), quantidade: quantidade(texto(item, "quantidade"), `Item ${i + 1}: quantidade`),
      unitarioCentavos: inteiro(texto(item, "unitarioCentavos"), `Item ${i + 1}: unitarioCentavos`),
      totalCentavos: inteiro(texto(item, "totalCentavos"), `Item ${i + 1}: totalCentavos`),
    };
  });
  if (!itens.length) throw erro("O XML não contém itens de orçamento.");
  const fornecedor = Object.fromEntries(["razaoSocial", "nomeFantasia", "cnpj", "telefone", "whatsapp", "email"].map((k) => [k, texto(f, k)]));
  if (!fornecedor.razaoSocial && !fornecedor.nomeFantasia) throw erro("Informe a razão social ou nome fantasia do fornecedor no XML.");
  const freteTipo = texto(c, "freteTipo");
  if (freteTipo && !["CIF", "FOB"].includes(freteTipo)) throw erro("freteTipo deve ser CIF ou FOB.");
  return {
    versao: 1, fornecedor,
    orcamento: { numero: texto(o, "numero"), emissao: data(texto(o, "emissao"), "Emissão"), validade: data(texto(o, "validade"), "Validade"), validadeDias: null, validadeTexto: null, vendedor: texto(o, "vendedor") },
    condicoes: {
      prazoEntrega: texto(c, "prazoEntrega"), prazoEntregaDias: null, pagamento: texto(c, "pagamento"), pagamentoDias: null,
      freteTipo, freteCentavos: inteiro(texto(c, "freteCentavos"), "freteCentavos"), freteTexto: null,
      descontoCentavos: inteiro(texto(c, "descontoCentavos"), "descontoCentavos"), descontoPercentual: null,
      subtotalCentavos: inteiro(texto(c, "subtotalCentavos"), "subtotalCentavos"), totalCentavos: inteiro(texto(c, "totalCentavos"), "totalCentavos"),
    },
    itens, diagnostico: { metodo: "xml", revisaoObrigatoria: true, fretesVistos: [] },
  };
}

/** Exporta a conferência editada para poder reimportá-la; sempre preserva centavos sem arredondar. */
export function gerarOrcamentoXml(dados) {
  if (!dados.itens?.length || dados.itens.some((i) => !i.descricao?.trim() || !(i.quantidade > 0))) throw erro("Preencha a descrição e a quantidade de todos os itens antes de baixar o XML.");
  const campo = (chave, valor, recuo = "    ") => valor == null || valor === "" ? "" : `${recuo}<${chave}>${etiqueta(valor)}</${chave}>\n`;
  const campos = (obj, nomes) => nomes.map((k) => campo(k, obj?.[k])).join("");
  const f = dados.fornecedor ?? {}, o = dados.orcamento ?? {}, c = dados.condicoes ?? {};
  if (!f.razaoSocial?.trim() && !f.nomeFantasia?.trim()) throw erro("Informe o fornecedor antes de baixar o XML.");
  const itens = dados.itens.map((i, pos) => {
    const camposItem = ["codigo", "descricao", "unidade", "quantidade", "unitarioCentavos", "totalCentavos"].map((k) => campo(k, i[k], "      ")).join("");
    return `    <item numero="${Number.isInteger(i.numero) && i.numero > 0 ? i.numero : pos + 1}">\n${camposItem}    </item>\n`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<orcamentoSuprimo versao="1">\n  <fornecedor>\n${campos(f, ["razaoSocial", "nomeFantasia", "cnpj", "telefone", "whatsapp", "email"])}  </fornecedor>\n  <orcamento>\n${campos(o, ["numero", "emissao", "validade", "vendedor"])}  </orcamento>\n  <condicoes>\n${campos(c, ["prazoEntrega", "pagamento", "freteTipo", "freteCentavos", "descontoCentavos", "subtotalCentavos", "totalCentavos"])}  </condicoes>\n  <itens>\n${itens}  </itens>\n</orcamentoSuprimo>\n`;
}
