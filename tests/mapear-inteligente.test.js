import test from "node:test";
import assert from "node:assert/strict";
import { analisarCorrespondencia, candidatosCorrespondencia, sugerirCorrespondencias } from "../src/importacao/mapear.js";

test("adaptadores com abreviacoes diferentes ficam como correspondencia forte", () => {
  const a = { descricao: "ADAP PVC SOLD CT 60MM X 2'", unidade: "PC" };
  const b = { descricao: "ADAPT SOLD CURT C/B. ROSCA 60x2 TIGR", unidade: "UN" };
  const r = analisarCorrespondencia(a, b);
  assert.equal(r.classificacao, "forte");
  assert.ok(r.percentual >= 82);
  assert.ok(r.motivos.some((m) => /Mesmas medidas/.test(m)));
});

test("luva mista x luva com rosca e reducao exige revisao tecnica", () => {
  const a = { descricao: "LUVA PVC SOLD MISTA 25MM X 1/2'", unidade: "PC" };
  const b = { descricao: "LUVA SOLD C/ROSC E RED 25x1/2 TIGRE", unidade: "UN" };
  const r = analisarCorrespondencia(a, b);
  assert.equal(r.classificacao, "revisao");
  assert.ok(r.percentual >= 50 && r.percentual < 82);
  assert.equal(r.recomendacao, "validacao_manual");
  assert.ok(r.diferencas.length > 0);
});

test("medidas divergentes nunca sao ligadas automaticamente", () => {
  const a = { descricao: "BUCHA PVC SOLD RED LG 60 X 40MM", unidade: "PC" };
  const b = { descricao: "BUCHA REDUCAO SOLD CURTA 60x50 TIGRE", unidade: "UN" };
  const r = analisarCorrespondencia(a, b);
  assert.equal(r.percentual, 0);
  assert.equal(r.classificacao, "incompativel");
  assert.match(r.diferencas.join(" "), /Medida diferente/);
});

test("luva de correr com a mesma medida e reconhecida apesar da ordem das palavras", () => {
  const a = { descricao: "LUVA PVC SOLD DE CORRER 50MM", unidade: "PC" };
  const b = { descricao: "LUVA CORRER P/TUBO SOLD 50 MM TIGRE", unidade: "UN" };
  const r = analisarCorrespondencia(a, b);
  assert.equal(r.classificacao, "forte");
  assert.ok(r.percentual >= 90);
});

test("candidatos sao ordenados pelo melhor encaixe tecnico", () => {
  const item = { descricao: "JOELHO PVC SOLD 90° 25MM", unidade: "PC" };
  const candidatos = candidatosCorrespondencia(item, [
    { id: "a", descricao: "LUVA SOLDAVEL DE 25 MM TIGRE", unidade: "UN" },
    { id: "b", descricao: "JOELHO 90 SOLDAVEL 25 MM TIGRE", unidade: "UN" },
    { id: "c", descricao: "JOELHO 90 SOLDAVEL 32 MM TIGRE", unidade: "UN" },
  ]);
  assert.equal(candidatos[0].id, "b");
  assert.equal(candidatos[0].classificacao, "forte");
});

test("sugestao automatica respeita unicidade e nao liga item de medida diferente", () => {
  const importados = [
    { descricao: "ADAP PVC SOLD CT 50MM X 1 1/2'", unidade: "PC" },
    { descricao: "BUCHA PVC SOLD RED LG 60 X 40MM", unidade: "PC" },
  ];
  const cotacao = [
    { id: "adapt", descricao: "ADAPT SOLD CURT C/B. ROSC 50X11/2 TI", unidade: "UN" },
    { id: "bucha", descricao: "BUCHA REDUCAO SOLD CURTA 60x50 TIGRE", unidade: "UN" },
  ];
  const r = sugerirCorrespondencias(importados, cotacao);
  assert.equal(r[0], "adapt");
  assert.equal(r[1], null);
});
