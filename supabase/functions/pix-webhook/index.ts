import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const webhookSecret = Deno.env.get("ENVIARE_WEBHOOK_SECRET") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Valida a assinatura do webhook do Enviare usando HMAC-SHA256.
 */
async function verifyWebhookSignature(payload: string, rawSignature: string): Promise<boolean> {
  if (!webhookSecret) {
    console.warn("[pix-webhook] ENVIARE_WEBHOOK_SECRET não configurado - operando em modo de aceitação permissiva");
    return true;
  }

  if (!rawSignature) {
    console.error("[pix-webhook] Assinatura ausente nos cabeçalhos da requisição");
    return false;
  }

  try {
    const cleanSignature = rawSignature.replace(/^sha256=/i, "").trim().toLowerCase();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();

    const isValid = computedSignature === cleanSignature;
    if (!isValid) {
      console.error("[pix-webhook] Falha de assinatura. Recebida:", cleanSignature, "Calculada:", computedSignature);
    }
    return isValid;
  } catch (error) {
    console.error("[pix-webhook] Erro ao validar assinatura HMAC:", error);
    return false;
  }
}

serve(async (req: Request) => {
  // Tratamento de CORS para preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawSignature =
    req.headers.get("x-enviare-signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("x-hub-signature-256") ||
    "";

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error("[pix-webhook] Falha ao ler corpo da requisição:", e);
    return new Response(JSON.stringify({ error: "Cannot read request body" }), { status: 400 });
  }

  // Validação da assinatura
  const isSignatureValid = await verifyWebhookSignature(rawBody, rawSignature);
  if (!isSignatureValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let webhookData: any;
  try {
    webhookData = JSON.parse(rawBody);
  } catch {
    console.error("[pix-webhook] JSON malformado no payload:", rawBody);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // Normalização dos campos suportados pelo Enviare
  const rawEvent = (webhookData.event || webhookData.type || webhookData.action || "").toString().toLowerCase();
  const rawStatus = (webhookData.status || webhookData.data?.status || "").toString().toLowerCase();
  const referenceId =
    webhookData.referenceId ||
    webhookData.reference_id ||
    webhookData.external_reference ||
    webhookData.data?.referenceId ||
    webhookData.data?.reference_id ||
    webhookData.data?.external_reference ||
    "";
  const transactionId =
    webhookData.id ||
    webhookData.transactionId ||
    webhookData.transaction_id ||
    webhookData.data?.id ||
    webhookData.data?.transactionId ||
    "";
  const valor = Number(webhookData.amount || webhookData.data?.amount || 0) / (webhookData.amount > 1000 ? 100 : 1);

  console.log("[pix-webhook] Evento recebido:", {
    rawEvent,
    rawStatus,
    referenceId,
    transactionId,
    timestamp: new Date().toISOString(),
  });

  if (!referenceId && !transactionId) {
    console.error("[pix-webhook] Nem referenceId nem transactionId foram informados no payload");
    return new Response(JSON.stringify({ error: "Missing referenceId or transactionId" }), { status: 400 });
  }

  try {
    // 1. Localizar o pedido correspondente
    let query = supabase.from("pedidos_online").select("*");
    if (referenceId) {
      query = query.eq("id", referenceId);
    } else {
      query = query.eq("transaction_id", transactionId);
    }

    const { data: pedido, error: findError } = await query.maybeSingle();

    if (findError || !pedido) {
      console.error("[pix-webhook] Pedido online não encontrado no banco:", { referenceId, transactionId });
      return new Response(JSON.stringify({ error: "Pedido não encontrado", referenceId }), { status: 404 });
    }

    const pedidoId = pedido.id;

    // Categorização dos eventos Enviare
    const isApproved =
      rawEvent === "pagamento_aprovado" ||
      rawEvent === "payment.confirmed" ||
      rawEvent === "payment.approved" ||
      rawEvent === "pix.confirmed" ||
      rawEvent === "paid" ||
      rawStatus === "paid" ||
      rawStatus === "approved" ||
      rawStatus === "pago";

    const isCancelled =
      rawEvent === "pagamento_cancelado" ||
      rawEvent === "payment.cancelled" ||
      rawEvent === "payment.canceled" ||
      rawEvent === "pix.cancelled" ||
      rawStatus === "cancelled" ||
      rawStatus === "canceled" ||
      rawStatus === "cancelado";

    const isExpired =
      rawEvent === "pagamento_expirado" ||
      rawEvent === "payment.expired" ||
      rawEvent === "pix.expired" ||
      rawStatus === "expired" ||
      rawStatus === "expirado";

    const isPending =
      rawEvent === "pagamento_pendente" ||
      rawEvent === "pagamento_criado" ||
      rawEvent === "payment.created" ||
      rawEvent === "payment.pending" ||
      rawStatus === "pending" ||
      rawStatus === "aguardando";

    // 2. Registrar auditoria na tabela pagamentos_online
    try {
      await supabase.from("pagamentos_online").insert({
        pedido_id: pedidoId,
        transaction_id: transactionId || pedido.transaction_id,
        status: isApproved ? "pago" : isCancelled ? "cancelado" : isExpired ? "expirado" : "aguardando",
        metodo: "pix",
        valor: valor > 0 ? valor : Number(pedido.total),
        payload_webhook: webhookData,
      });
    } catch (auditError) {
      console.warn("[pix-webhook] Aviso: falha ao salvar log em pagamentos_online:", auditError);
    }

    // 3. Processar evento de Pagamento Aprovado
    if (isApproved) {
      // Idempotência: se já estiver pago, retorna sucesso
      if (pedido.status_pagamento === "pago") {
        console.log("[pix-webhook] Pedido já foi previamente confirmado:", pedidoId);
        return new Response(JSON.stringify({ success: true, message: "Already processed", pedidoId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Atualiza status_pagamento no pedido_online
      await supabase
        .from("pedidos_online")
        .update({
          status: "pago",
          status_pagamento: "pago",
          transaction_id: transactionId || pedido.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      // Invoca a função confirmar_pagamento_online para sincronizar com Vendas, Estoque e PDV
      const { data: vendaId, error: rpcError } = await supabase.rpc("confirmar_pagamento_online", {
        _pedido_id: pedidoId,
      });

      if (rpcError) {
        console.error("[pix-webhook] Erro ao executar confirmar_pagamento_online:", rpcError);
        return new Response(
          JSON.stringify({ error: "Erro na sincronização de venda/estoque", details: rpcError.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log("[pix-webhook] Pagamento PIX aprovado e sincronizado com sucesso:", {
        pedidoId,
        vendaId,
        transactionId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Pagamento confirmado, venda gerada e estoque atualizado",
          pedidoId,
          vendaId,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Processar evento de Pagamento Cancelado
    if (isCancelled) {
      await supabase
        .from("pedidos_online")
        .update({
          status: "cancelado",
          status_pagamento: "cancelado",
          transaction_id: transactionId || pedido.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      console.log("[pix-webhook] Pedido marcado como cancelado:", pedidoId);
      return new Response(JSON.stringify({ success: true, status: "cancelado", pedidoId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Processar evento de Pagamento Expirado
    if (isExpired) {
      await supabase
        .from("pedidos_online")
        .update({
          status: "expirado",
          status_pagamento: "expirado",
          transaction_id: transactionId || pedido.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      console.log("[pix-webhook] Pedido marcado como expirado:", pedidoId);
      return new Response(JSON.stringify({ success: true, status: "expirado", pedidoId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Processar evento de Pagamento Pendente / Criado
    if (isPending) {
      await supabase
        .from("pedidos_online")
        .update({
          status_pagamento: "aguardando",
          transaction_id: transactionId || pedido.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      console.log("[pix-webhook] Pedido registrado como aguardando pagamento:", pedidoId);
      return new Response(JSON.stringify({ success: true, status: "aguardando", pedidoId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Outros eventos informativos
    console.log("[pix-webhook] Evento ignorado ou não requer ação:", { rawEvent, rawStatus });
    return new Response(JSON.stringify({ success: true, message: "Event ignored", event: rawEvent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[pix-webhook] Erro inesperado ao processar webhook:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
