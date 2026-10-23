import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createServerSupabaseClient() {
  const url = (process.env['SUPABASE_URL'] as string | undefined) || (process.env['VITE_SUPABASE_URL'] as string | undefined);
  const anonKey = (process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) || (process.env['SUPABASE_PUBLISHABLE_KEY'] as string | undefined);

  if (!url || !anonKey) {
    throw new Error("Configuração do Supabase indisponível no backend");
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Configuração da API do Enviare.
 * Variáveis de ambiente:
 * - ENVIARE_API_KEY: Chave de API da Enviare
 * - ENVIARE_MERCHANT_ID: Identificador do estabelecimento
 * - ENVIARE_WEBHOOK_SECRET: Segredo HMAC para assinatura de webhook
 * - ENVIARE_WEBHOOK_URL: URL do webhook (Supabase Edge Function)
 * - ENVIARE_BASE_URL: URL base da API da Enviare (padrão: https://api.enviare.com.br/v1)
 */
export const ENVIARE_CONFIG = {
  get apiKey() { return (process.env['ENVIARE_API_KEY'] as string | undefined) || ''; },
  get merchantId() { return (process.env['ENVIARE_MERCHANT_ID'] as string | undefined) || ''; },
  get baseUrl() { return (process.env['ENVIARE_BASE_URL'] as string | undefined) || 'https://api.enviare.com.br/v1'; },
  get webhookSecret() { return (process.env['ENVIARE_WEBHOOK_SECRET'] as string | undefined) || ''; },
  get webhookUrl() { return (process.env['ENVIARE_WEBHOOK_URL'] as string | undefined) || ''; },
};

/**
 * Valida se as variáveis de integração com a Enviare estão configuradas.
 */
export function isEnviareConfigured(): boolean {
  const configured = !!(ENVIARE_CONFIG.apiKey.trim() && ENVIARE_CONFIG.merchantId.trim());
  if (!configured) {
    console.info("[enviare] Integração Enviare não configurada (chaves ausentes). Modo fallback ativo (PIX Estático).");
  }
  return configured;
}

/**
 * Retorna o status operacional da integração de pagamentos para painéis administrativos.
 */
export const getGatewayStatus = createServerFn({ method: "GET" }).handler(async () => {
  const isConfigured = isEnviareConfigured();
  return {
    configured: isConfigured,
    mode: isConfigured ? "production_enviare" : "fallback_pix_estatico",
    hasApiKey: !!ENVIARE_CONFIG.apiKey.trim(),
    hasMerchantId: !!ENVIARE_CONFIG.merchantId.trim(),
    hasWebhookSecret: !!ENVIARE_CONFIG.webhookSecret.trim(),
    hasWebhookUrl: !!ENVIARE_CONFIG.webhookUrl.trim(),
    webhookUrl: ENVIARE_CONFIG.webhookUrl || "Não configurada",
  };
});

export interface CreatePixPaymentInput {
  pedidoId: string;
  amount: number;
  description: string;
  customerName: string;
  customerPhone: string;
}

export interface CreatePixPaymentOutput {
  qrCode: string;
  pixCopiaCola: string;
  transactionId: string;
  expiresAt?: string;
}

/**
 * Cria uma cobrança PIX dinâmica via API Enviare.
 * Em caso de indisponibilidade ou ausência de chaves, retorna null para acionar o fallback estático.
 */
export const createPixPayment = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<CreatePixPaymentOutput | null> => {
    const { pedidoId, amount, description, customerName, customerPhone } = (data || {}) as CreatePixPaymentInput;

    if (!pedidoId || typeof amount !== "number" || amount <= 0) {
      console.warn("[enviare] createPixPayment: Parâmetros inválidos fornecidos:", { pedidoId, amount });
      return null;
    }

    if (!isEnviareConfigured()) {
      return null;
    }

    try {
      console.log(`[enviare] Solicitando cobrança PIX para o pedido ${pedidoId} (R$ ${amount.toFixed(2)})`);

      const response = await fetch(`${ENVIARE_CONFIG.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENVIARE_CONFIG.apiKey}`,
          "X-Merchant-Id": ENVIARE_CONFIG.merchantId,
        },
        body: JSON.stringify({
          type: "pix",
          amount: Math.round(amount * 100), // Enviare recebe centavos
          description: description || `Pedido ${pedidoId.slice(0, 8)}`,
          referenceId: pedidoId,
          expiresInSeconds: 3600, // 1 hora
          customer: {
            name: customerName || "Cliente",
            phone: customerPhone || "",
          },
          ...(ENVIARE_CONFIG.webhookUrl ? { webhookUrl: ENVIARE_CONFIG.webhookUrl } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[enviare] Falha na API Enviare (${response.status}):`, errorText);
        return null;
      }

      const resData = await response.json();

      const qrCode = resData.qrCode || resData.qrcode || resData.pointOfInteraction?.transactionData?.qrCode || "";
      const pixCopiaCola =
        resData.pixCopiaCola ||
        resData.pointOfInteraction?.transactionData?.qrCode ||
        qrCode;
      const transactionId = (resData.id || resData.transactionId || "").toString();

      console.log(`[enviare] Cobrança PIX gerada com sucesso para o pedido ${pedidoId}. Transaction ID: ${transactionId}`);

      return {
        qrCode,
        pixCopiaCola,
        transactionId,
        expiresAt: resData.expiresAt || resData.expires_at,
      };
    } catch (error) {
      console.error("[enviare] Exceção na requisição à API Enviare:", error);
      return null;
    }
  }
);

/**
 * Atualiza as informações de pagamento geradas no registro do pedido online.
 */
export const updatePaymentData = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { pedidoId, qrCode, pixCopiaCola, transactionId } = (data || {}) as {
      pedidoId: string;
      qrCode?: string;
      pixCopiaCola?: string;
      transactionId?: string;
    };

    if (!pedidoId) {
      throw new Error("pedidoId é obrigatório para atualizar dados de pagamento");
    }

    const db = createServerSupabaseClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (qrCode) updatePayload['qr_code_pix'] = qrCode;
    if (pixCopiaCola) updatePayload['pix_copia_cola'] = pixCopiaCola;
    if (transactionId) updatePayload['transaction_id'] = transactionId;

    const { error } = await db
      .from("pedidos_online")
      .update(updatePayload as any)
      .eq("id", pedidoId);

    if (error) {
      console.error("[enviare] Erro ao gravar dados de pagamento no pedido:", error);
      throw new Error("Erro ao atualizar dados de pagamento: " + error.message);
    }

    return { success: true };
  }
);
