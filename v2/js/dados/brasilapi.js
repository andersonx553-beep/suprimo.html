import { cnpjValido } from "../dominio/cnpj.js";

/** Consulta o CNPJ na BrasilAPI e devolve os campos que o cadastro usa. */
export async function consultarCnpj(cnpj) {
  const c = String(cnpj).replace(/\D/g, "");
  if (!cnpjValido(c)) throw new Error("CNPJ inválido. Confira os dígitos.");
  const r = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + c);
  if (r.status === 404) throw new Error("CNPJ não encontrado na Receita.");
  if (!r.ok) throw new Error("A consulta falhou. Tente de novo em instantes.");
  const d = await r.json();
  return {
    nome: d.nome_fantasia || d.razao_social || "",
    razaoSocial: d.razao_social || "",
    email: (d.email || "").toLowerCase(),
    telefone: d.ddd_telefone_1 || "",
    cidade: [d.municipio, d.uf].filter(Boolean).join("/"),
    situacao: d.descricao_situacao_cadastral || "",
    ativa: /ativa/i.test(d.descricao_situacao_cadastral || ""),
  };
}
