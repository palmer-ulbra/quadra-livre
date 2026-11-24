// Testes de ponto de partida: o caminho feliz. Rodar: npm test
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

process.env.DB_FILE = ":memory:"; // antes de importar o app: banco descartável
const { app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { semear } = await import("../src/seed.js");
const { daqui } = await import("../src/datas.js");
const { gateway } = await import("../src/pagamento.js");

gateway.taxaDeFalha = 0; // nos testes o gateway simulado nunca dá tempo esgotado

let servidor, base;
before(() => {
  servidor = app.listen(0);
  base = `http://localhost:${servidor.address().port}/api`;
});
after(() => servidor.close());
beforeEach(() => semear(db));

async function api(caminho, { method = "GET", corpo, token } = {}) {
  const resposta = await fetch(base + caminho, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: corpo && JSON.stringify(corpo),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

const tokenDe = async (email) =>
  (await api("/login", { method: "POST", corpo: { email, senha: "senha123" } })).corpo.token;

test("login com senha certa devolve token e perfil", async () => {
  const { status, corpo } = await api("/login", {
    method: "POST",
    corpo: { email: "ana@exemplo.com", senha: "senha123" },
  });
  assert.equal(status, 200);
  assert.equal(corpo.usuario.perfil, "JOGADOR");
});

test("lista as três quadras", async () => {
  const { corpo } = await api("/quadras");
  assert.deepEqual(corpo.map((q) => q.esporte), ["Futsal", "Vôlei de areia", "Tênis"]);
});

test("jogador reserva um horário livre e ele passa a aparecer ocupado", async () => {
  const token = await tokenDe("ana@exemplo.com");
  const data = daqui(10);
  const { status, corpo } = await api("/reservas", {
    method: "POST",
    token,
    corpo: { quadra_id: 2, data, hora: 15, cartao: "4111 1111 1111 1111" },
  });
  assert.equal(status, 201);
  assert.equal(corpo.valor_pago, 8000);

  const { corpo: horarios } = await api(`/quadras/2/horarios?data=${data}`);
  assert.equal(horarios.find((h) => h.hora === 15).livre, false);
});

test("cancelar com vários dias de antecedência devolve 100%", async () => {
  const token = await tokenDe("ana@exemplo.com");
  const { corpo } = await api("/reservas/2/cancelamento", { method: "POST", token });
  assert.equal(corpo.percentual, 100);
  assert.equal(corpo.reembolso, 10000);
});
