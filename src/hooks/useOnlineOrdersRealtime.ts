import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook que escuta mudanças em tempo real na tabela pedidos_online via Supabase Realtime.
 * Notifica quando um novo pedido chega, quando o status muda, ou quando um pedido é expirado.
 *
 * Recursos:
 * - Reconnect automático em caso de falha de conexão
 * - Heartbeat para detectar conexões mortas
 * - Logging detalhado para debug
 * - Callbacks para todos os eventos (INSERT, UPDATE, DELETE)
 */
export function useOnlineOrdersRealtime({
  onNewOrder,
  onOrderStatusChange,
  onOrderExpired,
  onOrderDeleted,
}: {
  onNewOrder?: (order: any) => void;
  onOrderStatusChange?: (order: any) => void;
  onOrderExpired?: (order: any) => void;
  onOrderDeleted?: (order: any) => void;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewOrderRef = useRef(onNewOrder);
  const onOrderStatusChangeRef = useRef(onOrderStatusChange);
  const onOrderExpiredRef = useRef(onOrderExpired);
  const onOrderDeletedRef = useRef(onOrderDeleted);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Mantém as callbacks atualizadas
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
    onOrderStatusChangeRef.current = onOrderStatusChange;
    onOrderExpiredRef.current = onOrderExpired;
    onOrderDeletedRef.current = onOrderDeleted;
  }, [onNewOrder, onOrderStatusChange, onOrderExpired, onOrderDeleted]);

  // Função para criar a subscrição Realtime
  const createSubscription = useCallback(() => {
    // Limpa subscrição existente
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log("[Realtime] Criando subscrição a pedidos_online...");

    channelRef.current = supabase
      .channel("pedidos-online-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pedidos_online",
        },
        (payload) => {
          const order = payload.new as any;
          console.log("[Realtime] ✓ Novo pedido recebido via INSERT:", order.id, "status:", order.status);
          onNewOrderRef.current?.(order);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos_online",
        },
        (payload) => {
          const order = payload.new as any;
          const oldOrder = payload.old as any;
          console.log("[Realtime] ✓ Pedido atualizado via UPDATE:", order.id);

          // Verifica se o status mudou
          if (oldOrder?.status !== order.status) {
            console.log(`  → Status mudou: ${oldOrder?.status} → ${order.status}`);

            // Verifica se o pedido foi expirado
            if (order.status === "cancelado" && order.status_pagamento === "expirado") {
              console.log("  → Pedido expirado");
              onOrderExpiredRef.current?.(order);
            } else {
              onOrderStatusChangeRef.current?.(order);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pedidos_online",
        },
        (payload) => {
          const order = payload.old as any;
          console.log("[Realtime] ✓ Pedido removido via DELETE:", order?.id);
          onOrderDeletedRef.current?.(order);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] ✅ Subscrito com sucesso a pedidos_online");
          setIsConnected(true);
          setReconnectAttempts(0);
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] ❌ Erro na subscrição a pedidos_online - status:", status);
          setIsConnected(false);
          // Tenta reconectar automaticamente
          scheduleReconnect();
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] ⏰ Timeout na subscrição - tentando reconectar...");
          setIsConnected(false);
          scheduleReconnect();
        } else {
          console.log("[Realtime] Status de subscrição:", status);
        }
      });

    return channelRef.current;
  }, []);

  // Função para agendar reconexão automática
  const scheduleReconnect = useCallback(() => {
    // Limpa timeout existente
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }

    const attempts = reconnectAttempts + 1;
    setReconnectAttempts(attempts);

    // Backoff exponencial: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(2000 * Math.pow(2, attempts - 1), 30000);
    console.log(`[Realtime] 🔄 Reconexão agendada em ${delay}ms (tentativa ${attempts})`);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      console.log("[Realtime] 🔄 Tentando reconexão...");
      createSubscription();
    }, delay);
  }, [reconnectAttempts, createSubscription]);

  // Subscrição Realtime inicial
  useEffect(() => {
    createSubscription();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [createSubscription]);

  // Função para manualmente ressubscrição
  const resubscribe = useCallback(() => {
    console.log("[Realtime] Ressubscrição manual solicitada");
    setReconnectAttempts(0);
    createSubscription();
  }, [createSubscription]);

  return {
    resubscribe,
    isSubscribed: channelRef.current !== null,
    isConnected,
    reconnectAttempts,
  };
}
