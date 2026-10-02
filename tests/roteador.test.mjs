import test from "node:test";
import assert from "node:assert/strict";
import { lerRota, linkCotacao } from "../src/ui/roteador.js";

test("rotas das três áreas e da cotação", () => {
  assert.deepEqual(lerRota("#/cotacoes"), { area: "cotacoes", numero: null, aba: "itens" });
  assert.deepEqual(lerRota("#/cotacoes/COT-0001/mapa"), { area: "cotacoes", numero: "COT-0001", aba: "mapa" });
  assert.equal(lerRota("#/fornecedores").area, "fornecedores");
  assert.equal(lerRota("#/ajustes").area, "ajustes");
  assert.equal(lerRota("").area, "cotacoes");
});
test("aba desconhecida cai em itens e o link volta igual", () => {
  assert.equal(lerRota("#/cotacoes/COT-0001/xyz").aba, "itens");
  assert.equal(lerRota(linkCotacao("COT-0001", "decisao")).aba, "decisao");
});
