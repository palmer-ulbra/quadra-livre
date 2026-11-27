import { randomBytes } from "node:crypto";

// Gateway de pagamento SIMULADO. No mundo real é um serviço externo, e serviços externos
// às vezes não respondem: aqui, de propósito, uma parte das cobranças dá tempo esgotado.
// Cartão de teste: 4111 1111 1111 1111 → aprovado. Qualquer outro → recusado.
export const gateway = {
  taxaDeFalha: 0.6, // fração das cobranças que dão tempo esgotado (os testes zeram)
  latenciaMs: 300, // quanto uma cobrança normal demora
  esperaNaFalhaMs: 300, // quanto o gateway segura a conexão antes de desistir
};

const esperar = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

export async function cobrar(cartao, valor) {
  if (Math.random() < gateway.taxaDeFalha) {
    await esperar(gateway.esperaNaFalhaMs);
    throw new Error(`gateway: tempo esgotado ao cobrar ${valor}`);
  }
  await esperar(gateway.latenciaMs);
  if (String(cartao).replace(/\D/g, "") !== "4111111111111111")
    return { aprovado: false };
  return { aprovado: true, transacao: `TX-${randomBytes(3).toString("hex").toUpperCase()}` };
}
