// Simula o sábado 28/11/2026, dia seguinte à publicação da 2.0, das 8h às 12h.
// Às 10h o gateway de pagamento começa a falhar. Gera o dossiê do incidente:
//   incidente/sabado.log   o log de acesso e de erros
//   incidente/painel.txt   o painel de métricas por hora e por rota
// Uso: npm run sabado (não mexe no data/quadra-livre.sqlite: usa um banco em memória)
import { mkdirSync, writeFileSync } from "node:fs";

process.env.DB_FILE = ":memory:";
const { app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { semear } = await import("../src/seed.js");
const { daqui } = await import("../src/datas.js");
const { gateway } = await import("../src/pagamento.js");

semear(db);
const servidor = app.listen(0);
const base = `http://localhost:${servidor.address().port}`;

// O que o servidor escreve no console.error (o log de erros), guardado pelo código ERR-….
const detalhes = new Map();
console.error = (cabecalho, erro) => {
  const codigo = String(cabecalho).match(/ERR-\w+/)?.[0];
  detalhes.set(codigo, `${erro?.name ?? "Error"}: ${erro?.message ?? erro}`);
};

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const inicio = performance.now();
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: corpo && JSON.stringify(corpo),
  });
  const json = await resposta.json().catch(() => ({}));
  return { status: resposta.status, ms: Math.round(performance.now() - inicio), json };
}

const tokens = [];
for (const email of ["ana@exemplo.com", "bruno@exemplo.com"])
  tokens.push((await chamar("POST", "/api/login", { corpo: { email, senha: "senha123" } })).json.token);

const sorteio = (n) => Math.floor(Math.random() * n);
const pad = (n) => String(n).padStart(2, "0");
const registros = [];

// Uma hora de movimento: 60 requisições ao mesmo tempo, espalhadas no relógio da hora.
async function hora(h) {
  const pedidos = [];
  for (let i = 0; i < 60; i++) {
    const tipo = i % 5; // 2/5 listam quadras, 1/5 vê horários, 2/5 reservam
    const token = tokens[sorteio(2)];
    const quadra = 1 + sorteio(3);
    const data = daqui(1 + sorteio(14));
    pedidos.push(
      tipo < 2
        ? ["GET", "/api/quadras", {}]
        : tipo === 2
          ? ["GET", `/api/quadras/${quadra}/horarios?data=${data}`, {}]
          : ["POST", "/api/reservas", { token, corpo: { quadra_id: quadra, data, hora: 8 + sorteio(15), cartao: "4111 1111 1111 1111" } }],
    );
  }
  const respostas = await Promise.all(pedidos.map(([m, c, o]) => chamar(m, c, o)));
  respostas.forEach((r, i) => {
    const [metodo, caminho] = pedidos[i];
    const segundo = Math.floor((i / 60) * 3600) + sorteio(50);
    registros.push({
      quando: `2026-11-28T${pad(h)}:${pad(Math.floor(segundo / 60))}:${pad(segundo % 60)}`,
      hora: h,
      metodo,
      rota: caminho.replace(/\/\d+\/horarios\?.*/, "/:id/horarios"),
      status: r.status,
      ms: r.ms,
      codigo: r.json.erro?.match(/ERR-\w+/)?.[0],
    });
  });
}

const reservasAntes = db.prepare("SELECT COUNT(*) AS n FROM reservas").get().n;

gateway.taxaDeFalha = 0.01; // 8h e 9h: gateway saudável
gateway.latenciaMs = 350;
await hora(8);
await hora(9);
gateway.taxaDeFalha = 0.35; // a partir das 10h: o gateway segura 5 s e desiste
gateway.esperaNaFalhaMs = 5000;
await hora(10);
await hora(11);
servidor.close();

// ---------- o log ----------
registros.sort((a, b) => a.quando.localeCompare(b.quando));
const log = registros.flatMap((r) => {
  const linha = `${r.quando} ${r.metodo.padEnd(4)} ${r.rota.padEnd(24)} ${r.status} ${String(r.ms).padStart(5)}ms`;
  return r.codigo ? [`${linha} ${r.codigo}`, `${r.quando} ERROR ${r.codigo} ${detalhes.get(r.codigo)}`] : [linha];
});

// ---------- o painel ----------
const p95 = (lista) => {
  const ordenada = lista.map((r) => r.ms).sort((a, b) => a - b);
  return ordenada[Math.ceil(0.95 * ordenada.length) - 1] ?? 0;
};
const linhaPainel = (rotulo, lista) => {
  const erros = lista.filter((r) => r.status >= 500).length;
  return `${rotulo.padEnd(28)} ${String(lista.length).padStart(5)} ${(((erros / lista.length) * 100).toFixed(0) + "%").padStart(7)} ${(p95(lista) + "ms").padStart(8)}`;
};
const cabecalho = `${"".padEnd(28)} ${"req".padStart(5)} ${"erro 5xx".padStart(7)} ${"p95".padStart(8)}`;
const painel = ["Quadra Livre 2.0.0-rc.1 · sábado 28/11/2026", "", "Por hora", cabecalho];
for (const h of [8, 9, 10, 11])
  painel.push(linhaPainel(`${pad(h)}h-${pad(h + 1)}h`, registros.filter((r) => r.hora === h)));
painel.push("", "Por rota (8h-12h)", cabecalho);
for (const rota of [...new Set(registros.map((r) => `${r.metodo} ${r.rota}`))].sort())
  painel.push(linhaPainel(rota, registros.filter((r) => `${r.metodo} ${r.rota}` === rota)));

const criadas = registros.filter((r) => r.rota === "/api/reservas" && r.status === 201).length;
const gravadas = db.prepare("SELECT COUNT(*) AS n FROM reservas").get().n - reservasAntes;
painel.push(
  "",
  "Reservas pelo site",
  `  confirmadas ao jogador (201):            ${criadas}`,
  `  gravadas no banco como CONFIRMADA:       ${gravadas}`,
  `  diferença (reserva sem cobrança?):       ${gravadas - criadas}`,
);

mkdirSync("incidente", { recursive: true });
writeFileSync("incidente/sabado.log", log.join("\n") + "\n");
writeFileSync("incidente/painel.txt", painel.join("\n") + "\n");
console.log(painel.join("\n"));
console.log(`\nlog completo: incidente/sabado.log (${log.length} linhas)`);
