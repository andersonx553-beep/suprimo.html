/**
 * Modelo de dados do Suprimo. Dinheiro sempre em centavos inteiros, datas em ISO (AAAA-MM-DD ou data-hora completa).
 *
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} descricao
 * @property {number} quantidade
 * @property {string} unidade
 * @property {string} especificacao
 *
 * @typedef {'nao_enviado'|'enviado'|'respondeu'|'recusou'} SituacaoConvite
 * @typedef {Object} Convite
 * @property {string} id
 * @property {string} fornecedorId
 * @property {SituacaoConvite} situacao
 * @property {string} enviadoEm   data-hora ISO, vazio se não enviado
 * @property {string} canal       'whatsapp' | 'email' | ''
 *
 * @typedef {Object} Anexo
 * @property {string} id @property {string} nome @property {string} tipo @property {number} tamanho
 *
 * @typedef {Object} Proposta
 * @property {string} id
 * @property {string} fornecedorId
 * @property {Object<string,{centavos:number, unidade?:string}>} precos  por id de item; ausente = não cotou
 * @property {number|null} freteCentavos  null = não informado; 0 = confirmado sem custo
 * @property {number|null} prazoEntregaDias
 * @property {{texto:string, dias:number|null}} pagamento
 * @property {string} validade     data ISO
 * @property {string} observacao
 * @property {Anexo[]} anexos
 *
 * @typedef {Object} Decisao
 * @property {'unico'|'porItem'} modo
 * @property {string} propostaId
 * @property {Object<string,string>} porItem   id do item → id da proposta
 * @property {string} justificativa
 * @property {string} decididaEm
 *
 * @typedef {'rascunho'|'aguardando_propostas'|'em_analise'|'decidida'|'concluida'|'cancelada'} StatusCotacao
 * @typedef {Object} Cotacao
 * @property {string} id            estável, nunca muda
 * @property {string} numero        COT-0001
 * @property {string} titulo
 * @property {string} solicitante
 * @property {string} destino
 * @property {string} prazoPropostas  data ISO
 * @property {string} observacoes
 * @property {StatusCotacao} status
 * @property {string} criadaEm
 * @property {string} atualizadaEm
 * @property {string} concluidaEm
 * @property {boolean} [exemplo]
 * @property {Item[]} itens
 * @property {Convite[]} convites
 * @property {Proposta[]} propostas
 * @property {Decisao|null} decisao
 *
 * @typedef {Object} Fornecedor
 * @property {string} id
 * @property {string} nome
 * @property {string} razaoSocial
 * @property {string} cnpj            só dígitos
 * @property {string} situacaoCadastral
 * @property {string} endereco
 * @property {string} telefone
 * @property {string} whatsapp
 * @property {string} email
 * @property {string[]} categorias
 * @property {string} observacao
 * @property {boolean} [exemplo]
 *
 * @typedef {Object} Ajustes
 * @property {{nome:string, cnpj:string}} empresa
 * @property {string} solicitante
 * @property {string} destinoPadrao
 * @property {string} modeloMensagem
 * @property {number} minPropostas
 * @property {number} prazoRespostaDias
 * @property {number} contadorCotacao  último número usado; nunca volta, mesmo apagando cotações
 */
export {};
