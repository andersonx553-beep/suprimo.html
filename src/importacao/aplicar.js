// Monta, sem gravar nada, o que "Confirmar orçamento" vai salvar: fornecedor, itens novos, proposta e documento.
import { normalizarUnidade } from "../domain/unidades.js";

/**
 * @param {{
 *   cotacao: import('../domain/tipos.js').Cotacao, dados: any, correspondencia: (string|null|'novo')[],
 *   fornecedores: import('../domain/tipos.js').Fornecedor[],
 *   arquivo: {nome:string, tamanho:number, tipo:string}, hash: string, agora: string, novoId: ()=>string
 * }} entrada
 */
export function montarImportacao({ cotacao, dados, correspondencia, fornecedores, arquivo, hash, agora, novoId }) {
  const f = dados.fornecedor, o = dados.orcamento, c = dados.condicoes;
  const avisos = [];

  // Fornecedor: pelo CNPJ; sem CNPJ, pelo nome idêntico; senão cria.
  const cnpj = (f.cnpj ?? "").replace(/\D/g, "");
  const nome = (f.nomeFantasia || f.razaoSocial || "").trim();
  const existente = (cnpj && fornecedores.find((x) => x.cnpj === cnpj))
    || (!cnpj && nome && fornecedores.find((x) => x.nome.toLowerCase() === nome.toLowerCase())) || null;
  const fornecedor = existente ?? {
    id: novoId(), nome, razaoSocial: f.razaoSocial ?? "", cnpj, situacaoCadastral: "", endereco: f.endereco ?? "",
    telefone: f.telefone ?? "", whatsapp: f.whatsapp ?? "", email: f.email ?? "", categorias: [],
    observacao: `Cadastrado ao importar o orçamento ${o.numero ?? ""}`.trim(),
  };

  // Itens: os ligados usam o item da cotação; "novo" entra na cotação com a descrição do orçamento.
  const novosItens = [];
  const precos = {};
  const usados = new Set();
  const linhas = dados.itens.map((it, i) => {
    const alvo = correspondencia[i];
    let itemId = null;
    if (alvo === "novo") {
      const novo = { id: novoId(), descricao: it.descricao.trim(), quantidade: it.quantidade ?? 1, unidade: normalizarUnidade(it.unidade ?? "") || "un", especificacao: it.codigo ? `Código ${it.codigo}` : "" };
      novosItens.push(novo); itemId = novo.id;
    } else if (alvo) itemId = alvo;
    if (itemId && usados.has(itemId)) { avisos.push(`O item ${it.numero ?? i + 1} foi ligado a um item que já recebeu preço; ficou só o primeiro.`); itemId = null; }
    if (itemId) {
      usados.add(itemId);
      if (it.unitarioCentavos != null) {
        const itemCotacao = novosItens.find((n) => n.id === itemId) ?? cotacao.itens.find((x) => x.id === itemId);
        const diverge = itemCotacao && it.unidade && normalizarUnidade(it.unidade) !== normalizarUnidade(itemCotacao.unidade);
        precos[itemId] = { centavos: it.unitarioCentavos, ...(diverge ? { unidade: it.unidade } : {}) };
      }
    }
    return { ...it, itemId };
  });

  const propostaId = novoId();
  const documentoId = novoId();
  const anexoId = novoId();
  const proposta = {
    id: propostaId, fornecedorId: fornecedor.id, precos,
    freteCentavos: c.freteCentavos ?? 0, freteTipo: c.freteTipo ?? "", descontoCentavos: c.descontoCentavos ?? 0,
    prazoEntregaDias: c.prazoEntregaDias ?? null, prazoEntregaTexto: c.prazoEntrega ?? "",
    pagamento: { texto: c.pagamento ?? "", dias: c.pagamentoDias ?? null }, validade: o.validade ?? "", observacao: "",
    anexos: [{ id: anexoId, nome: arquivo.nome, tipo: arquivo.tipo || "application/pdf", tamanho: arquivo.tamanho }],
    status: "confirmada", origem: "importada", documentoId,
    orcamento: { numero: o.numero ?? "", emissao: o.emissao ?? "", vendedor: o.vendedor ?? "", subtotalCentavos: c.subtotalCentavos ?? null, totalCentavos: c.totalCentavos ?? null, itens: linhas },
  };
  const documento = {
    id: documentoId, fileHash: hash, nome: arquivo.nome, tamanho: arquivo.tamanho, cnpj, numeroOrcamento: o.numero ?? "",
    cotacaoId: cotacao.id, propostaId, anexoId, importadoEm: agora,
  };
  return { fornecedor, fornecedorNovo: !existente, novosItens, proposta, documento, avisos, ligados: usados.size };
}
