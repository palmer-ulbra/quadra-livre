# Quadra Livre 🎾 (app da Aula 17: gestão de defeitos e testes baseados em risco)

Um site de reserva de quadras esportivas, na **versão candidata `2.0.0-rc.1`**. A pergunta da
aula: **dá para publicar esta versão?**

**páginas HTML/CSS/JS puro → API (Express) → SQLite**

Precisa de Node 22.13 ou mais novo (usa o `node:sqlite`, que já vem no Node). Nenhum banco para
instalar, nenhum build.

## Rodar

```bash
npm install
npm start          # http://localhost:3000 (na 1ª vez o banco já nasce com o cenário)
npm run seed       # volta o banco ao cenário da aula, a qualquer momento
npm test           # testes de ponto de partida (caminho feliz)
```

Para olhar o banco: `npm run sql -- "SELECT * FROM reservas"`.

## Quem é quem

Todos os usuários têm a senha **`senha123`**.

| id | Nome | E-mail | Perfil | O que faz no sistema |
| --- | --- | --- | --- | --- |
| 1 | Ana Souza | `ana@exemplo.com` | JOGADOR | reserva e paga pelo site, cancela as próprias reservas |
| 2 | Bruno Lima | `bruno@exemplo.com` | JOGADOR | idem |
| 3 | Carla Rocha | `atendente@exemplo.com` | ATENDENTE | reserva no balcão para um jogador, cancela qualquer reserva |
| 4 | Diego Alves | `gerente@exemplo.com` | GERENTE | tudo da atendente + altera preços + relatório mensal |

| id | Quadra | Esporte | Preço por hora |
| --- | --- | --- | --- |
| 1 | Quadra 1 | Futsal | R$ 120,00 |
| 2 | Quadra 2 | Vôlei de areia | R$ 80,00 |
| 3 | Quadra 3 | Tênis | R$ 100,00 |

O cenário já traz seis reservas. As datas são relativas ao dia em que você roda o `npm run seed`
(amanhã, daqui a 3 dias…), então o cenário funciona em qualquer dia.

**Cartão de teste:** `4111 1111 1111 1111` é aprovado; qualquer outro número é recusado. O
gateway de pagamento é simulado (`src/pagamento.js`) e, como os de verdade, às vezes demora demais
para responder.

**Dica:** para usar dois perfis ao mesmo tempo, abra uma janela normal e uma anônima, ou dois
navegadores diferentes.

## Telas

| Tela | Quem | O que faz |
| --- | --- | --- |
| `index.html` | todos | as quadras e os preços |
| `login.html` | todos | entrar |
| `reservar.html` | jogador | escolher quadra, data e horário livre; pagar com cartão |
| `comprovante.html` | dono ou equipe | o comprovante de uma reserva |
| `minhas.html` | jogador | minhas reservas, cancelar |
| `equipe.html` | atendente e gerente | balcão (reservas do dia, nova reserva, cancelar), preços, relatório |

## Regras de negócio (o que o sistema DEVERIA fazer)

- **R1** Uma quadra, num mesmo dia e horário, tem no máximo **uma** reserva confirmada, não importa
  quem reservou nem por onde (site ou balcão).
- **R2** Funcionamos das 8h às 23h: o último horário começa às 22h. Cada reserva é de 1 hora.
- **R3** Não dá para reservar um horário que já começou ou já passou.
- **R4** O jogador paga na hora (cartão pelo site, ou no balcão). Se o pagamento falhar, seja cartão
  recusado ou erro no gateway, **nenhuma reserva é criada** e o horário continua livre.
- **R5** Cancelamento: com **24 h ou mais** de antecedência do início, o reembolso é de **100%**; com
  **menos de 24 h**, **50%**. Depois que a reserva começou, não dá mais para cancelar.
- **R6** O jogador só vê e cancela as próprias reservas; a equipe (atendente e gerente) vê e cancela
  todas.
- **R7** **Só o gerente** altera preços.
- **R8** O gerente tira o relatório de qualquer mês: reservas confirmadas, faturamento (pago menos
  reembolsado) e a quadra mais reservada.
- **R9** Todo horário mostrado ao usuário é o horário local da quadra (Brasília).
- **R10** Todas as telas funcionam no celular (a partir de 375 px de largura).

## Achou um defeito?

Registre como **issue** neste repositório usando o modelo **"Defeito"**: passos para reproduzir,
resultado esperado, resultado obtido, evidências, ambiente e versão. Severidade e prioridade viram
rótulos (`sev:*` e `prio:*`) na triagem.

Para criar os rótulos no seu fork: `bash scripts/rotulos.sh` (precisa do [GitHub CLI](https://cli.github.com/) logado).

## Depois da publicação: o sábado do incidente

A 2.0 foi publicada. No sábado, 28/11/2026, parte das reservas começou a falhar. O dossiê
do incidente está na pasta `incidente/`:

| Arquivo | O que é |
| --- | --- |
| `incidente/painel.txt` | o painel de métricas: requisições, % de erro 5xx e p95 por hora e por rota |
| `incidente/sabado.log` | o log de acesso e de erros do sábado, das 8h às 12h |
| `incidente/trace-ERR-2F5047.txt` | o trace (didático) de uma das reservas que falharam |

Para gerar um sábado novo (os números mudam um pouco a cada vez): `npm run sabado`. Ele
usa um banco em memória e não mexe no `data/quadra-livre.sqlite`.

**Feature flag:** `PAGAMENTO_ONLINE=off npm start` desliga a reserva com cartão pelo site
(responde `503` com uma mensagem para reservar no balcão). O balcão continua funcionando.

O gateway simulado tem três botões, em `src/pagamento.js`: `taxaDeFalha`, `latenciaMs` e
`esperaNaFalhaMs`.

## Onde está cada coisa

| Arquivo | O que faz |
| --- | --- |
| `src/app.js` | as rotas e as regras |
| `src/pagamento.js` | o gateway de pagamento simulado |
| `scripts/sabado.js` | simula o sábado do incidente e gera `incidente/` |
| `src/db.js` | abre o SQLite e cria as tabelas |
| `src/seed.js` | o cenário da aula |
| `src/datas.js` | datas no fuso local |
| `public/` | as telas (o que está ali é exatamente o que o navegador recebe) |
| `public/comum.js` | chamada à API, sessão, cabeçalho e rodapé |
| `tests/api.test.js` | testes de ponto de partida (`node:test`, sem dependência) |
| `.github/ISSUE_TEMPLATE/defeito.yml` | o modelo de registro de defeito |

Erro inesperado aparece na tela com um código (`ERR-XXXXXX`); o mesmo código aparece no terminal
do `npm start`, com os detalhes. Ele é uma boa evidência.
