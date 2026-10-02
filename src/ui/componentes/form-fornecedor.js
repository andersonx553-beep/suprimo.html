// Cadastro de fornecedor num diálogo: usado na tela Fornecedores e na aba Fornecedores da cotação.
import { html } from "../../lib/html.js";
import { icone } from "../../lib/icones.js";
import { cnpjMascara, cnpjValido } from "../../domain/cnpj.js";
import { consultarCnpj } from "../../lib/brasilapi.js";
import { novoId } from "../../state/store.js";
import { abrirDialogo, confirmar } from "./dialogo.js";
import { avisar } from "./aviso.js";

/**
 * @param {import('../../state/store.js').criarStore extends Function ? any : any} store
 * @param {import('../../domain/tipos.js').Fornecedor|null} existente
 * @param {(f:import('../../domain/tipos.js').Fornecedor)=>void} [aoSalvar]
 */
export function abrirFormFornecedor(store, existente, aoSalvar) {
  const f = { id: novoId(), nome: "", razaoSocial: "", cnpj: "", situacaoCadastral: "", endereco: "", telefone: "", whatsapp: "", email: "", categorias: [], observacao: "", ...existente };
  abrirDialogo({
    titulo: existente ? f.nome : "Novo fornecedor", largo: true,
    corpo: html`
      <form id="ff" class="formulario" autocomplete="off">
        <div class="formulario__linha">
          <label class="campo-rotulado formulario__cnpj">CNPJ<input class="campo campo--mono" name="cnpj" inputmode="numeric" value="${cnpjMascara(f.cnpj) || f.cnpj}" placeholder="00.000.000/0000-00"></label>
          <button type="button" class="botao" data-consultar>${icone("lupa", 16)}Consultar CNPJ</button>
        </div>
        <p class="formulario__nota" data-situacao role="status">${f.situacaoCadastral ? `Situação na Receita: ${f.situacaoCadastral}${f.razaoSocial ? ` · ${f.razaoSocial}` : ""}` : "A consulta preenche razão social, situação e endereço."}</p>
        <label class="campo-rotulado">Nome<input class="campo" name="nome" value="${f.nome}" required></label>
        <label class="campo-rotulado">Razão social<input class="campo" name="razaoSocial" value="${f.razaoSocial}"></label>
        <label class="campo-rotulado">Endereço<input class="campo" name="endereco" value="${f.endereco}"></label>
        <div class="formulario__grade">
          <label class="campo-rotulado">Telefone<input class="campo" name="telefone" inputmode="tel" value="${f.telefone}"></label>
          <label class="campo-rotulado">WhatsApp<input class="campo" name="whatsapp" inputmode="tel" value="${f.whatsapp}"></label>
          <label class="campo-rotulado">E-mail<input class="campo" name="email" type="email" value="${f.email}"></label>
        </div>
        <label class="campo-rotulado">Categorias (separe por vírgula)<input class="campo" name="categorias" value="${f.categorias.join(", ")}" placeholder="Material elétrico, Ferramentas"></label>
        <label class="campo-rotulado">Observação<textarea class="campo" name="observacao" rows="2">${f.observacao}</textarea></label>
      </form>`,
    rodape: html`${existente ? html`<button class="botao botao--perigo" data-apagar>${icone("lixeira", 16)}Apagar</button>` : ""}<span class="espaco"></span>
      <button class="botao" data-fechar>Cancelar</button><button class="botao botao--primario" data-salvar>Salvar fornecedor</button>`,
    aoAbrir: (dlg) => {
      const form = dlg.querySelector("#ff"), nota = dlg.querySelector("[data-situacao]");
      dlg.querySelector("[data-fechar]").addEventListener("click", () => dlg.close());
      dlg.querySelector("[data-consultar]").addEventListener("click", async (e) => {
        e.currentTarget.disabled = true; nota.textContent = "Consultando a Receita…";
        try {
          const r = await consultarCnpj(form.cnpj.value);
          const preencher = (campo, valor) => { if (valor && !form[campo].value.trim()) form[campo].value = valor; };
          preencher("nome", r.nome); preencher("endereco", r.endereco); preencher("email", r.email); preencher("telefone", r.telefone);
          form.razaoSocial.value = r.razaoSocial; form.cnpj.value = cnpjMascara(form.cnpj.value);
          f.situacaoCadastral = r.situacaoCadastral;
          nota.textContent = `Situação na Receita: ${r.situacaoCadastral}${r.ativa ? "" : ". Confira antes de comprar."} · ${r.razaoSocial}`;
        } catch (erro) { nota.textContent = erro.message; }
        e.currentTarget.disabled = false;
      });
      dlg.querySelector("[data-salvar]").addEventListener("click", () => {
        if (!form.reportValidity()) return;
        const cnpj = form.cnpj.value.replace(/\D/g, "");
        if (cnpj && !cnpjValido(cnpj)) { nota.textContent = "CNPJ inválido. Confira os 14 dígitos ou deixe em branco."; form.cnpj.focus(); return; }
        const salvo = { ...f, cnpj, nome: form.nome.value.trim(), razaoSocial: form.razaoSocial.value.trim(), endereco: form.endereco.value.trim(),
          telefone: form.telefone.value.trim(), whatsapp: form.whatsapp.value.trim(), email: form.email.value.trim(),
          categorias: form.categorias.value.split(",").map((c) => c.trim()).filter(Boolean), observacao: form.observacao.value.trim() };
        store.salvarFornecedor(salvo);
        aoSalvar?.(salvo);
        dlg.close();
      });
      dlg.querySelector("[data-apagar]")?.addEventListener("click", async () => {
        const usado = store.estado.cotacoes.some((c) => c.convites.some((v) => v.fornecedorId === f.id) || c.propostas.some((p) => p.fornecedorId === f.id));
        const ok = await confirmar({ titulo: `Apagar ${f.nome}?`, perigo: true, rotulo: "Apagar fornecedor",
          texto: usado ? "Ele aparece em cotações. Elas continuam, mas mostram \"Fornecedor removido\" no lugar do nome." : "Esta ação não tem volta." });
        if (ok) { store.removerFornecedor(f.id); avisar("Fornecedor apagado."); dlg.close(); }
      });
    },
  });
}
