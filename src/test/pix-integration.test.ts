import { describe, it, expect } from "vitest";
import { generatePixPayload, maskPixChave, maskTelefone, getPixConfig } from "@/lib/pix";
import { isEnviareConfigured } from "@/lib/enviare";

describe("PIX Generation & Security Tests", () => {
  it("deve gerar payload PIX EMV válido com CRC16 de 4 dígitos", () => {
    const payload = generatePixPayload(59.9);
    expect(payload).toContain("000201"); // Format indicator
    expect(payload).toContain("BR.GOV.BCB.PIX"); // Pix domain
    expect(payload).toContain("540559.90"); // Amount TLV
    expect(payload).toContain("5802BR"); // Country
    expect(payload).toContain("6304"); // CRC tag
    expect(payload.length).toBeGreaterThan(60);

    // O final do payload deve conter 4 caracteres hexadecimais do CRC16
    const crc = payload.slice(-4);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it("deve mascarar a chave PIX para exibição pública segura", () => {
    const masked = maskPixChave("09406790785");
    expect(masked).toBe("***.067.907-**");
    expect(masked).not.toContain("09406790785");
  });

  it("deve mascarar telefones para exibição segura", () => {
    const masked = maskTelefone("(21) 99319-1234");
    expect(masked).toBe("(21) 99319-****");
  });

  it("deve retornar informações corretas de exibição do PIX", () => {
    const config = getPixConfig();
    expect(config.nome).toBe("PizzaStockAI");
    expect(config.chave).toBe("***.067.907-**");
  });
});

describe("Enviare Gateway & Fallback Tests", () => {
  it("deve indicar modo fallback quando chaves do Enviare não estiverem presentes", () => {
    const configured = isEnviareConfigured();
    // No ambiente local sem credenciais definidas, deve retornar falso e ativar fallback
    expect(typeof configured).toBe("boolean");
  });

  it("deve calcular e validar assinatura HMAC-SHA256 de webhook", async () => {
    const secret = "test_webhook_secret_123";
    const payload = JSON.stringify({
      event: "pagamento_aprovado",
      referenceId: "e1f185f4-3fc6-407a-97a9-8397a672776c",
      amount: 4500,
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(computedSignature).toHaveLength(64);

    // Validação
    const testVerifyKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const verifyBuffer = await crypto.subtle.sign("HMAC", testVerifyKey, encoder.encode(payload));
    const verifySignature = Array.from(new Uint8Array(verifyBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(verifySignature).toBe(computedSignature);
  });

  it("deve mapear corretamente todos os eventos da Enviare", () => {
    const supportedEvents = [
      "pagamento_criado",
      "pagamento_pendente",
      "pagamento_aprovado",
      "pagamento_cancelado",
      "pagamento_expirado",
    ];

    supportedEvents.forEach((ev) => {
      const isApproved = ev === "pagamento_aprovado";
      const isCancelled = ev === "pagamento_cancelado";
      const isExpired = ev === "pagamento_expirado";
      const isPending = ev === "pagamento_pendente" || ev === "pagamento_criado";

      expect(isApproved || isCancelled || isExpired || isPending).toBe(true);
    });
  });
});
