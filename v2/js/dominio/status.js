// Ciclo da cotação. Recusa do chefe volta para "Em análise"; "Cancelada" vale em qualquer etapa.
export const STATUS = ["Rascunho", "Aguardando propostas", "Em análise", "Aguardando aprovação", "Aprovada", "Comprada", "Recebida"];
export const CANCELADA = "Cancelada";

/** Ação principal de cada etapa (rótulo do botão e próximo status). A aprovação é tratada na aba Decisão. */
export const PROXIMO = {
  "Rascunho": { para: "Aguardando propostas", rotulo: "Marcar como enviada" },
  "Aguardando propostas": { para: "Em análise", rotulo: "Começar análise" },
  "Em análise": { para: "Aguardando aprovação", rotulo: "Enviar para aprovação" },
  "Aguardando aprovação": { aba: "decisao", rotulo: "Registrar decisão do chefe" },
  "Aprovada": { para: "Comprada", rotulo: "Marcar como comprada" },
  "Comprada": { para: "Recebida", rotulo: "Marcar como recebida" },
};

/** Tom da etiqueta: amarelo só para "aguardando você" (Em análise, Aguardando aprovação). */
export const TOM = {
  "Rascunho": "neutro", "Aguardando propostas": "neutro",
  "Em análise": "espera", "Aguardando aprovação": "espera",
  "Aprovada": "ok", "Comprada": "ok", "Recebida": "ok-cheio", "Cancelada": "ruim",
};
