// Volta o banco ao cenário da aula (ids fixos). Pode rodar com o servidor ligado.
import { db } from "../src/db.js";
import { semear } from "../src/seed.js";

semear(db);
console.log("data/quadra-livre.sqlite no cenário da aula: 4 usuários, 3 quadras, 6 reservas");
