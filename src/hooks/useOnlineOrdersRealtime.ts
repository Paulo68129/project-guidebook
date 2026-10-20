import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook que escuta mudanças em tempo real na tabela pedidos_online via Supabase Realtime.
 * Notifica quando um novo pedido chega, quando o status muda, ou quando um pedido é expirado.
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

  // Mantém as callbacks atualizadas
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
    onOrderStatusChangeRef.current = onOrderStatusChange;
    onOrderExpiredRef.current = onOrderExpired;
    onOrderDeletedRef.current = onOrderDeleted;
  }, [onNewOrder, onOrderStatusChange, onOrderExpired, onOrderDeleted]);

  // Subscrição Realtime
  useEffect(() => {
    // Subscrição na tabela pedidos_online
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
          console.log("[Realtime] Novo pedido recebido:", order.id);
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
          console.log("[Realtime] Pedido atualizado:", order.id);

          // Verifica se o status mudou
          if (oldOrder.status !== order.status) {
            // Verifica se o pedido foi expirado
            if (order.status === "cancelado" && order.status_pagamento === "expirado") {
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
          console.log("[Realtime] Pedido removido:", order.id);
          onOrderDeletedRef.current?.(order);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Subscrito com sucesso a pedidos_online");
        } else {
          console.warn("[Realtime] Status de subscrição:", status);
        }
      });

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // Função para manualmente ressubscrição
  const resubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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
          onNewOrderRef.current?.(payload.new as any);
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
          if (oldOrder.status !== order.status) {
            if (order.status === "cancelado" && order.status_pagamento === "expirado") {
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
          onOrderDeletedRef.current?.(payload.old as any);
        }
      )
      .subscribe();
  }, []);

  return {
    resubscribe,
    isSubscribed: channelRef.current !== null,
  };
}
