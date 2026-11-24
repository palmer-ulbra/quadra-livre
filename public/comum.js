// Código compartilhado pelas páginas: chamada à API, sessão, cabeçalho e rodapé.
export const VERSAO = "2.0.0-rc.1";

export const reais = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (iso) => iso.split("-").reverse().join("/");

export const hojeISO = () => new Date().toLocaleDateString("sv"); // AAAA-MM-DD no fuso local

export function usuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem("usuario"));
  } catch {
    return null;
  }
}

export async function api(caminho, { method = "GET", corpo } = {}) {
  const resposta = await fetch(`/api${caminho}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: corpo && JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => null);
  if (resposta.status === 401 && caminho !== "/login") sair();
  if (!resposta.ok) throw new Error(dados?.erro ?? `Erro ${resposta.status}`);
  return dados;
}

export function sair() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  location.href = "login.html";
}

// Manda para o login quem não está logado (ou não tem o perfil da página).
export function exigeLogin(...perfis) {
  const usuario = usuarioLogado();
  if (!usuario || (perfis.length && !perfis.includes(usuario.perfil))) {
    location.href = "login.html";
    throw new Error("redirecionando para o login");
  }
  return usuario;
}

export function montarPagina() {
  const usuario = usuarioLogado();
  const links = [`<a href="index.html">Quadras</a>`];
  if (usuario?.perfil === "JOGADOR")
    links.push(`<a href="reservar.html">Reservar</a>`, `<a href="minhas.html">Minhas reservas</a>`);
  if (usuario && usuario.perfil !== "JOGADOR") links.push(`<a href="equipe.html">Equipe</a>`);
  links.push(
    usuario
      ? `<span class="quem">${usuario.nome} · ${usuario.perfil.toLowerCase()}</span><button id="sair" class="link">Sair</button>`
      : `<a href="login.html">Entrar</a>`,
  );

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header><a class="logo" href="index.html">🎾 Quadra Livre</a><nav>${links.join("")}</nav></header>`,
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer>Quadra Livre · versão ${VERSAO}</footer>`,
  );
  document.querySelector("#sair")?.addEventListener("click", sair);
}
