// Importar orçamento: escolher PDF/JPG/PNG ou até três XMLs → conferir cada arquivo → confirmar.
// Nada é salvo antes de "Confirmar orçamento".
import { html, montar } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { reais, reaisCampo, numeroBr, dataBr, hoje } from "../../lib/formato.js";
import { lerCentavos } from "../../domain/dinheiro.js";
import { cnpjMascara } from "../../domain/cnpj.js";
import { estaEncerrada, rotuloStatus } from "../../domain/status.js";
import { ErroOrcamento, MENSAGENS, LIMITE_BYTES, pareceUmPdf } from "../../importacao/extrair.js";
import { extrairDocumento, tipoDocumento } from "../../importacao/ocr.js";
import { gerarOrcamentoXml } from "../../importacao/xml.js";
import { baixarTexto } from "../../lib/arquivo.js";
import { sha256Hex } from "../../importacao/hash.js";
import { sugerirCorrespondencias, sugerirPossiveis, semelhanca, candidatosCorrespondencia, analisarCorrespondencia } from "../../importacao/mapear.js";
import { validarOrcamento, camposFaltando, verificarDuplicidade } from "../../importacao/validar.js";
import { montarImportacao } from "../../importacao/aplicar.js";
import { novoId } from "../../state/store.js";
import { linkCotacao, ir } from "../roteador.js";
import { confirmar } from "../componentes/dialogo.js";
import { avisar } from "../componentes/aviso.js";
import { estadoVazio } from "../componentes/pecas.js";
import { selecionarProposta } from "./abas/propostas.js";
import { carregarPdfjs } from "../../lib/pdfjs.js";

const pegar = (obj, caminho) => caminho.split(".").reduce((o, k) => o?.[k], obj);
function por(obj, caminho, valor) {
  const ks = caminho.split(".");
  const ultimo = ks.pop();
  ks.reduce((o, k) => o[k], obj)[ultimo] = valor;
}
const num = (t) => { const n = Number(String(t).replace(/\./g, "").replace(",", ".")); return String(t).trim() !== "" && Number.isFinite(n) ? n : null; };

/** @returns {() => void} limpeza */
export function telaImportar(raiz, { store, rota }) {
  let cot = store.cotacao(rota.numero);
  const voltarPara = linkCotacao(rota.numero, "propostas");
  if (!cot || estaEncerrada(cot.status)) {
    montar(raiz, estadoVazio({ icone: "cotacoes", titulo: !cot ? "Cotação não encontrada" : `Cotação ${rotuloStatus(cot.status).toLowerCase()}`,
      texto: !cot ? `Não existe ${rota.numero} neste navegador.` : "Cotações concluídas ou canceladas não recebem propostas. Reabra a análise para importar.", acoes: html`<a class="botao botao--primario" href="${cot ? voltarPara : "#/cotacoes"}">Voltar</a>` }));
    return () => {};
  }

  const e = { fase: "escolher", erro: null, arquivo: null, bytes: null, tipo: null, hash: "", url: "", dados: null, correspondencia: [], automaticas: 0, automaticasIndices: new Set(), validadas: new Set(), linhaSelecionada: 0, candidatoEscolhido: {}, sujo: false, duplicidade: null, abort: null, progresso: null, lote: [], posicao: 0, confirmados: 0 };
  let ativo = true;
  const limparUrl = () => { if (e.url) URL.revokeObjectURL(e.url); e.url = ""; };
  const emLote = () => e.lote.length > 1;
  const proximo = () => {
    limparUrl();
    if (++e.posicao < e.lote.length) receber(e.lote[e.posicao]);
    else ir(voltarPara);
  };

  // ---------- fase 1: escolher o arquivo ----------
  function desenharEscolher() {
    const dup = e.erro?.codigo === "duplicado" ? e.erro : null;
    montar(raiz, html`
      <a class="voltar" href="${voltarPara}">${icone("voltar", 16)}Propostas de ${cot.numero}</a>
      <header class="pagina__cab"><div><p class="pagina__sobre">${cot.numero} · ${cot.titulo}</p><h1 class="pagina__titulo">Importar orçamento</h1></div></header>
      <section class="cartao">
        ${e.erro ? html`<p class="faixa" data-tom="perigo" role="alert">${icone("alerta", 16)}<span>${e.erro.mensagem}${dup?.onde ? html` <a href="${dup.onde}">Abrir a proposta</a>` : ""}</span></p>` : ""}
        ${emLote() ? html`<p class="faixa" data-tom="info">Arquivo ${e.posicao + 1} de ${e.lote.length} · ${e.confirmados} ${e.confirmados === 1 ? "proposta confirmada" : "propostas confirmadas"} nesta seleção.</p>` : ""}
        <button type="button" class="dropzone" data-escolher>
          ${icone("subir", 34)}
          <strong>Arraste os orçamentos aqui</strong>
          <span>ou clique para escolher até 3 XMLs juntos</span>
          <small>Também aceita um PDF, JPG ou PNG. Até 10 MB por arquivo. Cada orçamento é conferido e confirmado separadamente.</small>
        </button>
        <input type="file" accept="application/pdf,image/jpeg,image/png,application/xml,text/xml,.pdf,.jpg,.jpeg,.png,.xml" multiple hidden data-arquivo aria-label="Escolher até três arquivos XML de orçamento">
        ${emLote() ? html`<button class="botao" data-pular>${e.posicao + 1 < e.lote.length ? "Pular este arquivo e ler o próximo" : "Voltar às propostas"}</button>` : ""}
      </section>`);
    const entrada = raiz.querySelector("[data-arquivo]"), zona = raiz.querySelector("[data-escolher]");
    zona.addEventListener("click", () => entrada.click());
    entrada.addEventListener("change", () => { const arquivos = Array.from(entrada.files); entrada.value = ""; receberSelecao(arquivos); });
    zona.addEventListener("dragover", (ev) => { ev.preventDefault(); zona.dataset.arrastando = "true"; });
    zona.addEventListener("dragleave", () => { zona.dataset.arrastando = "false"; });
    zona.addEventListener("drop", (ev) => { ev.preventDefault(); zona.dataset.arrastando = "false"; receberSelecao(Array.from(ev.dataTransfer?.files ?? [])); });
    raiz.querySelector("[data-pular]")?.addEventListener("click", proximo);
  }

  function receberSelecao(arquivos) {
    if (!arquivos.length) return;
    e.erro = null;
    if (arquivos.length > 3 || (arquivos.length > 1 && arquivos.some((a) => !/\.xml$/i.test(a.name)))) {
      e.lote = []; e.posicao = 0; e.confirmados = 0;
      e.erro = { codigo: "invalido", mensagem: "Selecione até 3 XMLs juntos. PDF, JPG ou PNG devem ser importados individualmente." };
      desenharEscolher(); return;
    }
    e.lote = arquivos; e.posicao = 0; e.confirmados = 0;
    receber(arquivos[0]);
  }

  function desenharLendo() {
    montar(raiz, html`<section class="cartao" aria-live="polite"><div class="vazio">${icone("relogio", 34)}<h2 class="vazio__titulo">${e.progresso?.fase ?? "Lendo arquivo"}…</h2><p class="vazio__texto">${e.arquivo?.name}${e.progresso?.pagina ? ` · página ${e.progresso.pagina}/${e.progresso.total}` : ""}${e.progresso?.progresso != null ? ` · ${Math.round(e.progresso.progresso * 100)}%` : ""}</p><button class="botao" data-parar>Cancelar leitura</button></div></section>`);
    raiz.querySelector("[data-parar]").addEventListener("click", () => { e.abort?.abort(); e.fase = "escolher"; e.progresso = null; desenhar(); });
  }

  async function receber(arquivo) {
    if (!arquivo) return;
    e.erro = null;
    const falha = (codigo, mensagem = MENSAGENS[codigo], extra = {}) => { e.fase = "escolher"; e.erro = { codigo, mensagem, ...extra }; if (ativo) desenhar(); };
    if (arquivo.size > LIMITE_BYTES) return falha("grande", "O arquivo passa de 10 MB. Envie um arquivo menor.");
    const extensao = arquivo.name.toLowerCase().match(/\.(pdf|jpe?g|png|xml)$/)?.[1];
    if (!extensao) return falha("invalido", "Use um arquivo PDF, JPG, PNG ou XML de orçamento.");
    e.abort = new AbortController();
    const controle = e.abort;
    e.fase = "lendo"; e.arquivo = arquivo; e.progresso = null; desenhar();
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const tipo = tipoDocumento(bytes);
      const esperado = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", xml: "application/xml" }[extensao];
      if (tipo !== esperado) return falha("invalido", "O conteúdo não corresponde ao formato do arquivo (PDF, JPG, PNG ou XML).");
      const hash = await sha256Hex(bytes);
      const doc = store.documentoPorHash(hash);
      if (doc) {
        const origem = store.estado.cotacoes.find((c) => c.id === doc.cotacaoId);
        return falha("duplicado", "Este orçamento já foi importado.", { onde: origem ? linkCotacao(origem.numero, "propostas") : null });
      }
      const { dados } = await extrairDocumento(bytes, { sinal: controle.signal, aoProgresso: (progresso) => {
        if (ativo && e.abort === controle && e.fase === "lendo") { e.progresso = progresso; desenharLendo(); }
      } });
      if (!ativo || controle.signal.aborted) return;
      e.bytes = bytes; e.tipo = tipo; e.hash = hash; e.dados = dados;
      e.duplicidade = verificarDuplicidade(store.estado.documentos, { hash, cnpj: dados.fornecedor.cnpj, numero: dados.orcamento.numero });
      const automaticas = sugerirCorrespondencias(dados.itens, cot.itens);
      e.correspondencia = automaticas.map((id) => id ?? (cot.itens.length ? "" : "novo"));
      e.automaticasIndices = new Set(automaticas.map((id, i) => id ? i : -1).filter((i) => i >= 0));
      e.validadas = new Set();
      e.candidatoEscolhido = {};
      e.linhaSelecionada = Math.max(0, automaticas.findIndex((id) => !id));
      if (e.linhaSelecionada < 0) e.linhaSelecionada = 0;
      e.automaticas = cot.itens.length ? e.correspondencia.filter(Boolean).length : 0;
      limparUrl(); e.url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
      e.fase = "conferir"; e.sujo = false;
      desenhar();
    } catch (erro) {
      if (!ativo || controle.signal.aborted) return;
      if (erro instanceof ErroOrcamento) return falha(erro.codigo, erro.message);
      falha("corrompido", "Não foi possível ler o arquivo. Tente outro.");
    } finally {
      if (e.abort === controle) e.abort = null;
    }
  }

  // ---------- fase 2: conferência ----------
  const faltando = () => new Set(camposFaltando(e.dados));
  const possiveis = () => sugerirPossiveis(e.dados.itens, cot.itens, e.correspondencia);
  const semSimilar = () => e.dados.itens.map((it, i) => ({ it, i })).filter(({ it, i }) => !e.correspondencia[i]
    && !cot.itens.some((c) => semelhanca(it.descricao, c.descricao) >= 0.5));
  const alertasAtuais = () => {
    const lista = validarOrcamento(e.dados, { hoje: hoje(), nomeArquivo: e.arquivo?.name });
    const nSem = e.dados.itens.filter((_, i) => !e.correspondencia[i]).length;
    if (e.dados.itens.length && nSem) lista.push({ id: "sem-ligacao", nivel: "info", campo: "itens", mensagem: `${nSem} ${nSem === 1 ? "item não está ligado" : "itens não estão ligados"} a um item da cotação: ${nSem === 1 ? "fica" : "ficam"} guardado${nSem === 1 ? "" : "s"} no orçamento, mas ${nSem === 1 ? "não entra" : "não entram"} no mapa.` });
    e.dados.itens.forEach((it, i) => {
      const alvo = cot.itens.find((x) => x.id === e.correspondencia[i]);
      if (alvo && it.quantidade != null && it.quantidade !== alvo.quantidade) lista.push({ id: `qtd-${i}`, nivel: "info", campo: `itens.${i}`, mensagem: `Item ${it.numero ?? i + 1}: a cotação pede ${numeroBr(alvo.quantidade)} ${alvo.unidade}, o orçamento cota ${numeroBr(it.quantidade)} ${it.unidade ?? ""}.` });
    });
    if (e.duplicidade?.mesmoOrcamento) {
      const c = store.estado.cotacoes.find((x) => x.id === e.duplicidade.mesmoOrcamento.cotacaoId);
      lista.unshift({ id: "mesmo-orcamento", nivel: "aviso", campo: "orcamento.numero", mensagem: `Já existe o orçamento ${e.dados.orcamento.numero} deste CNPJ${c ? ` em ${c.numero}` : ""}. Pode ser uma nova versão do mesmo orçamento.` });
    }
    return lista;
  };

  const candidatosDaLinha = (i) => {
    const it = e.dados.itens[i];
    if (!it || !cot.itens.length) return [];
    return candidatosCorrespondencia(it, cot.itens).map((c) => ({
      ...c,
      ocupadoPor: e.correspondencia.findIndex((id, j) => j !== i && id === c.id),
    }));
  };
  const statusDaLinha = (i) => {
    const alvo = e.correspondencia[i];
    if (alvo === "novo") return { id: "novo", rotulo: "Item novo", tom: "info" };
    if (alvo) {
      if (e.validadas.has(i)) return { id: "confirmado", rotulo: "Confirmado", tom: "ok" };
      if (e.automaticasIndices.has(i)) return { id: "automatico", rotulo: "Automático", tom: "ok" };
      return { id: "confirmado", rotulo: "Confirmado", tom: "ok" };
    }
    const candidatos = candidatosDaLinha(i);
    if (candidatos.some((c) => c.score >= 0.5 && c.ocupadoPor < 0)) return { id: "pendente", rotulo: "Pendente", tom: "aviso" };
    return { id: "sem_equivalente", rotulo: "Sem equivalente", tom: "perigo" };
  };
  const candidatoAtivo = (i) => {
    const candidatos = candidatosDaLinha(i);
    const escolhido = e.candidatoEscolhido[i] || (e.correspondencia[i] && e.correspondencia[i] !== "novo" ? e.correspondencia[i] : "");
    return candidatos.find((c) => c.id === escolhido && c.ocupadoPor < 0)
      ?? candidatos.find((c) => c.ocupadoPor < 0)
      ?? candidatos[0]
      ?? null;
  };
  const resumoVariacao = (c) => {
    if (!c) return "Nenhum candidato técnico compatível encontrado";
    if (c.diferencas?.length) return c.diferencas[0];
    if (c.classificacao === "forte") return "Correspondência técnica forte";
    return "Revisar especificação";
  };
  const tomScore = (c) => !c ? "perigo" : c.classificacao === "forte" ? "ok" : c.classificacao === "revisao" ? "aviso" : "perigo";

  const comparadorInteligente = () => {
    const d = e.dados;
    const total = d.itens.length;
    const estados = d.itens.map((_, i) => statusDaLinha(i));
    const automaticos = estados.filter((x) => x.id === "automatico" || x.id === "confirmado").length;
    const pendentes = estados.filter((x) => x.id === "pendente").length;
    const semEq = estados.filter((x) => x.id === "sem_equivalente").length;
    const i = Math.min(Math.max(e.linhaSelecionada, 0), Math.max(0, total - 1));
    const it = d.itens[i];
    if (!it) return html`<div class="comparador-vazio">Adicione um item para iniciar a comparação.</div>`;
    const candidatos = candidatosDaLinha(i).slice(0, 5);
    const ativo = candidatoAtivo(i);
    const atual = e.correspondencia[i];
    const status = statusDaLinha(i);
    const alvoAtual = atual && atual !== "novo" ? cot.itens.find((x) => x.id === atual) : null;

    return html`
      <div class="comparador">
        <div class="comparador__cab">
          <div>
            <p class="comparador__sobre">Comparação inteligente</p>
            <h3>Comparar itens semelhantes</h3>
            <p>Revise somente os casos necessários. O número da linha permanece fixo entre o orçamento importado e o item da cotação.</p>
          </div>
          <div class="comparador__resumo" aria-label="Resumo das correspondências">
            <span><strong>${total}</strong><small>itens</small></span>
            <span data-tom="ok"><strong>${automaticos}</strong><small>confirmados</small></span>
            <span data-tom="aviso"><strong>${pendentes}</strong><small>pendentes</small></span>
            <span data-tom="perigo"><strong>${semEq}</strong><small>sem equivalente</small></span>
          </div>
        </div>

        <div class="comparador__grade">
          <aside class="comparador__lista" aria-label="Itens do orçamento importado">
            <div class="comparador__lista-cab"><strong>Itens importados</strong><small>${d.fornecedor.nomeFantasia || d.fornecedor.razaoSocial || "Fornecedor"}</small></div>
            <div class="comparador__linhas">
              ${d.itens.map((linha, idx) => {
                const st = statusDaLinha(idx);
                return html`<button type="button" class="comparador__linha" data-selecionar-linha="${idx}" aria-current="${idx === i ? "true" : "false"}">
                  <span class="comparador__numero">${linha.numero ?? idx + 1}</span>
                  <span class="comparador__linha-texto"><strong>${linha.descricao || "Item sem descrição"}</strong><small>${linha.codigo || "Sem código"} · ${numeroBr(linha.quantidade ?? 0)} ${linha.unidade ?? ""}</small></span>
                  <span class="comparador__status" data-tom="${st.tom}">${st.rotulo}</span>
                </button>`;
              })}
            </div>
          </aside>

          <section class="comparador__foco">
            <div class="comparador__foco-cab">
              <div><span class="comparador__numero comparador__numero--grande">${it.numero ?? i + 1}</span><strong>Linha ${it.numero ?? i + 1} — item selecionado</strong></div>
              <span class="comparador__status" data-tom="${status.tom}">${status.rotulo}</span>
            </div>
            <div class="comparador__dupla">
              <article class="comparador__origem">
                <small>ITEM DO ORÇAMENTO IMPORTADO</small>
                <strong>${it.descricao}</strong>
                <dl>
                  <div><dt>Código</dt><dd>${it.codigo || "—"}</dd></div>
                  <div><dt>Quantidade</dt><dd>${numeroBr(it.quantidade ?? 0)} ${it.unidade ?? ""}</dd></div>
                  <div><dt>Preço unitário</dt><dd>${it.unitarioCentavos != null ? reais(it.unitarioCentavos) : "—"}</dd></div>
                </dl>
              </article>

              <div class="comparador__candidatos">
                <div class="comparador__subcab"><strong>Possíveis equivalentes</strong><small>${cot.itens.length ? "Itens já existentes na cotação" : "Esta é a primeira proposta"}</small></div>
                ${candidatos.length ? candidatos.slice(0, 3).map((c, pos) => html`
                  <button type="button" class="comparador__candidato" data-candidato="${c.id}" data-linha="${i}" aria-pressed="${ativo?.id === c.id ? "true" : "false"}" ${c.ocupadoPor >= 0 ? "disabled" : ""}>
                    <span class="comparador__letra">${String.fromCharCode(65 + pos)}</span>
                    <span class="comparador__candidato-texto"><strong>${c.descricao}</strong><small>${c.unidade || "unidade não informada"}${c.ocupadoPor >= 0 ? ` · já ligado à linha ${d.itens[c.ocupadoPor]?.numero ?? c.ocupadoPor + 1}` : ""}</small></span>
                    <span class="comparador__score" data-tom="${tomScore(c)}"><strong>${c.percentual}%</strong><small>${c.classificacao === "forte" ? "forte" : c.classificacao === "revisao" ? "revisar" : "baixa"}</small></span>
                  </button>`) : html`<p class="faixa" data-tom="info">Nenhum item tecnicamente compatível foi encontrado. Você pode adicionar este material como item novo.</p>`}
                ${candidatos.length > 3 ? html`<small class="comparador__mais">+${candidatos.length - 3} candidatos abaixo do limite principal. Use a edição avançada para ver todos.</small>` : ""}
              </div>

              <aside class="comparador__tecnica">
                <div class="comparador__subcab"><strong>Variação técnica</strong><small>${ativo ? `candidato com ${ativo.percentual}% de similaridade` : "sem candidato"}</small></div>
                ${ativo ? html`
                  <ul class="comparador__checks">
                    ${ativo.motivos.map((m) => html`<li data-tom="ok">${icone("ok", 15)}<span>${m}</span></li>`)}
                    ${ativo.diferencas.map((m) => html`<li data-tom="aviso">${icone("alerta", 15)}<span>${m}</span></li>`)}
                  </ul>
                  <p class="faixa" data-tom="${ativo.recomendacao === "pode_ligar" ? "ok" : ativo.recomendacao === "validacao_manual" ? "aviso" : "perigo"}">
                    ${icone(ativo.recomendacao === "pode_ligar" ? "ok" : "alerta", 16)}
                    <span><strong>${ativo.recomendacao === "pode_ligar" ? "Correspondência forte." : ativo.recomendacao === "validacao_manual" ? "Exige validação manual." : "Não recomendado ligar automaticamente."}</strong>
                    ${ativo.recomendacao === "validacao_manual" ? " Confira se as diferenças atendem à mesma aplicação antes de validar." : ""}</span>
                  </p>`
                : html`<p class="faixa" data-tom="info">Sem candidato selecionado.</p>`}
              </aside>
            </div>
          </section>

          <aside class="comparador__decisao">
            <strong>Decisão da linha selecionada</strong>
            <small>Você está revisando a linha ${it.numero ?? i + 1} de ${total}. A escolha feita aqui é a que ficará alinhada no mapa comparativo.</small>
            <button type="button" class="botao botao--destaque" data-validar-candidato ${!ativo || ativo.ocupadoPor >= 0 ? "disabled" : ""}>${icone("ok", 16)}Validar equivalente</button>
            <button type="button" class="botao" data-marcar-novo>${icone("mais", 16)}Marcar como item novo</button>
            <button type="button" class="botao" data-sem-ligacao>Não ligar ao mapa</button>
            <button type="button" class="botao" data-proxima-pendencia>Ir para próxima pendência</button>
            ${alvoAtual ? html`<p class="comparador__escolha"><small>Ligação atual</small><strong>${alvoAtual.descricao}</strong></p>` : ""}
          </aside>
        </div>

        <div class="comparador__tabela-wrap">
          <div class="comparador__subcab"><strong>Comparação linha a linha</strong><small>A linha do orçamento e o candidato permanecem lado a lado.</small></div>
          <div class="tabela-quadro tabela-quadro--solto">
            <table class="tabela comparador__tabela">
              <thead><tr><th>#</th><th>Item importado</th><th>Candidato sugerido / validado</th><th>Similaridade</th><th>Variação técnica</th><th>Ação</th></tr></thead>
              <tbody>
                ${d.itens.map((linha, idx) => {
                  const st = statusDaLinha(idx);
                  const atualId = e.correspondencia[idx];
                  const atualItem = atualId && atualId !== "novo" ? cot.itens.find((x) => x.id === atualId) : null;
                  const cand = atualItem ? { id: atualItem.id, descricao: atualItem.descricao, ...analisarCorrespondencia(linha, atualItem) } : candidatoAtivo(idx);
                  return html`<tr data-selecionada="${idx === i}">
                    <td><span class="comparador__numero">${linha.numero ?? idx + 1}</span></td>
                    <td><strong>${linha.descricao}</strong><small>${linha.codigo || "Sem código"}</small></td>
                    <td>${atualId === "novo" ? html`<strong>Adicionar como item novo</strong>` : cand ? html`<strong>${cand.descricao}</strong>` : html`<span class="comparador__muted">Sem candidato</span>`}</td>
                    <td>${cand ? html`<span class="comparador__score comparador__score--inline" data-tom="${tomScore(cand)}"><strong>${cand.percentual}%</strong></span>` : "—"}</td>
                    <td>${atualId === "novo" ? "Novo item" : resumoVariacao(cand)}</td>
                    <td><button type="button" class="botao botao--peq" data-revisar-linha="${idx}">${st.id === "pendente" || st.id === "sem_equivalente" ? "Revisar" : "Ver linha"}</button></td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
          <div class="comparador__legenda"><span data-tom="ok">● Automático/confirmado</span><span data-tom="aviso">● Revisão manual</span><span data-tom="perigo">● Incompatível/sem equivalente</span></div>
        </div>
      </div>`;
  };

  const campo = ({ rotulo, caminho, tipo = "texto", mono = false, largo = false }) => {
    const v = pegar(e.dados, caminho);
    const valor = tipo === "dinheiro" ? reaisCampo(v) : tipo === "cnpj" ? cnpjMascara(v) || (v ?? "") : (v ?? "");
    return html`<label class="campo-rotulado ${largo ? "campo-rotulado--largo" : ""}" data-faltando="${String(faltando().has(caminho))}" data-caminho-rotulo="${caminho}">${rotulo}
      <input class="campo ${mono || tipo === "dinheiro" ? "campo--mono" : ""} ${tipo === "dinheiro" ? "campo--num" : ""}" data-caminho="${caminho}" data-tipo="${tipo}" type="${tipo === "data" ? "date" : "text"}" value="${valor}" ${tipo === "dinheiro" ? 'inputmode="decimal"' : ""}>
      <span class="campo-rotulado__faltou">Não encontrado no arquivo: preencha ou deixe em branco.</span></label>`;
  };

  const linhaItem = (it, i) => html`
    <tr data-i="${i}">
      <td class="tabela__num" data-rotulo="#">${it.numero ?? i + 1}</td>
      <td data-rotulo="Código"><input class="campo campo--mono" data-item="codigo" value="${it.codigo ?? ""}" aria-label="Código do item ${i + 1}"></td>
      <td data-rotulo="Descrição"><input class="campo" data-item="descricao" value="${it.descricao ?? ""}" aria-label="Descrição do item ${i + 1}"></td>
      <td data-rotulo="Un."><input class="campo campo--un" data-item="unidade" value="${it.unidade ?? ""}" aria-label="Unidade do item ${i + 1}"></td>
      <td data-rotulo="Qtd."><input class="campo campo--num" data-item="quantidade" inputmode="decimal" value="${it.quantidade != null ? numeroBr(it.quantidade) : ""}" aria-label="Quantidade do item ${i + 1}"></td>
      <td data-rotulo="Unitário (R$)"><input class="campo campo--num" data-item="unitarioCentavos" inputmode="decimal" value="${reaisCampo(it.unitarioCentavos)}" aria-label="Valor unitário do item ${i + 1}"></td>
      <td data-rotulo="Total (R$)"><input class="campo campo--num" data-item="totalCentavos" inputmode="decimal" value="${reaisCampo(it.totalCentavos)}" aria-label="Valor total do item ${i + 1}"></td>
      <td data-rotulo="Item da cotação"><select class="campo" data-liga aria-label="Item da cotação para o item ${i + 1}">
        <option value="" ${!e.correspondencia[i] ? "selected" : ""}>Não ligar ao mapa</option>
        <option value="novo" ${e.correspondencia[i] === "novo" ? "selected" : ""}>Adicionar como item novo</option>
        ${cot.itens.map((c) => html`<option value="${c.id}" ${e.correspondencia[i] === c.id ? "selected" : ""} ${e.correspondencia.some((x, j) => j !== i && x === c.id) ? "disabled" : ""}>${c.descricao}</option>`)}</select></td>
      <td class="tabela__acao"><button class="botao-icone" data-tirar aria-label="Excluir item ${i + 1}">${icone("lixeira", 16)}</button></td>
    </tr>`;

  const painelAlertas = () => {
    const lista = alertasAtuais();
    const graves = lista.filter((a) => a.nivel !== "info");
    return html`
      <h3 class="alertas__titulo">${graves.length ? `${graves.length} ${graves.length === 1 ? "alerta para conferir" : "alertas para conferir"}` : "Os números fecham"}</h3>
      ${lista.length ? html`<ul class="alertas">${lista.map((a) => html`<li class="faixa" data-tom="${a.nivel === "erro" ? "perigo" : a.nivel === "aviso" ? "aviso" : "info"}">${icone(a.nivel === "info" ? "info" : "alerta", 16)}<span>${a.mensagem}</span></li>`)}</ul>`
        : html`<p class="faixa" data-tom="ok">${icone("ok", 16)}<span>Quantidade × unitário = total em cada item, a soma bate com o subtotal e o total confere. Nada foi corrigido: confira com o PDF.</span></p>`}`;
  };

  function desenharConferir() {
    const d = e.dados;
    montar(raiz, html`
      <a class="voltar" href="${voltarPara}">${icone("voltar", 16)}Propostas de ${cot.numero}</a>
      <header class="pagina__cab"><div><p class="pagina__sobre">${cot.numero} · ${cot.titulo}${emLote() ? ` · orçamento ${e.posicao + 1} de ${e.lote.length}` : ""}</p><h1 class="pagina__titulo">Conferir orçamento</h1></div>
        <p class="conferir__arquivo">${icone("arquivo", 16)}${e.arquivo.name}</p></header>
      <button type="button" class="faixa faixa--botao" data-resumo-alertas></button>
      <div class="conferencia"><div class="conferencia__grade">
        <aside class="conferencia__pdf" aria-label="Arquivo do orçamento ${e.arquivo.name}"><div class="conferencia__paginas" data-paginas></div></aside>
        <div class="conferencia__dados">
          <section class="cartao"><h2 class="cartao__titulo">Fornecedor</h2>
            <div class="formulario__grade">
              ${campo({ rotulo: "Razão social", caminho: "fornecedor.razaoSocial" })}${campo({ rotulo: "Nome fantasia", caminho: "fornecedor.nomeFantasia" })}
              ${campo({ rotulo: "CNPJ", caminho: "fornecedor.cnpj", tipo: "cnpj", mono: true })}${campo({ rotulo: "Telefone", caminho: "fornecedor.telefone" })}
              ${campo({ rotulo: "WhatsApp", caminho: "fornecedor.whatsapp" })}${campo({ rotulo: "E-mail", caminho: "fornecedor.email" })}
            </div>
            <p class="cartao__nota" data-fornecedor-nota></p>
          </section>
          <section class="cartao"><h2 class="cartao__titulo">Orçamento</h2>
            <div class="formulario__grade">
              ${campo({ rotulo: "Número", caminho: "orcamento.numero", mono: true })}${campo({ rotulo: "Emissão", caminho: "orcamento.emissao", tipo: "data" })}
              ${campo({ rotulo: "Validade", caminho: "orcamento.validade", tipo: "data" })}${campo({ rotulo: "Vendedor", caminho: "orcamento.vendedor" })}
            </div>
            ${d.orcamento.validadeTexto ? html`<p class="cartao__nota">O documento informa validade de ${d.orcamento.validadeTexto} a partir da emissão. Confira a data final com o fornecedor.</p>` : ""}
          </section>
          <section class="cartao"><h2 class="cartao__titulo">Condições</h2>
            <div class="formulario__grade">
              ${campo({ rotulo: "Prazo de entrega", caminho: "condicoes.prazoEntrega" })}${campo({ rotulo: "Pagamento", caminho: "condicoes.pagamento" })}
              <label class="campo-rotulado">Frete (tipo)<select class="campo" data-caminho="condicoes.freteTipo" data-tipo="texto"><option value="">Não informado</option><option value="CIF" ${d.condicoes.freteTipo === "CIF" ? "selected" : ""}>CIF</option><option value="FOB" ${d.condicoes.freteTipo === "FOB" ? "selected" : ""}>FOB</option></select></label>
              ${campo({ rotulo: "Frete (R$)", caminho: "condicoes.freteCentavos", tipo: "dinheiro" })}${campo({ rotulo: "Desconto (R$)", caminho: "condicoes.descontoCentavos", tipo: "dinheiro" })}
              ${campo({ rotulo: "Subtotal (R$)", caminho: "condicoes.subtotalCentavos", tipo: "dinheiro" })}${campo({ rotulo: "Total (R$)", caminho: "condicoes.totalCentavos", tipo: "dinheiro" })}
            </div>
            ${d.condicoes.freteTexto ? html`<p class="cartao__nota">Condição de frete no documento: ${d.condicoes.freteTexto}. Confirme se atende o destino da cotação.</p>` : ""}
          </section>
          <section class="cartao"><h2 class="cartao__titulo">Itens <span class="contador" data-contagem>${d.itens.length}</span></h2>
            ${cot.itens.length ? html`<p class="cartao__nota">${e.automaticas} ${e.automaticas === 1 ? "item ligado" : "itens ligados"} automaticamente. A comparação abaixo mantém cada orçamento na mesma linha e mostra as diferenças técnicas antes da validação manual.</p>` : html`<p class="cartao__nota">Esta é a primeira proposta da cotação. Os itens podem ser adicionados como base para comparar os próximos fornecedores.</p>`}
            <div data-comparador>${comparadorInteligente()}</div>
            <details class="conferencia-edicao">
              <summary>Editar dados extraídos e ligações manualmente <span>opção avançada</span></summary>
              <p class="cartao__nota">Use esta tabela para corrigir código, descrição, unidade, quantidade, preços ou forçar uma ligação específica. O comparador acima é o fluxo recomendado.</p>
              <div class="tabela-quadro tabela-quadro--solto"><table class="tabela tabela--lista tabela--conferencia">
                <thead><tr><th class="tabela__num">#</th><th>Código</th><th>Descrição</th><th>Un.</th><th class="tabela__num">Qtd.</th><th class="tabela__num">Unitário</th><th class="tabela__num">Total</th><th>Item da cotação</th><th></th></tr></thead>
                <tbody data-itens>${d.itens.map(linhaItem)}</tbody></table></div>
              <div class="acoes-linha"><button class="botao" data-add-item>${icone("mais", 16)}Adicionar item</button>
                <button class="botao" data-aplicar-possiveis ${possiveis().length ? "" : "hidden"}>Aplicar ${possiveis().length} sugestões em lote</button>
                <button class="botao" data-novos ${semSimilar().length ? "" : "hidden"}>Adicionar ${semSimilar().length} itens sem similar</button></div>
            </details>
          </section>
          <section class="cartao" data-alertas aria-live="polite">${painelAlertas()}</section>
          <div class="acoes-linha"><button class="botao" data-baixar-xml>Baixar XML conferido</button></div>
        </div>
      </div></div>
      <div class="barra-acoes" role="group" aria-label="Ações da conferência">
        <button class="botao" data-ver-pdf aria-label="Ver arquivo em outra aba">${icone("arquivo", 16)}<span class="so-largo">Ver ${e.tipo === "application/xml" ? "XML" : "arquivo"}</span></button>
        <span class="espaco"></span>
        <button class="botao" data-cancelar>${emLote() ? "Pular este orçamento" : "Cancelar"}</button>
        <button class="botao botao--destaque" data-confirmar>${icone("ok", 16)}${emLote() && e.posicao + 1 < e.lote.length ? "Confirmar e ler próximo" : "Confirmar orçamento"}</button>
      </div>`);
    ligarConferir();
    atualizarFornecedorNota();
    resumirAlertas();
    raiz.querySelector("[data-resumo-alertas]").addEventListener("click", () => raiz.querySelector("[data-alertas]").scrollIntoView({ behavior: "smooth", block: "center" }));
    desenharArquivo(raiz.querySelector("[data-paginas]"));
  }

  /** Mostra as páginas do PDF ao lado dos dados. Desenhado pelo próprio pdfjs, igual em qualquer navegador (inclusive celular). */
  async function desenharArquivo(destino) {
    if (!destino || !destino.clientWidth) return;
    if (e.tipo === "application/xml") {
      const pre = document.createElement("pre");
      pre.textContent = new TextDecoder().decode(e.bytes);
      pre.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;font-size:12px";
      destino.append(pre);
      return;
    }
    if (e.tipo !== "application/pdf") {
      const imagem = document.createElement("img");
      imagem.src = e.url; imagem.alt = `Imagem do orçamento ${e.arquivo.name}`;
      imagem.style.maxWidth = "100%";
      destino.append(imagem);
      return;
    }
    return desenharPdf(destino, e.bytes, e.arquivo.name);
  }

  async function desenharPdf(destino, bytes, nome) {
    if (!destino?.clientWidth) return;
    try {
      const pdfjs = await carregarPdfjs();
      const tarefa = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, isEvalSupported: false });
      const doc = await tarefa.promise;
      const dpr = window.devicePixelRatio || 1;
      for (let n = 1; n <= Math.min(doc.numPages, 12) && ativo && destino.isConnected; n++) {
        const pagina = await doc.getPage(n);
        const escala = (destino.clientWidth - 2) / pagina.getViewport({ scale: 1 }).width;
        const vp = pagina.getViewport({ scale: escala * dpr });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        canvas.style.width = `${canvas.width / dpr}px`;
        canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Página ${n} do PDF ${nome}`);
        await pagina.render({ canvasContext: canvas.getContext("2d"), canvas, viewport: vp }).promise;
        destino.append(canvas);
      }
      await tarefa.destroy();
    } catch (erro) { console.warn("pdf", erro); if (destino.isConnected) destino.textContent = "Não foi possível mostrar o PDF aqui. Use o botão Ver arquivo."; }
  }

  function atualizarAlertas() {
    montar(raiz.querySelector("[data-alertas]"), painelAlertas());
    resumirAlertas();
    const falta = faltando();
    raiz.querySelectorAll("[data-caminho-rotulo]").forEach((el) => { el.dataset.faltando = String(falta.has(el.dataset.caminhoRotulo)); });
  }
  function resumirAlertas() {
    const botao = raiz.querySelector("[data-resumo-alertas]");
    const graves = alertasAtuais().filter((a) => a.nivel !== "info");
    botao.dataset.tom = graves.some((a) => a.nivel === "erro") ? "perigo" : graves.length ? "aviso" : "ok";
    montar(botao, html`${icone(graves.length ? "alerta" : "ok", 16)}<span>${graves.length ? `${graves.length} ${graves.length === 1 ? "alerta para conferir" : "alertas para conferir"}. Toque para ver.` : "Os números fecham. Confira os dados com o arquivo e confirme."}</span>`);
  }
  function atualizarFornecedorNota() {
    const nota = raiz.querySelector("[data-fornecedor-nota]");
    if (!nota) return;
    const cnpj = (e.dados.fornecedor.cnpj ?? "").replace(/\D/g, "");
    const existente = cnpj && store.estado.fornecedores.find((f) => f.cnpj === cnpj);
    nota.textContent = existente ? `Este CNPJ já está cadastrado como "${existente.nome}". O orçamento entra nele.` : "Fornecedor novo: será cadastrado ao confirmar.";
  }

  function ligarConferir() {
    const d = e.dados;
    raiz.querySelectorAll("[data-caminho]").forEach((el) => el.addEventListener("change", () => {
      const tipo = el.dataset.tipo, caminho = el.dataset.caminho;
      let valor = el.value.trim() === "" ? null : el.value.trim();
      if (tipo === "dinheiro") { valor = lerCentavos(el.value); el.value = reaisCampo(valor); }
      if (tipo === "cnpj") { valor = el.value.replace(/\D/g, "") || null; el.value = cnpjMascara(valor) || (valor ?? ""); }
      por(d, caminho, valor);
      if (caminho === "fornecedor.cnpj") atualizarFornecedorNota();
      e.sujo = true; atualizarAlertas();
    }));
    const corpo = raiz.querySelector("[data-itens]");
    const comparador = raiz.querySelector("[data-comparador]");
    const redesenharItens = () => { montar(corpo, html`${d.itens.map(linhaItem)}`); raiz.querySelector("[data-contagem]").textContent = d.itens.length; };
    const redesenharComparador = () => { if (comparador) montar(comparador, comparadorInteligente()); };
    const atualizarSugestoes = () => {
      const b = raiz.querySelector("[data-aplicar-possiveis]"), n = raiz.querySelector("[data-novos]");
      const qtd = possiveis().length, novos = semSimilar().length;
      b.hidden = !qtd; b.textContent = `Revisar ${qtd} possíveis correspondências`;
      n.hidden = !novos; n.textContent = `Revisar ${novos} itens sem similar`;
    };
    corpo.addEventListener("change", (ev) => {
      const tr = ev.target.closest("tr"), i = Number(tr.dataset.i), el = ev.target;
      if (el.dataset.liga !== undefined) {
        e.correspondencia[i] = el.value; e.automaticasIndices.delete(i); e.validadas.add(i); e.candidatoEscolhido[i] = el.value || "";
        e.sujo = true; redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes(); return;
      }
      const k = el.dataset.item, it = d.itens[i];
      if (k === "quantidade") { it.quantidade = num(el.value); el.value = it.quantidade != null ? numeroBr(it.quantidade) : ""; }
      else if (k === "unitarioCentavos" || k === "totalCentavos") { it[k] = lerCentavos(el.value); el.value = reaisCampo(it[k]); }
      else it[k] = el.value.trim() === "" ? null : el.value.trim();
      e.sujo = true; redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
    });
    corpo.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-tirar]");
      if (!b) return;
      const i = Number(b.closest("tr").dataset.i);
      d.itens.splice(i, 1); e.correspondencia.splice(i, 1); e.automaticasIndices = new Set(); e.validadas = new Set(); e.candidatoEscolhido = {}; e.linhaSelecionada = Math.min(e.linhaSelecionada, Math.max(0, d.itens.length - 1));
      e.sujo = true; redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
    });
    raiz.querySelector("[data-add-item]").addEventListener("click", () => {
      d.itens.push({ numero: (d.itens.at(-1)?.numero ?? 0) + 1, codigo: null, descricao: "", unidade: null, quantidade: null, unitarioCentavos: null, totalCentavos: null });
      e.correspondencia.push(cot.itens.length ? "" : "novo"); e.linhaSelecionada = d.itens.length - 1; e.sujo = true; redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
      corpo.querySelector("tr:last-child [data-item='descricao']")?.focus();
    });
    comparador?.addEventListener("click", (ev) => {
      const selecionar = ev.target.closest("[data-selecionar-linha],[data-revisar-linha]");
      if (selecionar) {
        e.linhaSelecionada = Number(selecionar.dataset.selecionarLinha ?? selecionar.dataset.revisarLinha);
        redesenharComparador();
        return;
      }
      const candidato = ev.target.closest("[data-candidato]");
      if (candidato) {
        const i = Number(candidato.dataset.linha);
        e.linhaSelecionada = i;
        e.candidatoEscolhido[i] = candidato.dataset.candidato;
        redesenharComparador();
        return;
      }
      const i = e.linhaSelecionada;
      const ativoCandidato = candidatoAtivo(i);
      if (ev.target.closest("[data-validar-candidato]")) {
        if (!ativoCandidato) { avisar("Não há candidato disponível para esta linha."); return; }
        const ocupado = e.correspondencia.findIndex((id, j) => j !== i && id === ativoCandidato.id);
        if (ocupado >= 0) { avisar(`Este item da cotação já está ligado à linha ${e.dados.itens[ocupado]?.numero ?? ocupado + 1}.`); return; }
        e.correspondencia[i] = ativoCandidato.id;
        e.candidatoEscolhido[i] = ativoCandidato.id;
        e.automaticasIndices.delete(i);
        e.validadas.add(i);
        e.sujo = true;
        redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
        return;
      }
      if (ev.target.closest("[data-marcar-novo]")) {
        e.correspondencia[i] = "novo"; e.automaticasIndices.delete(i); e.validadas.add(i); e.sujo = true;
        redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes(); return;
      }
      if (ev.target.closest("[data-sem-ligacao]")) {
        e.correspondencia[i] = ""; e.automaticasIndices.delete(i); e.validadas.add(i); e.sujo = true;
        redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes(); return;
      }
      if (ev.target.closest("[data-proxima-pendencia]")) {
        const total = e.dados.itens.length;
        for (let passo = 1; passo <= total; passo++) {
          const idx = (i + passo) % total;
          const st = statusDaLinha(idx);
          if (st.id === "pendente" || st.id === "sem_equivalente") { e.linhaSelecionada = idx; redesenharComparador(); return; }
        }
        avisar("Não há outras pendências de correspondência.");
      }
    });

    raiz.querySelector("[data-aplicar-possiveis]").addEventListener("click", async () => {
      const lista = possiveis();
      if (!lista.length) return;
      const ok = await confirmar({ titulo: "Conferir possíveis correspondências", rotulo: `Ligar ${lista.length} itens`,
        texto: html`Essas descrições têm medidas iguais, mas podem indicar peças diferentes. Confira os pares antes de ligar:<ul class="alertas-lista">${lista.map((p) => html`<li><strong>${d.itens[p.i].descricao}</strong> → ${p.descricao}</li>`)}</ul>` });
      if (!ok || !ativo) return;
      const usados = new Set(e.correspondencia.filter((id) => id && id !== "novo"));
      for (const p of lista) if (!e.correspondencia[p.i] && !usados.has(p.id)) { e.correspondencia[p.i] = p.id; usados.add(p.id); }
      e.sujo = true; redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
    });
    raiz.querySelector("[data-novos]").addEventListener("click", async () => {
      const lista = semSimilar();
      if (!lista.length) return;
      const ok = await confirmar({ titulo: "Adicionar itens à cotação", rotulo: `Adicionar ${lista.length} itens`,
        texto: html`Não encontrei um produto com a mesma descrição e medidas. Confira os itens que serão criados na cotação:<ul class="alertas-lista">${lista.map(({ it }) => html`<li>${it.descricao}</li>`)}</ul>` });
      if (!ok || !ativo) return;
      for (const { i } of lista) if (!e.correspondencia[i]) e.correspondencia[i] = "novo";
      e.sujo = true; redesenharItens(); redesenharComparador(); atualizarAlertas(); atualizarSugestoes();
    });
    raiz.querySelector("[data-ver-pdf]").addEventListener("click", () => window.open(e.url, "_blank", "noopener"));
    raiz.querySelector("[data-baixar-xml]").addEventListener("click", () => {
      try {
        const nome = `orcamento-${String(cot.numero).replace(/[^a-z\d-]/gi, "_")}.xml`;
        baixarTexto(nome, gerarOrcamentoXml(d), "application/xml;charset=utf-8");
      } catch (erro) { avisar(erro.message); }
    });
    raiz.querySelector("[data-cancelar]").addEventListener("click", cancelar);
    raiz.querySelector("[data-confirmar]").addEventListener("click", confirmarOrcamento);
  }

  async function cancelar() {
    if (e.sujo && !(await confirmar({ titulo: "Descartar esta conferência?", texto: "Você alterou dados. Nada foi salvo e as mudanças serão perdidas.", rotulo: "Descartar", perigo: true }))) return;
    if (emLote()) proximo(); else ir(voltarPara);
  }

  async function confirmarOrcamento() {
    const d = e.dados;
    if (!(d.fornecedor.nomeFantasia || d.fornecedor.razaoSocial)) { avisar("Informe a razão social ou o nome fantasia do fornecedor."); raiz.querySelector('[data-caminho="fornecedor.razaoSocial"]')?.focus(); return; }
    if (!d.itens.length) { avisar("Adicione pelo menos um item."); return; }
    if (d.itens.some((it) => !it.descricao?.trim())) { avisar("Há item sem descrição. Preencha ou exclua a linha."); return; }
    if (!e.correspondencia.some(Boolean)) { avisar("Ligue pelo menos um item a um item da cotação, ou marque como item novo."); return; }
    const graves = alertasAtuais().filter((a) => a.nivel === "erro");
    if (graves.length) {
      const ok = await confirmar({ titulo: "Confirmar com alertas?", rotulo: "Confirmar mesmo assim",
        texto: html`Estes pontos não fecham e não foram corrigidos:<ul class="alertas-lista">${graves.map((a) => html`<li>${a.mensagem}</li>`)}</ul>` });
      if (!ok) return;
    } else if (d.diagnostico?.metodo === "ocr") {
      const ok = await confirmar({ titulo: "Conferiu a leitura do OCR?", rotulo: "Conferi e confirmar",
        texto: "Confira no arquivo original os códigos, descrições, quantidades, preços, frete e total. O reconhecimento pode trocar letras e números mesmo quando as contas fecham." });
      if (!ok) return;
    }
    const plano = montarImportacao({ cotacao: cot, dados: d, correspondencia: e.correspondencia, fornecedores: store.estado.fornecedores,
      arquivo: { nome: e.arquivo.name, tamanho: e.arquivo.size, tipo: e.tipo },
      hash: e.hash, agora: new Date().toISOString(), novoId });
    const botao = raiz.querySelector("[data-confirmar]");
    botao.disabled = true;
    try {
      await store.confirmarImportacao({ cotacaoId: cot.id, plano, silencioso: emLote() });
    } catch (erro) {
      botao.disabled = false;
      console.error("Falha ao salvar orçamento:", erro);
      const detalhe = erro?.code ? `${erro.code}: ` : "";
      avisar(erro.message === "Este orçamento já foi importado." ? erro.message : `Não foi possível salvar o orçamento. ${detalhe}${erro?.message || "Confira a conexão e as permissões do Firestore."}`);
      return;
    }
    cot = store.cotacao(rota.numero);
    selecionarProposta(cot.id, plano.proposta.id);
    e.confirmados++;
    avisar(`Orçamento confirmado: proposta de ${plano.fornecedor.nome}${plano.fornecedorNovo ? " (fornecedor novo cadastrado)" : ""}.`);
    if (emLote()) proximo(); else ir(voltarPara);
  }

  function desenhar() {
    if (e.fase === "lendo") desenharLendo();
    else if (e.fase === "conferir") desenharConferir();
    else desenharEscolher();
  }
  desenhar();
  return () => { ativo = false; e.abort?.abort(); limparUrl(); };
}
