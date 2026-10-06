// Ciclo da cotação: Rascunho → Aguardando propostas → Em análise → Decidida → Concluída. Cancelada vale a qualquer momento.

/** @type {Record<string,{rotulo:string, ordem:number}>} */
export const STATUS = {
  rascunho: { rotulo: "Rascunho", ordem: 0 },
  aguardando_propostas: { rotulo: "Aguardando propostas", ordem: 1 },
  em_analise: { rotulo: "Em análise", ordem: 2 },
  decidida: { rotulo: "Decidida", ordem: 3 },
  concluida: { rotulo: "Concluída", ordem: 4 },
  cancelada: { rotulo: "Cancelada", ordem: 5 },
};
export const LISTA_STATUS = Object.keys(STATUS);
export const rotuloStatus = (s) => STATUS[s]?.rotulo ?? s;

/** Passos que o usuário dá com um botão. Decidir e concluir passam pela aba Decisão. */
const AVANCOS = {
  rascunho: { para: "aguardando_propostas", rotulo: "Iniciar coleta de propostas" },
  aguardando_propostas: { para: "em_analise", rotulo: "Começar a análise" },
  em_analise: { aba: "decisao", rotulo: "Ir para a decisão" },
  decidida: { para: "concluida", rotulo: "Registrar aprovação recebida" },
};
export const proximoPasso = (status) => AVANCOS[status] ?? null;

/** Cotação encerrada: não aceita edição de itens e propostas. */
export const estaEncerrada = (status) => status === "concluida" || status === "cancelada";

/** Voltar um passo: reabrir análise depois de decidir ou concluir; reativar uma cancelada. */
export const voltar = (status) => ({ decidida: "em_analise", concluida: "em_analise", cancelada: "rascunho" })[status] ?? null;
