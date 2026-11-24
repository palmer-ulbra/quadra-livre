// Datas no fuso da máquina (a quadra fica em Porto Alegre).
const pad = (n) => String(n).padStart(2, "0");

export const isoLocal = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const hoje = () => isoLocal(new Date());

export function daqui(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
}

export const inicioDa = ({ data, hora }) => new Date(`${data}T${pad(hora)}:00`);
