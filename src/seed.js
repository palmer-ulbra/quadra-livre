import { daqui } from "./datas.js";

// O cenário da aula. Ids fixos; as datas das reservas são relativas ao dia de hoje,
// para o cenário funcionar em qualquer dia. Todos os usuários têm a senha "senha123".
export function semear(db) {
  db.exec("BEGIN");
  db.exec("DELETE FROM reservas; DELETE FROM quadras; DELETE FROM usuarios;");

  const usuario = db.prepare(
    "INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (?, ?, ?, 'senha123', ?)",
  );
  usuario.run(1, "Ana Souza", "ana@exemplo.com", "JOGADOR");
  usuario.run(2, "Bruno Lima", "bruno@exemplo.com", "JOGADOR");
  usuario.run(3, "Carla Rocha", "atendente@exemplo.com", "ATENDENTE");
  usuario.run(4, "Diego Alves", "gerente@exemplo.com", "GERENTE");

  const quadra = db.prepare(
    "INSERT INTO quadras (id, nome, esporte, preco_hora) VALUES (?, ?, ?, ?)",
  );
  quadra.run(1, "Quadra 1", "Futsal", 12000);
  quadra.run(2, "Quadra 2", "Vôlei de areia", 8000);
  quadra.run(3, "Quadra 3", "Tênis", 10000);

  const reserva = db.prepare(
    `INSERT INTO reservas (id, quadra_id, usuario_id, data, hora, status, valor_pago, reembolso, pagamento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  reserva.run(1, 1, 1, daqui(1), 8, "CONFIRMADA", 12000, 0, "CARTAO");
  reserva.run(2, 3, 1, daqui(3), 19, "CONFIRMADA", 10000, 0, "CARTAO");
  reserva.run(3, 1, 2, daqui(2), 20, "CONFIRMADA", 12000, 0, "CARTAO");
  reserva.run(4, 2, 2, daqui(5), 18, "CONFIRMADA", 8000, 0, "BALCAO");
  reserva.run(5, 2, 1, daqui(-2), 10, "CONFIRMADA", 8000, 0, "CARTAO");
  reserva.run(6, 3, 2, daqui(-3), 21, "CANCELADA", 10000, 10000, "CARTAO");

  db.exec("COMMIT");
}
