import { DatabaseSync } from "node:sqlite";

// Nos testes, DB_FILE=":memory:": banco descartável, não mexe no data/quadra-livre.sqlite.
export const db = new DatabaseSync(process.env.DB_FILE ?? "data/quadra-livre.sqlite");

// Valores em centavos: 12000 = R$ 120,00. Datas "AAAA-MM-DD", hora inteira (8 = 8h às 9h).
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id     INTEGER PRIMARY KEY,
    nome   TEXT NOT NULL,
    email  TEXT NOT NULL UNIQUE,
    senha  TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('JOGADOR', 'ATENDENTE', 'GERENTE'))
  );

  CREATE TABLE IF NOT EXISTS quadras (
    id         INTEGER PRIMARY KEY,
    nome       TEXT NOT NULL,
    esporte    TEXT NOT NULL,
    preco_hora INTEGER NOT NULL CHECK (preco_hora > 0)
  );

  CREATE TABLE IF NOT EXISTS reservas (
    id         INTEGER PRIMARY KEY,
    quadra_id  INTEGER NOT NULL REFERENCES quadras (id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
    data       TEXT NOT NULL,
    hora       INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
    valor_pago INTEGER NOT NULL,
    reembolso  INTEGER NOT NULL DEFAULT 0,
    pagamento  TEXT NOT NULL,
    criada_em  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);
