// Regras que transformam as linhas do PDF em orçamento. Sem DOM e sem pdfjs: recebe linhas, devolve dados.
// Formatos fixos (CNPJ, e-mail, telefone, data, R$) por expressão regular; o resto por rótulo próximo.
import { cnpjValido } from "../domain/cnpj.js";
import { lerDinheiro, lerQuantidade, lerData, semAcentoMaiusculo } from "./numeros.js";

/** @typedef {import('./linhas.js').Linha} Linha @typedef {import('./linhas.js').Celula} Celula */

const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const RE_FONE = /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/;
const RE_ENDERECO = /\b(rua|r\.|av\.?|avenida|travessa|tv\.|rodovia|rod\.|estrada|alameda|pra[cç]a|largo)\b|\bCEP\b/i;
const RE_SUFIXO_LEGAL = /\b(ltda|s\/?a|s\.a\.|eireli|epp|mei|me|ss)\b\.?\s*$/i;

const ROTULOS = {
  prazo: /^(?:prazo(?:\s+de)?\s+(?:entrega|despacho)|entrega|prazo)\b\s*:?\s*/i,
  pagamento: /^(?:cond(?:i[cç][aã]o|\.)?(?:\s+de)?\s+pag(?:amento|\.)?|forma\s+de\s+pag(?:amento)?|pagamento)\b\s*:?\s*/i,
  frete: /^frete\b\s*:?\s*/i,
  desconto: /^desconto\b(?:\s*\([^)]*\))?\s*:?\s*/i,
  subtotal: /^subtotal\b(?:\s+dos\s+itens)?\s*:?\s*/i,
  total: /^(?:\(=\)\s*)?(?:total\s+geral|valor\s+total|total\s+a\s+pagar|total\s+c\/\s*desconto|total(?:\s+do\s+(?:or[cç]amento|pedido|proposta))?)\b\s*:?\s*/i,
};
const ehRotulo = (texto) => Object.values(ROTULOS).some((r) => r.test(texto));

const limparPontas = (s) => String(s).replace(/^[\s:–-]+|[\s:–-]+$/g, "").trim();

// ---------- fornecedor ----------

const formatarFone = (t) => {
  const d = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t.trim();
};

/** Faixa do topo, antes do bloco do cliente ou da tabela: é onde mora o fornecedor. */
function zonaDoFornecedor(linhas) {
  const fim = linhas.findIndex((l, i) => i > 0 && (l.celulas.some((c) => /^(cliente|dados\s+do\s+cliente|destinat[aá]rio|para|nome)\s*:?$/i.test(c.texto)) || cabecalhoTabela(l) != null));
  return fim === -1 ? linhas.slice(0, 12) : linhas.slice(0, fim);
}

function extrairFornecedor(linhas, largura) {
  const zona = zonaDoFornecedor(linhas).filter((l) => l.p === 1 || l === linhas[0]);
  const esquerda = zona.flatMap((l) => l.celulas.filter((c) => c.x < largura * 0.62));
  const textoZona = zona.map((l) => l.texto).join("\n");

  // CNPJ: o primeiro com dígitos verificadores corretos; se nenhum for válido, devolve o primeiro e marca.
  const candidatos = [...textoZona.matchAll(RE_CNPJ)].map((m) => m[0].replace(/\D/g, ""));
  const cnpj = candidatos.find(cnpjValido) ?? candidatos[0] ?? null;

  const email = textoZona.match(RE_EMAIL)?.[0].toLowerCase() ?? null;
  const ie = textoZona.match(/\bIE\s*:?\s*([\d.\-/]{5,})/i)?.[1] ?? null;
  const tel = textoZona.match(/\bTel(?:efone)?\.?\s*:?\s*(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/i)?.[1];
  const zap = textoZona.match(/\bWhats(?:App)?\.?\s*:?\s*(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/i)?.[1];
  const semRotulo = tel || zap ? null : textoZona.match(RE_FONE)?.[0];

  const endereco = esquerda.map((c) => c.texto).find((t) => RE_ENDERECO.test(t)) ?? null;

  // Razão social: texto com sufixo legal; senão, a linha logo acima do CNPJ.
  const ehDado = (t) => RE_CNPJ.test(t) || RE_EMAIL.test(t) || RE_FONE.test(t) || RE_ENDERECO.test(t) || /^(tel|whats)/i.test(t);
  RE_CNPJ.lastIndex = 0;
  const textos = esquerda.map((c) => c.texto);
  let razao = textos.find((t) => RE_SUFIXO_LEGAL.test(t) && !ehDado(t)) ?? null;
  if (!razao) {
    const i = textos.findIndex((t) => /\bCNPJ\b/i.test(t));
    if (i > 0 && !ehDado(textos[i - 1])) razao = textos[i - 1];
  }
  RE_CNPJ.lastIndex = 0;

  // Nome fantasia: rótulo explícito ou o texto de maior fonte do canto superior esquerdo (a "marca").
  let fantasia = textoZona.match(/nome\s+fantasia\s*:?\s*(.+)/i)?.[1]?.trim() ?? null;
  const candidatosNome = zona.slice(0, 8).flatMap((l) => l.celulas).filter((c) => !ehDado(c.texto) && !/^(?:or[cç]amento|proposta|cota[cç][aã]o|n[ºo°]|data)\b/i.test(c.texto));
  if (!fantasia && candidatosNome.length) {
    const alturas = candidatosNome.map((c) => c.h).sort((a, b) => a - b);
    const mediana = alturas[Math.floor(alturas.length / 2)];
    const maior = candidatosNome.reduce((a, c) => (c.h > a.h ? c : a));
    if (maior.h >= mediana * 1.5 && maior.texto !== razao) fantasia = maior.texto;
  }
  if (!fantasia && !razao) fantasia = candidatosNome.find((c) => /[A-Za-z]{3}/.test(c.texto))?.texto ?? null;
  RE_CNPJ.lastIndex = 0;

  return {
    razaoSocial: razao, nomeFantasia: fantasia, cnpj, cnpjValido: cnpj ? cnpjValido(cnpj) : false,
    inscricaoEstadual: ie, telefone: tel ? formatarFone(tel) : semRotulo ? formatarFone(semRotulo) : null,
    whatsapp: zap ? formatarFone(zap) : null, email, endereco,
  };
}

// ---------- orçamento ----------

function extrairOrcamento(linhas) {
  const zona = zonaDoFornecedor(linhas);
  const texto = (zona.length ? zona : linhas.slice(0, 15)).map((l) => l.texto).join("\n");
  const todo = linhas.map((l) => l.texto).join("\n");
  const CODIGO = "([A-Z0-9][A-Z0-9\\-\\/.]*\\d[A-Z0-9\\-\\/]*)";
  // Candidatos ao número: nunca uma data; prefere o que mistura letras e dígitos (ORC-2026-0847).
  const candidatos = [
    ...texto.matchAll(new RegExp(`\\bn[ºo°]\\.?\\s*:?\\s*${CODIGO}`, "gi")),
    ...texto.matchAll(new RegExp(`(?:or[cç]amento|cota[cç][aã]o|proposta)\\s*(?:n[ºo°.]+|n[úu]mero)\\s*:?\\s*${CODIGO}`, "gi")),
    ...todo.matchAll(new RegExp(`(?:or[cç]amento|cota[cç][aã]o|proposta)\\s*(?:n[ºo°.]+|n[úu]mero)\\s*:?\\s*${CODIGO}`, "gi")),
  ].map((m) => m[1]).filter((c) => !/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(c));
  const numero = candidatos.find((c) => /[A-Za-z]/.test(c) && /\d/.test(c)) ?? candidatos[0] ?? null;

  const emissao = lerData(todo.match(/emiss[aã]o\s*(?:em)?\s*:?\s*([\d/.-]{6,10})/i)?.[1] ?? "") ?? lerData(todo.match(/\bdata\s*:?\s*([\d/.-]{6,10})/i)?.[1] ?? "");
  let validade = lerData(todo.match(/(?:validade(?:\s+da\s+proposta)?|v[aá]lid[ao]\s+at[eé])\s*:?\s*([\d/.-]{6,10})/i)?.[1] ?? "");
  let validadeDias = null;
  if (!validade) {
    const d = todo.match(/validade(?:\s+da\s+proposta)?\s*:?\s*(\d{1,3})\s*(?:dias|dd\b)/i)?.[1];
    if (d) validadeDias = Number(d);
  }
  const validadeTexto = todo.match(/validade(?:\s+da\s+proposta)?\s*:?\s*(\d{1,3}\s*(?:dias|dd\b)(?:\s+[uú]teis)?)/i)?.[1]?.trim() ?? null;
  const vendedor = limparPontas(todo.match(/(?:vendedor|representante|atendente)\s*:?\s*([^\n]+?)(?:\s{2,}|\n|$)/i)?.[1] ?? "") || null;
  return { numero, emissao, validade, validadeDias, validadeTexto, vendedor };
}

// ---------- rótulo e valor ----------

/** Para cada linha com um rótulo no início de uma célula, devolve o valor ao lado (mesma célula, células à direita ou linha de baixo). */
function acharRotulos(linhas, regex) {
  const achados = [];
  linhas.forEach((l, i) => {
    l.celulas.forEach((c, k) => {
      const m = c.texto.match(regex);
      if (!m) return;
      let valor = c.texto.slice(m[0].length).trim();
      if (!valor) {
        const partes = [];
        for (const prox of l.celulas.slice(k + 1)) {
          if (ehRotulo(prox.texto)) break;
          partes.push(prox.texto);
        }
        valor = partes.join(" ").trim();
      }
      if (!valor && linhas[i + 1] && Math.abs(linhas[i + 1].celulas[0]?.x - c.x) < 4) valor = linhas[i + 1].celulas[0].texto;
      achados.push({ rotulo: c.texto, valor, linha: i, x: c.x });
    });
  });
  return achados;
}

/** Totais em coluna separada ou logo abaixo do rótulo, sem confundir com o cabeçalho da tabela. */
function acharValorMonetario(linhas, regex) {
  for (let i = linhas.length - 1; i >= 0; i--) {
    const linha = linhas[i];
    const k = linha.celulas.findIndex((c) => regex.test(c.texto));
    if (k < 0) continue;
    const atual = linha.celulas.slice(k).map((c) => c.texto).join(" ");
    const valor = lerDinheiro(atual);
    if (valor != null) return valor;
    const prox = linhas[i + 1];
    if (prox?.p === linha.p && prox.y - linha.y < 22) {
      const c = prox.celulas.find((c) => Math.abs(c.x - linha.celulas[k].x) < 35 && lerDinheiro(c.texto) != null);
      if (c) return lerDinheiro(c.texto);
    }
  }
  return null;
}

function extrairCondicoes(linhas) {
  const prazo = acharRotulos(linhas, ROTULOS.prazo).find((a) => a.valor);
  const pagto = acharRotulos(linhas, ROTULOS.pagamento).findLast((a) => a.valor && !/^[=–-]$/.test(a.valor));
  const fretes = acharRotulos(linhas, ROTULOS.frete).filter((a) => a.valor);
  const desconto = acharRotulos(linhas, ROTULOS.desconto).find((a) => a.valor);
  const subtotalCentavos = acharValorMonetario(linhas, /^(?:\(=\)\s*)?subtotal\b/i);
  const totalCentavos = acharValorMonetario(linhas, ROTULOS.total);

  const dias = prazo?.valor.match(/(\d+)\s*dias?/i)?.[1];
  const diasPagto = /\d+\s*\/\s*\d+/.test(pagto?.valor ?? "") ? null : pagto?.valor.match(/(\d+)\s*(?:dias?|dd\b)/i)?.[1];

  // Frete: o valor com tipo (CIF/FOB) vem das condições; o bloco de totais confirma o valor.
  const comTipo = fretes.find((f) => /\b(CIF|FOB)\b/i.test(f.valor));
  const fretePrincipal = comTipo ?? fretes.find((f) => lerDinheiro(f.valor) != null) ?? fretes[0];
  const freteTexto = fretePrincipal?.valor ?? "";
  const freteTipo = freteTexto.match(/\b(CIF|FOB)\b/i)?.[1].toUpperCase() ?? null;
  const freteValores = fretes.map((f) => lerDinheiro(f.valor)).filter((v) => v != null);
  let freteCentavos = lerDinheiro(freteTexto);
  if (freteCentavos == null && /gr[aá]tis|incluso|sem\s+frete|por\s+nossa\s+conta/i.test(freteTexto)) freteCentavos = 0;
  if (freteCentavos == null) freteCentavos = acharValorMonetario(linhas, /^(?:\(\+\)\s*)?log[ií]stica\b/i);

  const todo = linhas.map((l) => l.texto).join("\n");
  const entregaTexto = todo.match(/\bpronta\s+entrega\b/i)?.[0]
    ?? todo.match(/disponibilidade\s+do\s+material\s*:\s*imediato/i)?.[0] ?? null;

  const percentual = desconto?.rotulo.match(/\((\d+(?:,\d+)?)\s*%\)/)?.[1];
  return {
    prazoEntrega: prazo ? limparPontas(prazo.valor) : entregaTexto,
    prazoEntregaDias: dias ? Number(dias) : null,
    pagamento: pagto ? limparPontas(pagto.valor) : null,
    pagamentoDias: diasPagto ? Number(diasPagto) : null,
    freteTipo, freteCentavos, freteTexto: freteTexto || null, descontoCentavos: desconto ? lerDinheiro(desconto.valor) : null,
    descontoPercentual: percentual ? Number(percentual.replace(",", ".")) : null,
    subtotalCentavos, totalCentavos,
    _fretesVistos: freteValores,
  };
}

// ---------- itens ----------

const CLASSES_CABECALHO = [
  ["item", /^(ITEM|ITM|SEQ|N[O°]?|#)\.?$/],
  ["foto", /^(FOTO|IMAGEM|IMG|FIGURA)$/],
  ["codigo", /^(COD|CODIGO|SKU|REF|REFERENCIA)\.?$/],
  ["descricao", /^(DESCRICAO|PRODUTO|MATERIAL|DISCRIMINACAO)/],
  ["unidade", /^(UN|UND|UNID|UNIDADE|UM)\.?$/],
  ["quantidade", /^(QTD|QTDE|QTE|QUANT|QUANTIDADE)\.?$/],
  ["unitario", /UNIT/],
  ["unitario", /^VALOR$/],
  ["total", /TOTAL/],
];

/** Se a linha é o cabeçalho da tabela de itens, devolve as colunas com a faixa (x..x2) de cada uma. */
function cabecalhoTabela(linha) {
  const colunas = {};
  for (const c of linha.celulas) {
    const t = semAcentoMaiusculo(c.texto).trim();
    const alvo = CLASSES_CABECALHO.find(([, re]) => re.test(t));
    if (alvo && !colunas[alvo[0]]) colunas[alvo[0]] = { x: c.x, x2: c.x2 };
  }
  const essenciais = ["descricao", "quantidade", "unitario", "total"].filter((k) => colunas[k]).length;
  return essenciais >= 3 && Object.keys(colunas).length >= 4 ? colunas : null;
}

const PARADA = /^(observa[cç][oõ]es?|totais|subtotal|total\s+geral|valor\s+total|condi[cç][oõ]es\s+gerais)\b/i;

function colunaDaCelula(c, colunas) {
  let melhor = null, melhorSobra = 0, melhorDist = Infinity;
  for (const [nome, f] of Object.entries(colunas)) {
    const sobra = Math.min(c.x2, f.x2) - Math.max(c.x, f.x);
    if (sobra > melhorSobra) { melhor = nome; melhorSobra = sobra; }
    else if (melhorSobra <= 0) {
      const dist = Math.min(Math.abs(c.x - f.x), Math.abs(c.x2 - f.x2));
      if (dist < melhorDist) { melhorDist = dist; if (dist < 25) melhor = nome; }
    }
  }
  return melhor;
}

function itensPorTabela(linhas) {
  let colunas = null;
  const itens = [];
  let anterior = null, yAnterior = 0, paginaAnterior = 0;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const prox = linhas[i + 1];
    const cab = cabecalhoTabela(l) ?? (prox?.p === l.p && prox.y - l.y < 7
      ? cabecalhoTabela({ celulas: [...l.celulas, ...prox.celulas] }) : null);
    if (cab) { colunas = cab; anterior = null; continue; }
    if (!colunas) continue;
    if (l.celulas.some((c) => PARADA.test(c.texto)) && !l.celulas.some((c) => colunaDaCelula(c, colunas) === "item" && /^\d+$/.test(c.texto))) { colunas = null; anterior = null; continue; }
    const campos = {};
    for (const c of l.celulas) {
      const nome = colunaDaCelula(c, colunas);
      if (!nome || nome === "foto") continue; // a coluna de fotos (inclusive texto dentro da imagem) é ignorada
      campos[nome] = campos[nome] ? `${campos[nome]} ${c.texto}` : c.texto;
    }
    const qtd = lerQuantidade(campos.quantidade);
    const unit = lerDinheiro(campos.unitario), tot = lerDinheiro(campos.total);
    const ehItem = campos.descricao && qtd != null && (unit != null || tot != null);
    if (ehItem) {
      anterior = {
        numero: campos.item && /^\d+$/.test(campos.item) ? Number(campos.item) : itens.length + 1,
        codigo: campos.codigo ?? null, descricao: campos.descricao, unidade: campos.unidade ?? null,
        quantidade: qtd, unitarioCentavos: unit, totalCentavos: tot,
      };
      itens.push(anterior); yAnterior = l.y; paginaAnterior = l.p;
    } else if (anterior && campos.descricao && !campos.quantidade && !campos.unitario && !campos.total && l.p === paginaAnterior && l.y - yAnterior < 22) {
      anterior.descricao += ` ${campos.descricao}`; yAnterior = l.y; // descrição que continua na linha de baixo
    }
  }
  return itens;
}

/** Plano B, sem cabeçalho: "01 [CÓDIGO] descrição UN 20 18,90 378,00" em uma linha só. */
function itensPorLinha(linhas) {
  const itens = [];
  const re = /^(\d{1,3})\s+(?:([A-Z0-9][A-Z0-9.\-/]{3,})\s+)?(.+?)\s+([A-Za-zçÇ²³]{1,4})\s+(\d+(?:[.,]\d+)?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
  for (const l of linhas) {
    const m = l.celulas.map((c) => c.texto).join(" ").match(re);
    if (!m) continue;
    const qtd = lerQuantidade(m[5]);
    if (qtd == null) continue;
    itens.push({ numero: Number(m[1]), codigo: m[2] ?? null, descricao: m[3].trim(), unidade: m[4], quantidade: qtd, unitarioCentavos: lerDinheiro(m[6]), totalCentavos: lerDinheiro(m[7]) });
  }
  return itens;
}

// ---------- tudo junto ----------

/**
 * @param {Linha[]} linhas
 * @param {{largura?:number}} [pagina]
 */
export function interpretarOrcamento(linhas, { largura = 600 } = {}) {
  const condicoes = extrairCondicoes(linhas);
  const { _fretesVistos, ...condicoesLimpas } = condicoes;
  let itens = itensPorTabela(linhas);
  let metodoItens = "tabela";
  if (!itens.length) { itens = itensPorLinha(linhas); metodoItens = itens.length ? "linhas" : "nenhum"; }
  if (condicoesLimpas.subtotalCentavos == null && itens.length && itens.every((it) => it.totalCentavos != null)) {
    condicoesLimpas.subtotalCentavos = itens.reduce((s, it) => s + it.totalCentavos, 0);
  }
  const orc = extrairOrcamento(linhas);
  return {
    versao: 1,
    fornecedor: extrairFornecedor(linhas, largura),
    orcamento: orc,
    condicoes: condicoesLimpas,
    itens,
    diagnostico: { metodoItens, fretesVistos: _fretesVistos },
  };
}
