// Correspondência técnica entre itens de fornecedores.
// A descrição original nunca é alterada: este módulo só normaliza para comparar e explica a decisão.
import { semAcento } from "../domain/mapa.js";
import { normalizarUnidade } from "../domain/unidades.js";

const IGNORAR = new Set(["de","da","do","das","dos","com","para","e","em","a","o","um","uma","x","c","b","p","pvc","mm","cm","un","und","pc","pca","peca","abnt","ti"]);
const MARCAS = new Map([["tigre","tigre"],["tigr","tigre"],["amanco","amanco"],["docol","docol"],["krona","krona"],["plastilit","plastilit"]]);
const ALIAS = {
  adap:"adaptador", adapt:"adaptador", adaptador:"adaptador", adaptadores:"adaptador",
  sold:"soldavel", soldavel:"soldavel", soldaveis:"soldavel",
  rosc:"rosca", rosca:"rosca", roscavel:"rosca", roscaveis:"rosca",
  ct:"curto", curt:"curto", curta:"curto", curto:"curto",
  red:"reducao", reducao:"reducao", redutora:"reducao", redutor:"reducao",
  lg:"longo", longa:"longo", longo:"longo",
  uniao:"uniao", unioes:"uniao", correr:"correr",
  mista:"misto", mista:"misto", misto:"misto",
  rap:"rapido", rapido:"rapido",
  luvas:"luva", registros:"registro", joelhos:"joelho", buchas:"bucha", tubos:"tubo",
  esfera:"esfera", gaveta:"gaveta", fecho:"fecho",
};
const FAMILIAS = new Set(["adaptador","bucha","luva","joelho","registro","uniao","tubo","cabo","torneira","sifao"]);
const TECNICOS = ["soldavel","rosca","curto","longo","reducao","uniao","correr","misto","esfera","gaveta","fecho","rapido"];
const CRITICOS = new Set(["correr","misto","esfera","gaveta","fecho"]);

const arr = (s) => [...s];
const igualConjunto = (a, b) => a.size === b.size && arr(a).every((x) => b.has(x));
const textoMedidas = (ns) => ns.length ? ns.join(" × ") : "";

function analisarDescricao(descricao) {
  const s = semAcento(descricao).toLowerCase()
    .replace(/[º°]/g, " ")
    .replace(/(\d)\s*[x×]\s*(\d)/g, "$1 x $2")
    .replace(/\b([12])1\/([24])\b/g, "$1 1/$2")
    .replace(/(\d)(mm|cm)\b/g, "$1 $2")
    .replace(/\b(\d+)\s+(1\/\d+)\b/g, "$1e$2");
  const brutos = s.match(/\d+(?:e\d+\/\d+|\/\d+|[.,]\d+)?|[a-z]+/g) ?? [];
  const numeros = brutos.filter((t) => /^\d/.test(t)).map((t) => t.replace(",", "."));
  const marca = brutos.map((t) => MARCAS.get(t)).find(Boolean) ?? null;
  const palavras = new Set(brutos.filter((t) => !/^\d/.test(t)).map((t) => ALIAS[t] ?? t).filter((t) => !IGNORAR.has(t) && !MARCAS.has(t)));
  const familia = arr(palavras).find((t) => FAMILIAS.has(t)) ?? null;
  if (familia && familia !== "tubo") palavras.delete("tubo");
  const tecnicos = new Set(TECNICOS.filter((t) => palavras.has(t)));
  return { palavras, numeros, marca, familia, tecnicos };
}

function pesoPalavra(t) {
  if (FAMILIAS.has(t)) return 3;
  if (TECNICOS.includes(t)) return 2;
  return 1;
}

function similaridadeLexica(x, y) {
  const vocabulario = new Set([...x.palavras, ...y.palavras]);
  let comum = 0, total = 0;
  for (const t of vocabulario) {
    const w = pesoPalavra(t);
    total += w;
    if (x.palavras.has(t) && y.palavras.has(t)) comum += w;
  }
  return total ? comum / total : 0;
}

const rotuloTecnico = {
  soldavel: "soldável", rosca: "rosca/roscável", curto: "curto", longo: "longo",
  reducao: "redução", uniao: "união", correr: "de correr", misto: "misto",
  esfera: "registro esfera", gaveta: "registro gaveta", fecho: "fecho rápido", rapido: "rápido",
};

/**
 * Compara dois itens e devolve score + explicação técnica.
 * Aceita string ou {descricao, unidade}. Medida ou família divergente bloqueia ligação automática.
 */
export function analisarCorrespondencia(a, b) {
  const itemA = typeof a === "string" ? { descricao: a } : (a ?? {});
  const itemB = typeof b === "string" ? { descricao: b } : (b ?? {});
  const x = analisarDescricao(itemA.descricao), y = analisarDescricao(itemB.descricao);
  const motivos = [], diferencas = [];

  if (!x.palavras.size || !y.palavras.size) return { score: 0, percentual: 0, classificacao: "incompativel", motivos, diferencas: ["Descrição insuficiente para comparar."], recomendacao: "nao_ligar" };
  if (itemA.unidade && itemB.unidade && normalizarUnidade(itemA.unidade) !== normalizarUnidade(itemB.unidade)) {
    return { score: 0, percentual: 0, classificacao: "incompativel", motivos, diferencas: [`Unidade diferente: ${itemA.unidade} × ${itemB.unidade}.`], recomendacao: "nao_ligar" };
  }
  if (x.familia && y.familia && x.familia !== y.familia) {
    return { score: 0, percentual: 0, classificacao: "incompativel", motivos, diferencas: [`Família diferente: ${x.familia} × ${y.familia}.`], recomendacao: "nao_ligar" };
  }
  if (x.numeros.length && y.numeros.length && x.numeros.join("|") !== y.numeros.join("|")) {
    return { score: 0, percentual: 0, classificacao: "incompativel", motivos, diferencas: [`Medida diferente: ${textoMedidas(x.numeros)} × ${textoMedidas(y.numeros)}.`], recomendacao: "nao_ligar" };
  }

  if (x.familia && x.familia === y.familia) motivos.push(`Mesma família: ${x.familia}.`);
  if (x.numeros.length && x.numeros.join("|") === y.numeros.join("|")) motivos.push(`Mesmas medidas: ${textoMedidas(x.numeros)}.`);
  if (x.marca && y.marca && x.marca === y.marca) motivos.push(`Mesma marca identificada: ${x.marca}.`);
  else if (x.marca && y.marca && x.marca !== y.marca) diferencas.push(`Marca diferente: ${x.marca} × ${y.marca}.`);

  const comunsTecnicos = TECNICOS.filter((t) => x.tecnicos.has(t) && y.tecnicos.has(t));
  if (comunsTecnicos.length) motivos.push(`Características em comum: ${comunsTecnicos.map((t) => rotuloTecnico[t]).join(", ")}.`);

  const apenasX = TECNICOS.filter((t) => x.tecnicos.has(t) && !y.tecnicos.has(t));
  const apenasY = TECNICOS.filter((t) => y.tecnicos.has(t) && !x.tecnicos.has(t));
  if (apenasX.length || apenasY.length) {
    const partes = [];
    if (apenasX.length) partes.push(`só no importado: ${apenasX.map((t) => rotuloTecnico[t]).join(", ")}`);
    if (apenasY.length) partes.push(`só no candidato: ${apenasY.map((t) => rotuloTecnico[t]).join(", ")}`);
    diferencas.push(`Especificação técnica diferente (${partes.join("; ")}).`);
  }

  let score = similaridadeLexica(x, y);
  if (x.familia && x.familia === y.familia) score = Math.max(score, 0.45);
  if (x.numeros.length && x.numeros.join("|") === y.numeros.join("|")) score += (1 - score) * 0.28;
  const critica = [...CRITICOS].some((t) => x.tecnicos.has(t) !== y.tecnicos.has(t));
  if (critica) score *= 0.82;
  if (x.marca && y.marca && x.marca !== y.marca) score *= 0.96;
  score = Math.max(0, Math.min(1, score));

  const classificacao = score >= 0.82 && !critica ? "forte" : score >= 0.5 ? "revisao" : "baixa";
  const recomendacao = classificacao === "forte" ? "pode_ligar" : classificacao === "revisao" ? "validacao_manual" : "nao_ligar";
  return { score, percentual: Math.round(score * 100), classificacao, motivos, diferencas, recomendacao };
}

/** Mantida para compatibilidade com telas/testes existentes. */
export function semelhanca(a, b) {
  return analisarCorrespondencia(a, b).score;
}

export const LIMIAR = 0.82;
const LIMIAR_POSSIVEL = 0.5;

export function candidatosCorrespondencia(itemOrcamento, itensCotacao) {
  return itensCotacao.map((c) => ({ id: c.id, descricao: c.descricao, unidade: c.unidade, ...analisarCorrespondencia(itemOrcamento, c) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.descricao.localeCompare(b.descricao, "pt-BR"));
}

function candidatos(itensOrcamento, itensCotacao) {
  return itensOrcamento.map((o, i) => candidatosCorrespondencia(o, itensCotacao).map((p) => ({ ...p, i, s: p.score })));
}

/** Liga automaticamente apenas pares fortes, únicos e claramente melhores que o segundo candidato. */
export function sugerirCorrespondencias(itensOrcamento, itensCotacao) {
  const candidatosPorLinha = candidatos(itensOrcamento, itensCotacao);
  const resultado = Array(itensOrcamento.length).fill(null);
  const usados = new Set();
  const fortes = candidatosPorLinha.flatMap((lista) => lista.length && lista[0].s >= LIMIAR &&
    lista[0].classificacao === "forte" && lista[0].s - (lista[1]?.s ?? 0) >= 0.08 ? [lista[0]] : []);
  fortes.sort((a, b) => b.s - a.s);
  for (const p of fortes) if (!usados.has(p.id)) { resultado[p.i] = p.id; usados.add(p.id); }
  return resultado;
}

/** Pares menos certos para revisão individual, sem reutilizar item já ligado. */
export function sugerirPossiveis(itensOrcamento, itensCotacao, correspondencia) {
  const usados = new Set(correspondencia.filter((id) => id && id !== "novo"));
  const lista = [];
  for (const pares of candidatos(itensOrcamento, itensCotacao)) {
    if (correspondencia[pares[0]?.i]) continue;
    const melhor = pares.find((p) => !usados.has(p.id) && p.s >= LIMIAR_POSSIVEL);
    if (!melhor) continue;
    lista.push(melhor); usados.add(melhor.id);
  }
  return lista;
}
