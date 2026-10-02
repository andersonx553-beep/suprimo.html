// Consulta de CNPJ na BrasilAPI (única chamada externa do sistema, além das fontes do Google Fonts).
import { cnpjValido } from "../domain/cnpj.js";

/** @returns {Promise<{nome:string, razaoSocial:string, situacaoCadastral:string, ativa:boolean, endereco:string, telefone:string, email:string}>} */
export async function consultarCnpj(cnpj) {
  const c = String(cnpj).replace(/\D/g, "");
  if (!cnpjValido(c)) throw new Error("CNPJ inválido. Confira os 14 dígitos.");
  let r;
  try { r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`); }
  catch { throw new Error("Sem conexão com a BrasilAPI. Confira a internet e tente de novo."); }
  if (r.status === 404) throw new Error("CNPJ não encontrado na Receita. Confira os dígitos.");
  if (!r.ok) throw new Error("A consulta falhou. Tente de novo em instantes.");
  const d = await r.json();
  const partes = [[d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "), d.numero, d.complemento, d.bairro, [d.municipio, d.uf].filter(Boolean).join("/"), d.cep].filter(Boolean);
  return {
    nome: d.nome_fantasia || d.razao_social || "",
    razaoSocial: d.razao_social || "",
    situacaoCadastral: d.descricao_situacao_cadastral || "",
    ativa: /ativa/i.test(d.descricao_situacao_cadastral || ""),
    endereco: partes.join(", "),
    telefone: d.ddd_telefone_1 || "",
    email: (d.email || "").toLowerCase(),
  };
}
