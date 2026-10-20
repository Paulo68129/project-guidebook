import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/data";
import type { OnlineOrder } from "@/lib/online-order";
import { OrderReceipt } from "./OrderReceipt";
import { useState, useEffect } from "react";
import { Clock, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Tempo limite para pagamento em segundos (15 minutos)
const PAYMENT_TIMEOUT_SECONDS = 15 * 60;

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getRemainingSeconds(order: OnlineOrder): number {
  const expiresAt = order.expires_at ? new Date(order.expires_at).getTime() : new Date(order.created_at).getTime() + PAYMENT_TIMEOUT_SECONDS * 1000;
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return remaining;
}

function PaymentTimer({ order, onExpired }: { order: OnlineOrder; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(getRemainingSeconds(order));

  useEffect(() => {
    const interval = setInterval(() => {
      const newRemaining = getRemainingSeconds(order);
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [order, onExpired]);

  const isUrgent = remaining < 60 && remaining > 0; // Menos de 1 minuto
  const isExpired = remaining <= 0;

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${
      isExpired ? "text-destructive" : isUrgent ? "text-orange-500 animate-pulse" : "text-muted-foreground"
    }`}>
      {isExpired ? (
        <>
          <XCircle className="h-4 w-4" />
          <span>Tempo expirado</span>
        </>
      ) : (
        <>
          <Clock className="h-4 w-4" />
          <span>Pagamento em: {formatTime(remaining)}</span>
        </>
      )}
    </div>
  );
}

async function expirarPedido(token: string) {
  const { error } = await (supabase as any).rpc("expirar_pedido_online", { _token: token });
  if (error) throw error;
}

export function OnlineOrders() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["pedidos-online"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_online")
        .select("id,token,cliente,telefone,endereco,itens,subtotal,desconto,taxa_entrega,total,status,created_at,expires_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      // Normaliza itens que podem vir como string JSON do Supabase
      return (data || []).map((row: any) => {
        let itens = row.itens;
        if (typeof itens === "string") {
          try {
            itens = JSON.parse(itens);
          } catch {
            itens = [];
          }
        }
        if (!Array.isArray(itens)) itens = [];
        return { ...row, itens } as OnlineOrder & { token?: string };
      });
    },
  });

  // Filtra pedidos expirados do painel
  const pedidosAtivos = (q.data || []).filter((p) => {
    const remaining = getRemainingSeconds(p);
    return remaining > 0 && p.status === "aguardando_pagamento";
  });

  const pedidosExpirados = (q.data || []).filter((p) => {
    const remaining = getRemainingSeconds(p);
    return remaining <= 0 && p.status === "aguardando_pagamento";
  });

  async function handleExpirarPedido(order: OnlineOrder & { token?: string }) {
    if (!order.token) {
      toast.error("Token do pedido não disponível");
      return;
    }
    try {
      await expirarPedido(order.token);
      toast.success("Pedido expirado. Nova compra pode ser feita.");
      await qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    } catch (e) {
      toast.error("Não foi possível expirar o pedido");
    }
  }

  async function handleExpiredAuto(order: OnlineOrder & { token?: string }) {
    if (!order.token) return;
    try {
      await expirarPedido(order.token);
      await qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    } catch {
      // Silencioso - o pedido será filtrado do painel
    }
  }

  return (
    <section className="mb-8 border-b pb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl">Pedidos online · Aguardando pagamento</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["pedidos-online"] })}
          disabled={q.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {q.isPending && <p className="text-muted-foreground">Carregando pedidos…</p>}
      {q.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-destructive font-semibold">Não foi possível carregar os pedidos online.</p>
          <p className="text-xs text-red-600 mt-1">{q.error instanceof Error ? q.error.message : "Erro desconhecido"}</p>
        </div>
      )}

      {pedidosAtivos.length === 0 && pedidosExpirados.length === 0 && !q.isPending && (
        <p className="py-2 text-sm text-muted-foreground">Nenhum pedido online recebido.</p>
      )}

      {/* Pedidos expirados - aviso */}
      {pedidosExpirados.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-orange-700 font-semibold mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{pedidosExpirados.length} pedido(s) com tempo de pagamento expirado</span>
          </div>
          <div className="space-y-2">
            {pedidosExpirados.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-orange-200 bg-white p-3">
                <div>
                  <span className="font-semibold">{p.cliente}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{brl(Number(p.total))}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                  onClick={() => handleExpirarPedido(p as OnlineOrder & { token?: string })}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedidos ativos com timer */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pedidosAtivos.map((p) => {
          const remaining = getRemainingSeconds(p);
          const isUrgent = remaining < 60 && remaining > 0;
          return (
            <article
              key={p.id}
              className={`rounded-lg border bg-card p-4 ${isUrgent ? "border-orange-300 shadow-orange-100 shadow-md" : ""}`}
            >
              <div className="flex flex-wrap justify-between gap-2 font-semibold">
                <span>{p.cliente}</span>
                <span>{brl(Number(p.total))}</span>
              </div>

              <PaymentTimer
                order={p}
                onExpired={() => handleExpiredAuto(p as OnlineOrder & { token?: string })}
              />

              <p className="my-2 text-sm text-warning">Não pago · Não iniciar preparo</p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                  onClick={() => handleExpirarPedido(p as OnlineOrder & { token?: string })}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar pedido
                </Button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-primary">Itens e comprovante</summary>
                <div className="mt-3">
                  <OrderReceipt order={p} />
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}