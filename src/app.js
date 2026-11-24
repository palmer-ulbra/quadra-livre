import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { hoje, inicioDa } from "./datas.js";
import { db } from "./db.js";
import { cobrar } from "./pagamento.js";

export const app = express();
app.use(express.json());
app.use(express.static("public"));

// ---------- Sessão ----------

// ponytail: sessões em memória; reiniciar o servidor desloga todo mundo.
const sessoes = new Map(); // token → { id, nome, perfil }

function exigeLogin(req, res, next) {
  req.usuario = sessoes.get(req.get("authorization")?.replace(/^Bearer /, ""));
  if (!req.usuario) return res.status(401).json({ erro: "Faça login para continuar." });
  next();
}

const exigePerfil = (...perfis) => (req, res, next) =>
  perfis.includes(req.usuario.perfil)
    ? next()
    : res.status(403).json({ erro: "Você não tem permissão para isso." });

const ehEquipe = (usuario) => usuario.perfil !== "JOGADOR";

// ---------- Regras de reserva ----------

function erroDeHorario(data, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) return "Data inválida.";
  if (!Number.isInteger(hora) || hora < 8 || hora > 22)
    return "Os horários vão das 8h às 22h.";
  if (data < hoje()) return "Não dá para reservar no passado.";
}

// Valida e grava a reserva. Usado pelo site (jogador) e pelo balcão (equipe).
function criarReserva({ usuario_id, quadra_id, data, hora, pagamento }) {
  const erro = erroDeHorario(data, hora);
  if (erro) return { status: 400, erro };

  const quadra = db.prepare("SELECT * FROM quadras WHERE id = ?").get(quadra_id);
  if (!quadra) return { status: 404, erro: "Quadra não encontrada." };

  const ocupado = db
    .prepare(
      `SELECT 1 FROM reservas
        WHERE quadra_id = ? AND data = ? AND hora = ? AND usuario_id = ? AND status = 'CONFIRMADA'`,
    )
    .get(quadra_id, data, hora, usuario_id);
  if (ocupado) return { status: 409, erro: "Este horário já está reservado." };

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO reservas (quadra_id, usuario_id, data, hora, valor_pago, pagamento)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(quadra_id, usuario_id, data, hora, quadra.preco_hora, pagamento);
  return { status: 201, reserva: buscarReserva(Number(lastInsertRowid)) };
}

const buscarReserva = (id) =>
  db
    .prepare(
      `SELECT r.*, q.nome AS quadra, q.esporte, u.nome AS jogador
         FROM reservas r
         JOIN quadras q ON q.id = r.quadra_id
         JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.id = ?`,
    )
    .get(id);

// ---------- Rotas públicas ----------

app.post("/api/login", (req, res) => {
  const { email, senha } = req.body ?? {};
  const usuario = db
    .prepare("SELECT id, nome, perfil FROM usuarios WHERE email = ? AND senha = ?")
    .get(String(email), String(senha));
  if (!usuario) return res.status(401).json({ erro: "E-mail ou senha incorretos." });

  const token = randomUUID();
  sessoes.set(token, { ...usuario });
  res.json({ token, usuario });
});

app.get("/api/quadras", (req, res) => {
  res.json(db.prepare("SELECT * FROM quadras ORDER BY id").all());
});

app.get("/api/quadras/:id/horarios", (req, res) => {
  const ocupados = db
    .prepare(
      "SELECT hora FROM reservas WHERE quadra_id = ? AND data = ? AND status = 'CONFIRMADA'",
    )
    .all(req.params.id, String(req.query.data))
    .map((r) => r.hora);
  const horarios = [];
  for (let hora = 8; hora <= 22; hora++)
    horarios.push({ hora, livre: !ocupados.includes(hora) });
  res.json(horarios);
});

// ---------- Daqui para baixo, só com login ----------

app.use("/api", exigeLogin);

app.get("/api/reservas", (req, res) => {
  const reservas = db
    .prepare(
      `SELECT r.*, q.nome AS quadra, q.esporte FROM reservas r JOIN quadras q ON q.id = r.quadra_id
        WHERE r.usuario_id = ? ORDER BY r.data, r.hora`,
    )
    .all(req.usuario.id);
  res.json(reservas);
});

app.get("/api/reservas/:id", (req, res) => {
  const reserva = buscarReserva(Number(req.params.id));
  if (!reserva) return res.status(404).json({ erro: "Reserva não encontrada." });
  if (reserva.usuario_id !== req.usuario.id && !ehEquipe(req.usuario))
    return res.status(403).json({ erro: "Esta reserva não é sua." });
  res.json(reserva);
});

// Feature flag: PAGAMENTO_ONLINE=off desliga a reserva com cartão pelo site sem novo deploy.
// O balcão continua funcionando. ponytail: lida uma vez, na subida (mudar = reiniciar com a
// variável); num sistema real a flag vem de um serviço de flags e muda sem reiniciar.
export const flags = { pagamentoOnline: process.env.PAGAMENTO_ONLINE !== "off" };

app.post("/api/reservas", exigePerfil("JOGADOR"), async (req, res) => {
  if (!flags.pagamentoOnline)
    return res.status(503).json({
      erro: "Pagamento online temporariamente indisponível. Reserve pelo balcão: (51) 3333-0000.",
    });
  const { quadra_id, data, hora, cartao } = req.body ?? {};
  const resultado = criarReserva({
    usuario_id: req.usuario.id,
    quadra_id,
    data,
    hora,
    pagamento: "CARTAO",
  });
  if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });

  const { reserva } = resultado;
  const cobranca = await cobrar(cartao, reserva.valor_pago);
  if (!cobranca.aprovado) {
    db.prepare("DELETE FROM reservas WHERE id = ?").run(reserva.id);
    return res.status(402).json({ erro: "Pagamento recusado. Confira o cartão." });
  }
  res.status(201).json({ ...reserva, transacao: cobranca.transacao });
});

app.post("/api/reservas/:id/cancelamento", (req, res) => {
  const reserva = buscarReserva(Number(req.params.id));
  if (!reserva) return res.status(404).json({ erro: "Reserva não encontrada." });
  if (reserva.usuario_id !== req.usuario.id && !ehEquipe(req.usuario))
    return res.status(403).json({ erro: "Esta reserva não é sua." });
  if (reserva.status === "CANCELADA")
    return res.status(409).json({ erro: "Esta reserva já foi cancelada." });
  if (inicioDa(reserva) <= new Date())
    return res.status(409).json({ erro: "A reserva já começou: não dá mais para cancelar." });

  // Política: 24 h ou mais de antecedência → 100% de volta; menos que isso → 50%.
  const percentual = reserva.data > hoje() ? 100 : 50;
  const reembolso = Math.round((reserva.valor_pago * percentual) / 100);
  db.prepare("UPDATE reservas SET status = 'CANCELADA', reembolso = ? WHERE id = ?").run(
    reembolso,
    reserva.id,
  );
  res.json({ id: reserva.id, status: "CANCELADA", percentual, reembolso });
});

// ---------- Equipe (atendente e gerente) ----------

app.get("/api/jogadores", exigePerfil("ATENDENTE", "GERENTE"), (req, res) => {
  res.json(
    db.prepare("SELECT id, nome, email FROM usuarios WHERE perfil = 'JOGADOR' ORDER BY nome").all(),
  );
});

app.get("/api/balcao/reservas", exigePerfil("ATENDENTE", "GERENTE"), (req, res) => {
  const reservas = db
    .prepare(
      `SELECT r.*, q.nome AS quadra, u.nome AS jogador
         FROM reservas r
         JOIN quadras q ON q.id = r.quadra_id
         JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.data = ? ORDER BY r.hora, q.id`,
    )
    .all(String(req.query.data ?? hoje()));
  res.json(reservas);
});

// Reserva feita no balcão: o jogador paga ali mesmo, sem gateway.
app.post("/api/balcao/reservas", exigePerfil("ATENDENTE", "GERENTE"), (req, res) => {
  const { usuario_id, quadra_id, data, hora } = req.body ?? {};
  const jogador = db
    .prepare("SELECT 1 FROM usuarios WHERE id = ? AND perfil = 'JOGADOR'")
    .get(usuario_id);
  if (!jogador) return res.status(400).json({ erro: "Escolha um jogador." });

  const resultado = criarReserva({ usuario_id, quadra_id, data, hora, pagamento: "BALCAO" });
  if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });
  res.status(201).json(resultado.reserva);
});

app.put("/api/quadras/:id", exigePerfil("ATENDENTE", "GERENTE"), (req, res) => {
  const { preco_hora } = req.body ?? {};
  if (!Number.isInteger(preco_hora) || preco_hora <= 0)
    return res.status(400).json({ erro: "Preço inválido." });
  const { changes } = db
    .prepare("UPDATE quadras SET preco_hora = ? WHERE id = ?")
    .run(preco_hora, req.params.id);
  if (!changes) return res.status(404).json({ erro: "Quadra não encontrada." });
  res.json(db.prepare("SELECT * FROM quadras WHERE id = ?").get(req.params.id));
});

app.get("/api/relatorio", exigePerfil("GERENTE"), (req, res) => {
  const mes = String(req.query.mes);
  if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ erro: "Mês inválido." });

  // Faturamento = o que entrou menos o que foi devolvido, inclusive de reservas canceladas.
  const quadras = db
    .prepare(
      `SELECT q.nome, SUM(r.status = 'CONFIRMADA') AS reservas,
              SUM(r.valor_pago - r.reembolso) AS faturamento
         FROM reservas r JOIN quadras q ON q.id = r.quadra_id
        WHERE r.data LIKE ? GROUP BY q.id ORDER BY q.id`,
    )
    .all(`${mes}-%`);

  const maisReservada = quadras.reduce((a, b) => (b.reservas > a.reservas ? b : a));
  res.json({
    mes,
    quadras,
    total_reservas: quadras.reduce((soma, q) => soma + q.reservas, 0),
    faturamento: quadras.reduce((soma, q) => soma + q.faturamento, 0),
    mais_reservada: maisReservada.nome,
  });
});

// Erro inesperado: a tela mostra um código; o mesmo código aparece no terminal do servidor.
app.use((erro, req, res, next) => {
  const codigo = `ERR-${randomBytes(3).toString("hex").toUpperCase()}`;
  console.error(`[${new Date().toISOString()}] ${codigo} ${req.method} ${req.originalUrl}`, erro);
  res.status(500).json({ erro: `Algo deu errado (${codigo}). Tente novamente.` });
});
