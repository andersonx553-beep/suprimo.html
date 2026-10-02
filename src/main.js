import { abrirIndexedDB, criarMemoria } from "./data/banco.js";
import { criarStore } from "./state/store.js";
import { iniciarApp } from "./ui/app.js";

async function adaptador() {
  try { return await abrirIndexedDB(); } catch { return criarMemoria(); }
}

const store = criarStore(await adaptador());
await store.iniciar();
iniciarApp(document.getElementById("app"), store);
