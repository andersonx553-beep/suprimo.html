// Sugere correspondências entre fornecedores sem confundir medidas ou tipos de peça.
// Liga automaticamente só os pares fortes; os demais são apresentados para conferência.
import { semAcento } from "../domain/mapa.js";
import { normalizarUnidade } from "../domain/unidades.js";

const IGNORAR = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "em", "a", "o", "um", "uma", "x", "c", "b", "p", "pvc", "mm", "un", "und", "abnt", "ti"]);
const MARCAS = new Map([["tigre", "tigre"], ["tigr", "tigre"], ["amanco", "amanco"], ["docol", "docol"]]);
const ALIAS = {
  adap: "adaptador", adapt: "adaptador", adaptador: "adaptador", adaptadores: "adaptador",
  sold: "soldavel", soldavel: "soldavel", soldaveis: "soldavel",
  rosc: "rosca", rosca: "rosca", roscavel: "rosca",
  ct: "curto", curt: "curto", curta: "curto", curto: "curto",
  red: "reducao", reducao: "reducao", redutora: "reducao",
  lg: "longo", longa: "longo", longo: "longo",
  uniao: "uniao", unioes: "uniao", correr: "correr",
  luvas: "luva", registros: "registro", joelhos: "joelho", buchas: "bucha",
};
const FAMILIAS = new Set(["adaptador", "bucha", "luva", "joelho", "registro", "uniao", "tubo", "cabo", "torneira", "sifao"]);

function analisar(descricao) {
  const s = semAcento(descricao).toLowerCase()
    .replace(/(\d)\s*[x×]\s*(\d)/g, "$1 x $2")
    .replace(/\b([12])1\/([24])\b/g, "$1 1/$2") // 11/2 = 1 1/2; 21/2 = 2 1/2
    .replace(/(\d)(mm|cm)\b/g, "$1 $2")
    .replace(/\b(\d+)\s+(1\/\d+)\b/g, "$1e$2");
  const brutos = s.match(/\d+(?:e\d+\/\d+|\/\d+|[.,]\d+)?|[a-z]+/g) ?? [];
  const numeros = brutos.filter((t) => /^\d/.test(t)).map((t) => t.replace(",", "."));
  const marca = brutos.map((t) => MARCAS.get(t)).find(Boolean) ?? null;
  const palavras = new Set(brutos.filter((t) => !/^\d/.test(t)).map((t) => ALIAS[t] ?? t).filter((t) => !IGNORAR.has(t) && !MARCAS.has(t)));
  const familia = [...palavras].find((t) => FAMILIAS.has(t)) ?? null;
  if (familia && familia !== "tubo") palavras.delete("tubo");
  return { palavras, numeros, marca, familia };
}

/** 0 a 1; tamanho ou família divergente impede uma ligação automática. */
export function semelhanca(a, b) {
  const x = analisar(a), y = analisar(b);
  if (!x.palavras.size || !y.palavras.size) return 0;
  if (x.familia && y.familia && x.familia !== y.familia) return 0;
  if (x.marca && y.marca && x.marca !== y.marca) return 0;
  if (x.numeros.join("|") !== y.numeros.join("|")) return 0;
  if (x.palavras.has("gaveta") !== y.palavras.has("gaveta")) return 0;
  const vocabulario = new Set([...x.palavras, ...y.palavras, ...x.numeros, ...y.numeros]);
  let comum = 0, total = 0;
  for (const t of vocabulario) {
    const w = /^\d/.test(t) ? 3 : FAMILIAS.has(t) ? 2 : 1;
    total += w;
    if ((x.palavras.has(t) || x.numeros.includes(t)) && (y.palavras.has(t) || y.numeros.includes(t))) comum += w;
  }
  return comum / total;
}

export const LIMIAR = 0.82;
const LIMIAR_POSSIVEL = 0.5;

function candidatos(itensOrcamento, itensCotacao) {
  return itensOrcamento.map((o, i) => itensCotacao.map((c) => ({ i, id: c.id, descricao: c.descricao,
    s: o.unidade && c.unidade && normalizarUnidade(o.unidade) !== normalizarUnidade(c.unidade) ? 0 : semelhanca(o.descricao, c.descricao),
  })).filter((p) => p.s > 0).sort((a, b) => b.s - a.s));
}

/** Liga automaticamente apenas pares únicos com semelhança alta e distância do segundo candidato. */
export function sugerirCorrespondencias(itensOrcamento, itensCotacao) {
  const candidatosPorLinha = candidatos(itensOrcamento, itensCotacao);
  const resultado = Array(itensOrcamento.length).fill(null);
  const usados = new Set();
  const fortes = candidatosPorLinha.flatMap((lista) => lista.length && lista[0].s >= LIMIAR &&
    lista[0].s - (lista[1]?.s ?? 0) >= 0.1 ? [lista[0]] : []);
  fortes.sort((a, b) => b.s - a.s);
  for (const p of fortes) if (!usados.has(p.id)) { resultado[p.i] = p.id; usados.add(p.id); }
  return resultado;
}

/** Pares menos certos para aprovação conjunta, sem reutilizar um item já ligado. */
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
