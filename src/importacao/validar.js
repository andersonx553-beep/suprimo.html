// Validações do orçamento lido. Só apontam: nunca corrigem nada em silêncio.
import { cnpjValido } from "../domain/cnpj.js";
import { totalLinha } from "../domain/dinheiro.js";
import { reais, numeroBr, dataBr } from "../lib/formato.js";

/** @typedef {{id:string, nivel:'erro'|'aviso'|'info', campo:string, mensagem:string}} Alerta */

const TOLERANCIA = 1; // 1 centavo de arredondamento

/** Campos que a tela destaca quando não foram encontrados. */
export function camposFaltando(d) {
  const f = d.fornecedor ?? {}, o = d.orcamento ?? {}, c = d.condicoes ?? {};
  const falta = [];
  const vazio = (v) => v == null || v === "";
  if (vazio(f.razaoSocial) && vazio(f.nomeFantasia)) falta.push("fornecedor.razaoSocial");
  if (vazio(f.cnpj)) falta.push("fornecedor.cnpj");
  if (vazio(o.numero)) falta.push("orcamento.numero");
  if (vazio(o.emissao)) falta.push("orcamento.emissao");
  if (vazio(o.validade)) falta.push("orcamento.validade");
  if (vazio(c.prazoEntrega)) falta.push("condicoes.prazoEntrega");
  if (vazio(c.pagamento)) falta.push("condicoes.pagamento");
  if (c.freteCentavos == null) falta.push("condicoes.freteCentavos");
  if (c.subtotalCentavos == null) falta.push("condicoes.subtotalCentavos");
  if (c.totalCentavos == null) falta.push("condicoes.totalCentavos");
  return falta;
}

/** @returns {Alerta[]} */
export function validarOrcamento(d, { hoje, nomeArquivo = "" }) {
  /** @type {Alerta[]} */
  const alertas = [];
  const add = (id, nivel, campo, mensagem) => alertas.push({ id, nivel, campo, mensagem });
  const f = d.fornecedor ?? {}, o = d.orcamento ?? {}, c = d.condicoes ?? {}, itens = d.itens ?? [];

  if (d.diagnostico?.metodo === "ocr") add("ocr-conferencia", "aviso", "itens", "Leitura por OCR: confira no arquivo original fornecedor, códigos, descrições, quantidades, preços, frete e total. O OCR pode trocar letras ou dígitos mesmo quando as contas fecham.");
  if (d.diagnostico?.metodo === "xml") add("xml-conferencia", "info", "itens", "XML de orçamento: confira os itens e condições antes de confirmar.");

  if (f.cnpj && !cnpjValido(f.cnpj)) add("cnpj", "erro", "fornecedor.cnpj", "O CNPJ não passa na conferência dos dígitos verificadores. Confira com o PDF.");
  if (!itens.length) add("sem-itens", "erro", "itens", "A leitura não encontrou itens. Confira o arquivo e adicione as linhas manualmente.");
  if (c.freteCentavos == null) add("frete-pendente", "aviso", "condicoes.freteCentavos", "O frete não foi informado. Confirme com o fornecedor antes de comparar o custo final; informe R$ 0,00 apenas se for incluso.");
  if (!o.validade && o.validadeTexto) add("validade-relativa", "aviso", "orcamento.validade", `Validade informada como ${o.validadeTexto}; confirme até quando a proposta vale.`);
  const numeroArquivo = nomeArquivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/(?:cotacao|proposta|orcamento)\s*(?:n[ºo.]*)?[\s._-]*(\d{2,7})/i)?.[1];
  const numeroDocumento = String(o.numero ?? "").match(/\d{2,7}/)?.[0];
  if (numeroArquivo && numeroDocumento && Number(numeroArquivo) !== Number(numeroDocumento)) {
    add("numero-arquivo", "aviso", "orcamento.numero", `O arquivo indica nº ${numeroArquivo}, mas o documento mostra nº ${o.numero}. Confira com o fornecedor.`);
  }

  itens.forEach((it, i) => {
    const n = it.numero ?? i + 1;
    if (it.quantidade != null && it.unitarioCentavos != null && it.totalCentavos != null) {
      const esperado = totalLinha(it.unitarioCentavos, it.quantidade);
      if (Math.abs(esperado - it.totalCentavos) > TOLERANCIA) {
        add(`item-${i}`, "erro", `itens.${i}`, `Item ${n}: ${numeroBr(it.quantidade)} × ${reais(it.unitarioCentavos)} = ${reais(esperado)}, mas o total lido é ${reais(it.totalCentavos)}.`);
      }
    } else {
      add(`item-${i}`, "aviso", `itens.${i}`, `Item ${n}: falta quantidade, valor unitário ou total.`);
    }
  });

  const somaItens = itens.reduce((s, it) => s + (it.totalCentavos ?? 0), 0);
  if (itens.length && c.subtotalCentavos != null && Math.abs(somaItens - c.subtotalCentavos) > TOLERANCIA) {
    add("subtotal", "erro", "condicoes.subtotalCentavos", `A soma dos itens (${reais(somaItens)}) é diferente do subtotal do documento (${reais(c.subtotalCentavos)}).`);
  }
  if (c.subtotalCentavos != null && c.totalCentavos != null && c.freteCentavos != null) {
    const esperado = c.subtotalCentavos - (c.descontoCentavos ?? 0) + (c.freteCentavos ?? 0);
    if (Math.abs(esperado - c.totalCentavos) > TOLERANCIA) {
      add("total", "erro", "condicoes.totalCentavos", `Subtotal ${reais(c.subtotalCentavos)} − desconto ${reais(c.descontoCentavos ?? 0)} + frete ${reais(c.freteCentavos ?? 0)} = ${reais(esperado)}, mas o total lido é ${reais(c.totalCentavos)}.`);
    }
  }
  if (o.emissao && o.validade && o.validade < o.emissao) {
    add("validade-anterior", "erro", "orcamento.validade", `A validade (${dataBr(o.validade)}) é anterior à emissão (${dataBr(o.emissao)}).`);
  } else if (o.validade && o.validade < hoje) {
    add("vencido", "aviso", "orcamento.validade", `Orçamento vencido: a validade era ${dataBr(o.validade)}. Confirme o preço com o fornecedor.`);
  }
  if (c.descontoPercentual != null && c.descontoCentavos != null && c.subtotalCentavos) {
    const esperado = Math.round((c.subtotalCentavos * c.descontoPercentual) / 100);
    if (Math.abs(esperado - c.descontoCentavos) > TOLERANCIA) {
      add("desconto", "aviso", "condicoes.descontoCentavos", `Desconto de ${c.descontoPercentual}% sobre ${reais(c.subtotalCentavos)} daria ${reais(esperado)}, mas o documento mostra ${reais(c.descontoCentavos)}.`);
    }
  }
  const fretes = d.diagnostico?.fretesVistos ?? [];
  if (new Set(fretes).size > 1) add("frete", "aviso", "condicoes.freteCentavos", "O PDF mostra valores de frete diferentes em lugares diferentes. Confira.");
  return alertas;
}

/** Verifica se este arquivo ou este orçamento já entrou no sistema. */
export function verificarDuplicidade(documentos, { hash, cnpj, numero }) {
  const mesmoArquivo = documentos.find((x) => x.fileHash === hash) ?? null;
  const mesmoOrcamento = cnpj && numero ? documentos.find((x) => x.cnpj === cnpj && x.numeroOrcamento === numero) ?? null : null;
  return { mesmoArquivo, mesmoOrcamento };
}
