// Dados de exemplo: uma cotação de material elétrico com 3 fornecedores, um deles sem cotar um item.
// Tudo aqui é marcado como exemplo (exemplo: true) e some quando a pessoa apaga ou restaura.
import { hojeIso, somarDias } from "../dominio/formato.js";

export const MODELO_CONVITE = `Olá, {{fornecedor}}. Aqui é {{solicitante}}, do almoxarifado {{empresa}}.

Preciso de cotação ({{numero}}) para:
{{itens}}

Informe por item: preço unitário, frete, prazo de entrega, forma de pagamento e validade da proposta.
Prazo para responder: {{prazo}}.

Agradeço desde já.`;

export const AJUSTES_PADRAO = {
  empresa: { nome: "", cnpj: "" },
  solicitante: "",
  minPropostas: 3,
  prazoPadraoDias: 3,
  modeloConvite: MODELO_CONVITE,
  tema: "",
};

export function criarExemplo() {
  const hoje = hojeIso();
  const fornecedores = [
    { id: "for-1", exemplo: true, nome: "Eletro Brasil Comércio Ltda", cnpj: "11222333000181", cnpjVerificado: false, whatsapp: "(11) 99999-0001", email: "vendas@eletrobrasil.exemplo", segmentos: ["Material elétrico"] },
    { id: "for-2", exemplo: true, nome: "Casa Elétrica Norte", cnpj: "44555666000181", cnpjVerificado: false, whatsapp: "(11) 99999-0002", email: "orcamento@casanorte.exemplo", segmentos: ["Material elétrico", "Ferramentas"] },
    { id: "for-3", exemplo: true, nome: "Distribuidora Volt", cnpj: "77888999000181", cnpjVerificado: false, whatsapp: "(11) 99999-0003", email: "comercial@volt.exemplo", segmentos: ["Material elétrico"] },
  ];

  const itens = [
    { id: "it-1", descricao: "Tomada 2P+T 20A", qtd: 20, un: "un", spec: "Padrão NBR 14136, 250 V" },
    { id: "it-2", descricao: "Cabo flexível 2,5 mm² 750 V", qtd: 100, un: "m", spec: "Azul, rolo de 100 m" },
    { id: "it-3", descricao: "Disjuntor monopolar 20A", qtd: 10, un: "un", spec: "Curva C, DIN" },
    { id: "it-4", descricao: "Fita isolante 19 mm x 20 m", qtd: 12, un: "rl", spec: "Antichama" },
    { id: "it-5", descricao: "Eletroduto corrugado 3/4\"", qtd: 8, un: "rl", spec: "Rolo de 25 m" },
  ];

  const cotacao = {
    id: "cot-1",
    exemplo: true,
    numero: "COT-0001",
    titulo: "Material elétrico — manutenção do galpão 2",
    status: "Em análise",
    criadaEm: somarDias(hoje, -6),
    prazoPropostas: somarDias(hoje, -1),
    solicitante: "",
    itens,
    convites: [
      { fornecedorId: "for-1", enviadoEm: somarDias(hoje, -6), canal: "whatsapp", respondeu: true },
      { fornecedorId: "for-2", enviadoEm: somarDias(hoje, -6), canal: "email", respondeu: true },
      { fornecedorId: "for-3", enviadoEm: somarDias(hoje, -5), canal: "whatsapp", respondeu: true },
    ],
    propostas: [
      {
        id: "pr-1", fornecedorId: "for-1", frete: 45, prazoEntrega: 3, pagamento: "28 dias", validade: somarDias(hoje, 10), anexos: [],
        precos: { "it-1": { preco: 19.9 }, "it-2": { preco: 4.2 }, "it-3": { preco: 14.5 }, "it-4": { preco: 6.9 }, "it-5": { preco: 58 } },
      },
      {
        id: "pr-2", fornecedorId: "for-2", frete: 0, prazoEntrega: 2, pagamento: "À vista", validade: somarDias(hoje, 5), anexos: [],
        precos: { "it-1": { preco: 16.5 }, "it-2": { preco: 3.95 }, "it-3": { preco: 13.2 }, "it-5": { preco: 61 } },
      },
      {
        id: "pr-3", fornecedorId: "for-3", frete: 80, prazoEntrega: 5, pagamento: "21 dias", validade: somarDias(hoje, 15), anexos: [],
        precos: { "it-1": { preco: 17.8 }, "it-2": { preco: 4.4 }, "it-3": { preco: 15.1 }, "it-4": { preco: 6.5 }, "it-5": { preco: 54.5 } },
      },
    ],
    decisao: { modo: "unico", propostaId: "", porItem: {}, justificativa: "", aprovacao: null },
  };

  // Histórico de preços do exemplo: a tomada já foi paga a R$ 15,50, então R$ 19,90 acende o aviso de alta.
  const precos = [
    { chave: "tomada 2p+t 20a", preco: 15.5, fornecedorId: "for-2", data: somarDias(hoje, -90), cotacao: "COT-0000", exemplo: true },
    { chave: "cabo flexivel 2,5 mm² 750 v", preco: 4.1, fornecedorId: "for-1", data: somarDias(hoje, -90), cotacao: "COT-0000", exemplo: true },
  ];

  return { cotacoes: [cotacao], fornecedores, precos };
}
