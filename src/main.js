import { abrirIndexedDB, criarMemoria } from "./data/banco.js";
import { criarAdaptadorFirebase } from "./data/firebase-adaptador.js";
import { criarStore } from "./state/store.js";
import { iniciarApp } from "./ui/app.js";
import { auth, db, firebase, EMAIL_AUTORIZADO } from "./lib/firebase.js";
import * as fs from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { AJUSTES_PADRAO, montarBackup } from "./data/esquema.js";
import { baixarTexto } from "./lib/arquivo.js";
import { hoje } from "./lib/formato.js";

const raiz = document.getElementById("app");
let sessaoMontada = false;
let pararSincronizacao = () => {};

function telaAcesso({ titulo, texto, acao, rotulo, secundario, email = "", erro = "" }) {
  raiz.innerHTML = `<main class="acesso"><section class="acesso__cartao"><div class="marca__logo">S</div><p class="pagina__sobre">Central de cotações</p><h1 class="pagina__titulo"></h1><p class="acesso__texto"></p><p class="acesso__erro" role="alert"></p><button class="botao botao--destaque acesso__botao"></button><button class="botao acesso__secundario" hidden></button><small class="acesso__conta"></small></section></main>`;
  raiz.querySelector("h1").textContent = titulo;
  raiz.querySelector(".acesso__texto").textContent = texto;
  raiz.querySelector(".acesso__erro").textContent = erro;
  raiz.querySelector(".acesso__conta").textContent = email;
  const botao = raiz.querySelector(".acesso__botao");
  botao.textContent = rotulo;
  botao.addEventListener("click", acao);
  const outro = raiz.querySelector(".acesso__secundario");
  if (secundario) {
    outro.hidden = false;
    outro.textContent = secundario.rotulo;
    outro.addEventListener("click", secundario.acao);
  }
}

function quantidadeDados(dados) {
  return (dados.cotacoes?.length ?? 0) + (dados.fornecedores?.length ?? 0) + (dados.documentos?.length ?? 0);
}

function exportarDadosLocais(dados) {
  const backup = montarBackup({ ...dados, ajustes: dados.ajustes ?? {} });
  baixarTexto(`suprimo-backup-local-${hoje()}.json`, JSON.stringify(backup, null, 2));
}

async function montarSessao(usuario) {
  if (sessaoMontada) return;
  sessaoMontada = true;
  telaAcesso({ titulo: "Conectando…", texto: "Buscando seus dados sincronizados no Firebase.", rotulo: "Aguarde", acao: () => {}, email: usuario.email });
  try {
    let local;
    try { local = await abrirIndexedDB(); } catch { local = criarMemoria(); }
    const [dadosLocais, nuvem] = await Promise.all([local.carregar(), (async () => {
      const adaptador = criarAdaptadorFirebase({ db, uid: usuario.uid, sdk: fs, local });
      return { adaptador, dados: await adaptador.carregar() };
    })()]);
    const adaptador = nuvem.adaptador;
    const temLocal = quantidadeDados(dadosLocais) > 0 || JSON.stringify(dadosLocais.ajustes ?? AJUSTES_PADRAO) !== JSON.stringify(AJUSTES_PADRAO);
    const temNuvem = quantidadeDados(nuvem.dados) > 0 || Boolean(nuvem.dados.ajustes);

    const abrirSuprimo = async () => {
      try {
        const store = criarStore(adaptador);
        await store.iniciar();
        pararSincronizacao = store.assinarSincronizacao();
        iniciarApp(raiz, store, { usuario, sair: () => firebase.signOut(auth) });
      } catch (erro) {
        sessaoMontada = false;
        telaAcesso({ titulo: "Não foi possível abrir o Suprimo", texto: "Confira as regras do Firestore e a conexão com a internet.", rotulo: "Tentar novamente", acao: () => montarSessao(usuario), email: usuario.email, erro: erro.message });
      }
    };

    if (temLocal && !temNuvem) {
      telaAcesso({
        titulo: "Enviar seus dados para a nuvem?",
        texto: `Encontramos neste aparelho ${dadosLocais.cotacoes.length} cotações, ${dadosLocais.fornecedores.length} fornecedores e ${dadosLocais.documentos?.length ?? 0} registros de orçamento. Ao enviar, os registros e ajustes serão copiados para o Firestore. PDFs, XMLs e imagens não são enviados e continuarão disponíveis apenas neste aparelho.`,
        rotulo: "Enviar dados e continuar",
        acao: async () => {
          const botao = raiz.querySelector(".acesso__botao"); botao.disabled = true; botao.textContent = "Enviando…";
          try { await adaptador.importarInicial({ ...dadosLocais, versaoEsquema: dadosLocais.versaoEsquema ?? 2 }); await abrirSuprimo(); }
          catch (erro) { botao.disabled = false; botao.textContent = "Tentar novamente"; raiz.querySelector(".acesso__erro").textContent = erro.message; }
        },
        secundario: { rotulo: "Abrir nuvem vazia sem migrar", acao: abrirSuprimo },
        email: usuario.email,
      });
      raiz.querySelector(".acesso__cartao").insertAdjacentHTML("beforeend", '<button class="botao acesso__exportar">Baixar backup local antes</button>');
      raiz.querySelector(".acesso__exportar").addEventListener("click", () => exportarDadosLocais(dadosLocais));
      return;
    }

    if (temLocal && temNuvem) {
      telaAcesso({
        titulo: "Dados locais encontrados",
        texto: "A nuvem já tem registros. Para evitar substituir informações, os dados que existiam neste aparelho ficarão preservados aqui e não serão mesclados automaticamente. Baixe um backup local antes de continuar se precisar guardá-los.",
        rotulo: "Continuar com os dados da nuvem",
        acao: abrirSuprimo,
        email: usuario.email,
      });
      raiz.querySelector(".acesso__cartao").insertAdjacentHTML("beforeend", '<button class="botao acesso__exportar">Baixar backup local</button>');
      raiz.querySelector(".acesso__exportar").addEventListener("click", () => exportarDadosLocais(dadosLocais));
      return;
    }

    await abrirSuprimo();
  } catch (erro) {
    sessaoMontada = false;
    telaAcesso({ titulo: "Falha ao conectar ao Firebase", texto: "Não foi possível carregar os dados. Verifique as regras do Firestore, o domínio autorizado e a conexão.", rotulo: "Tentar novamente", acao: () => montarSessao(usuario), email: usuario.email, erro: erro.message });
  }
}

firebase.onAuthStateChanged(auth, async (usuario) => {
  pararSincronizacao();
  pararSincronizacao = () => {};
  sessaoMontada = false;
  if (!usuario) {
    telaAcesso({
      titulo: "Entre para sincronizar",
      texto: "Use a conta Google autorizada para acessar as cotações neste computador, tablet e celular.",
      rotulo: "Entrar com Google",
      acao: async () => {
        const botao = raiz.querySelector(".acesso__botao"); botao.disabled = true; botao.textContent = "Abrindo Google…";
        try { await firebase.signInWithPopup(auth, new firebase.GoogleAuthProvider()); }
        catch (erro) { botao.disabled = false; botao.textContent = "Entrar com Google"; raiz.querySelector(".acesso__erro").textContent = erro.message; }
      },
      erro: "",
    });
    return;
  }
  if (usuario.email?.toLowerCase() !== EMAIL_AUTORIZADO || !usuario.emailVerified) {
    await firebase.signOut(auth);
    telaAcesso({ titulo: "Conta sem acesso", texto: `Entre com ${EMAIL_AUTORIZADO}.`, rotulo: "Tentar outra conta Google", acao: async () => {
      try { await firebase.signInWithPopup(auth, new firebase.GoogleAuthProvider()); } catch (erro) { raiz.querySelector(".acesso__erro").textContent = erro.message; }
    }, erro: "Esta conta não está autorizada no Suprimo." });
    return;
  }
  await montarSessao(usuario);
});
