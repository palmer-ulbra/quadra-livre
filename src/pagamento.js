import { randomBytes } from "node:crypto";

// Gateway de pagamento SIMULADO. No mundo real é um serviço externo, e serviços externos
// às vezes não respondem: aqui, de propósito, uma em cada cinco cobranças dá tempo esgotado.
// Cartão de teste: 4111 1111 1111 1111 → aprovado. Qualquer outro → recusado.
export const gateway = { taxaDeFalha: 0.2 }; // os testes zeram isto

export async function cobrar(cartao, valor) {
  await new Promise((pronto) => setTimeout(pronto, 300));
  if (Math.random() < gateway.taxaDeFalha)
    throw new Error(`gateway: tempo esgotado ao cobrar ${valor}`);
  if (String(cartao).replace(/\D/g, "") !== "4111111111111111")
    return { aprovado: false };
  return { aprovado: true, transacao: `TX-${randomBytes(3).toString("hex").toUpperCase()}` };
}
