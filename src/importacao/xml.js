// Importação de orçamento: o formato próprio preserva centavos; outros XMLs são mapeados
// por campos explícitos e passam pela mesma conferência antes de salvar.
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

const chave = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const nome = (el) => chave(el?.localName || el?.tagName?.split(":").at(-1));
const procurar = (el, nomes) => filhos(el).find((x) => nomes.includes(nome(x))) ?? null;
const valor = (el, nomes) => {
  const direto = procurar(el, nomes)?.textContent?.trim();
  if (direto) return direto;
  return Array.from(el?.attributes ?? []).find((a) => nomes.includes(chave(a.localName || a.name)))?.value?.trim() || null;
};
const bloco = (raiz, nomes) => {
  const pilha = [raiz];
  let visitados = 0;
  while (pilha.length) {
    const atual = pilha.shift();
    if (++visitados > 10000) throw erro("O XML tem elementos demais para leitura segura.");
    if (nomes.includes(nome(atual))) return atual;
    pilha.push(...filhos(atual));
  }
  return null;
};
const centavos = (v) => {
  if (v == null) return null;
  let s = v.replace(/^\s*R\$\s*/i, "").replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return /^\d{1,12}(?:\.\d{1,6})?$/.test(s) && Number.isSafeInteger(Math.round(Number(s) * 100)) ? Math.round(Number(s) * 100) : null;
};
const decimal = (v) => v && /^\d{1,9}(?:[.,]\d{1,6})?$/.test(v.trim()) && Number(v.replace(",", ".")) > 0 ? Number(v.replace(",", ".")) : null;
const dataLivre = (v) => {
  if (!v) return null;
  const s = /^\d{2}\/\d{2}\/\d{4}$/.test(v) ? `${v.slice(6)}-${v.slice(3, 5)}-${v.slice(0, 2)}` : v.slice(0, 10);
  try { return data(s, "Data"); } catch { return null; }
};

function lerXmlOrcamentoDiverso(raiz) {
  // Uma NF-e comprova operação fiscal; seus valores não representam proposta de orçamento.
  if (bloco(raiz, ["infnfe"])) throw erro("Este XML é de nota fiscal. Envie o XML do orçamento do fornecedor para importar uma proposta.");
  const f = bloco(raiz, ["fornecedor", "supplier", "vendor", "seller", "emitente"]);
  const cab = bloco(raiz, ["header", "cabecalho"]) ?? bloco(raiz, ["orcamento", "cotacao", "proposta", "quotation", "quote"]) ?? raiz;
  const c = bloco(raiz, ["condicoes", "conditions", "resumo", "totais", "totals", "summary"]) ?? cab;
  const itensBloco = bloco(raiz, ["itens", "items", "produtos", "products", "linhas", "lines", "detalhes"]);
  const buscaItens = itensBloco ?? raiz;
  const itens = [];
  const pilha = [buscaItens];
  let visitados = 0;
  while (pilha.length) {
    const el = pilha.shift();
    if (++visitados > 10000) throw erro("O XML tem elementos demais para leitura segura.");
    if (["item", "produto", "product", "linha", "line", "detalhe"].includes(nome(el))) {
      const descricao = valor(el, ["descricao", "description", "nome", "name", "xprod"]);
      if (descricao) {
        itens.push({
          numero: itens.length + 1,
          codigo: valor(el, ["codigo", "code", "sku", "cprod"]), descricao,
          unidade: valor(el, ["unidade", "unit", "ucom"]),
          quantidade: decimal(valor(el, ["quantidade", "quantity", "qtd", "qty", "qcom"])),
          unitarioCentavos: centavos(valor(el, ["precounitario", "valorunitario", "unitprice", "preco", "vuncom"])),
          totalCentavos: centavos(valor(el, ["valortotal", "totalitem", "linetotal", "total", "vprod"])),
        });
        continue;
      }
    }
    pilha.push(...filhos(el));
  }
  if (!itens.length) throw erro("Não identifiquei os itens deste XML de orçamento. Envie um exemplo para adaptar a leitura.");
  const fornecedor = {
    razaoSocial: valor(f, ["razaosocial", "nome", "xnome", "companyname", "name"]),
    nomeFantasia: valor(f, ["nomefantasia", "xfant", "fantasia"]),
    cnpj: valor(f, ["cnpj", "taxid"]), telefone: valor(f, ["telefone", "phone", "fone"]),
    whatsapp: valor(f, ["whatsapp"]), email: valor(f, ["email", "emailaddress"]),
  };
  // Sem bloco de fornecedor, só campos que dizem expressamente "fornecedor" são atribuídos.
  if (!f) fornecedor.razaoSocial = valor(raiz, ["nomefornecedor", "fornecedornome", "suppliername"]);
  const freteTipo = valor(c, ["fretetipo", "tipofrete", "shippingtype"]);
  return {
    versao: 1, fornecedor,
    orcamento: {
      numero: valor(cab, ["numeroorcamento", "numeroproposta", "numerocotacao", "quotationnumber", "numero", "number"]),
      emissao: dataLivre(valor(cab, ["dataemissao", "emissao", "issuedate", "date"])),
      validade: dataLivre(valor(cab, ["datavalidade", "validade", "validuntil", "expirydate"])),
      validadeDias: null, validadeTexto: null, vendedor: valor(cab, ["vendedor", "salesperson"]),
    },
    condicoes: {
      prazoEntrega: valor(c, ["prazoentrega", "deliverytime", "entrega"]), prazoEntregaDias: null,
      pagamento: valor(c, ["pagamento", "condicaopagamento", "paymentterms"]), pagamentoDias: null,
      freteTipo: ["CIF", "FOB"].includes(freteTipo?.toUpperCase()) ? freteTipo.toUpperCase() : null,
      freteCentavos: centavos(valor(c, ["valorfrete", "frete", "shippingcost"])), freteTexto: null,
      descontoCentavos: centavos(valor(c, ["valordesconto", "desconto", "discountamount"])), descontoPercentual: null,
      subtotalCentavos: centavos(valor(c, ["subtotal", "valorsubtotal", "productstotal"])),
      totalCentavos: centavos(valor(c, ["valortotal", "totalgeral", "grandtotal", "total"])),
    },
    itens, diagnostico: { metodo: "xml", formato: "externo", revisaoObrigatoria: true, fretesVistos: [] },
  };
}

/** Lê XML próprio ou estrutura de orçamento com campos reconhecíveis; exige conferência. */
export function lerOrcamentoXml(bytes, { DOMParserImpl = globalThis.DOMParser } = {}) {
  if (bytes.length > limite) throw erro("O XML passa de 10 MB.");
  let origem;
  try { origem = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw erro("O XML precisa estar em UTF-8."); }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(origem)) throw erro("Por segurança, XML com DTD ou entidades externas não é aceito.");
  if (!DOMParserImpl) throw erro("Este navegador não oferece suporte à leitura de XML.");
  const xml = new DOMParserImpl().parseFromString(origem, "application/xml");
  if (xml.getElementsByTagName("parsererror").length || !xml.documentElement) throw erro("XML inválido ou malformado.");
  const raiz = xml.documentElement;
  if (raiz.tagName !== "orcamentoSuprimo") return lerXmlOrcamentoDiverso(raiz);
  if (raiz.getAttribute("versao") !== "1") throw erro("Versão do XML do Suprimo não suportada.");
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
