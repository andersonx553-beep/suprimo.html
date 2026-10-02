// Dados de demonstração: material elétrico, 3 fornecedores. Um deles não cotou um item e outro cotou em unidade diferente.
// Tudo sai marcado com `exemplo: true` e pode ser apagado de uma vez.
import { hoje, somarDias } from "../lib/formato.js";

/** @param {()=>string} novoId */
export function criarExemplo(novoId) {
  const h = hoje();
  const agora = (dias, hora = "10:00:00") => `${somarDias(h, dias)}T${hora}.000Z`;
  const f = (n, extra) => ({ id: novoId(), exemplo: true, razaoSocial: "", situacaoCadastral: "", endereco: "", observacao: "", categorias: ["Material elétrico"], ...extra, nome: n });
  const fornecedores = [
    f("Eletro Brasil Comércio (exemplo)", { cnpj: "11222333000181", telefone: "(11) 3333-0001", whatsapp: "(11) 99999-0001", email: "vendas@eletrobrasil.exemplo", endereco: "Rua das Flores, 100, Campinas/SP" }),
    f("Casa Elétrica Norte (exemplo)", { cnpj: "44555666000181", telefone: "", whatsapp: "(11) 99999-0002", email: "orcamento@casanorte.exemplo", categorias: ["Material elétrico", "Ferramentas"] }),
    f("Distribuidora Volt (exemplo)", { cnpj: "77888999000181", telefone: "(11) 3333-0003", whatsapp: "(11) 99999-0003", email: "comercial@volt.exemplo" }),
  ];
  const [a, b, c] = fornecedores;

  const itemDe = (descricao, quantidade, unidade, especificacao = "") => ({ id: novoId(), descricao, quantidade, unidade, especificacao });
  const proposta = (forn, precos, extra) => ({
    id: novoId(), fornecedorId: forn.id, precos, freteCentavos: 0, prazoEntregaDias: 5, pagamento: { texto: "Boleto", dias: 28 },
    validade: somarDias(h, 10), observacao: "", anexos: [], ...extra,
  });
  const convite = (forn, situacao, dias) => ({ id: novoId(), fornecedorId: forn.id, situacao, enviadoEm: situacao === "nao_enviado" ? "" : agora(dias), canal: situacao === "nao_enviado" ? "" : "whatsapp" });

  // Cotação antiga, já concluída: alimenta o "último preço pago".
  const tomadaAntiga = itemDe("Tomada 2P+T 20A", 20, "un", "Padrão NBR 14136");
  const antiga = proposta(b, { [tomadaAntiga.id]: { centavos: 1550 } }, { freteCentavos: 0, prazoEntregaDias: 2 });
  const concluida = {
    id: novoId(), exemplo: true, numero: "COT-0001", titulo: "Tomadas para o galpão 1", solicitante: "Auxiliar do almoxarifado", destino: "Galpão 1",
    prazoPropostas: somarDias(h, -80), observacoes: "", status: "concluida", criadaEm: agora(-90), atualizadaEm: agora(-85), concluidaEm: agora(-85),
    itens: [tomadaAntiga], convites: [convite(b, "respondeu", -90)], propostas: [antiga],
    decisao: { modo: "unico", propostaId: antiga.id, porItem: {}, justificativa: "", decididaEm: agora(-86) },
  };

  const itens = [
    itemDe("Tomada 2P+T 20A", 20, "un", "Padrão NBR 14136"),
    itemDe("Cabo flexível 2,5 mm² 750 V", 100, "m", "Azul"),
    itemDe("Disjuntor monopolar 20 A", 10, "un", "Curva C, DIN"),
    itemDe("Fita isolante 19 mm x 20 m", 12, "rl", "Antichama"),
    itemDe("Eletroduto corrugado 3/4\"", 8, "rl", "Rolo de 25 m"),
  ];
  const [tomada, cabo, disjuntor, fita, eletroduto] = itens;
  const emAnalise = {
    id: novoId(), exemplo: true, numero: "COT-0002", titulo: "Material elétrico da manutenção do galpão 2", solicitante: "Auxiliar do almoxarifado",
    destino: "Galpão 2", prazoPropostas: somarDias(h, -1), observacoes: "Obra começa na semana que vem.", status: "em_analise",
    criadaEm: agora(-6), atualizadaEm: agora(-1), concluidaEm: "", itens,
    convites: [convite(a, "respondeu", -6), convite(b, "respondeu", -6), convite(c, "respondeu", -5)],
    propostas: [
      // Completa e mais cara: o tomada está 28% acima do último pago.
      proposta(a, { [tomada.id]: { centavos: 1990 }, [cabo.id]: { centavos: 420 }, [disjuntor.id]: { centavos: 1450 }, [fita.id]: { centavos: 690 }, [eletroduto.id]: { centavos: 5800 } },
        { freteCentavos: 4500, prazoEntregaDias: 3, pagamento: { texto: "Boleto", dias: 28 } }),
      // Não cotou a fita: incompleta, fora da sugestão, mas pode ganhar itens na compra dividida.
      proposta(b, { [tomada.id]: { centavos: 1650 }, [cabo.id]: { centavos: 395 }, [disjuntor.id]: { centavos: 1320 }, [eletroduto.id]: { centavos: 6100 } },
        { freteCentavos: 0, prazoEntregaDias: 2, pagamento: { texto: "À vista", dias: null }, validade: somarDias(h, 5) }),
      // Cotou o cabo por rolo, não por metro: unidade diferente da pedida.
      proposta(c, { [tomada.id]: { centavos: 1780 }, [cabo.id]: { centavos: 41000, unidade: "rl" }, [disjuntor.id]: { centavos: 1510 }, [fita.id]: { centavos: 650 }, [eletroduto.id]: { centavos: 5450 } },
        { freteCentavos: 8000, prazoEntregaDias: 5, pagamento: { texto: "Boleto", dias: 21 }, validade: somarDias(h, 15) }),
    ],
    decisao: null,
  };
  return { fornecedores, cotacoes: [concluida, emAnalise], contadorCotacao: 2 };
}
