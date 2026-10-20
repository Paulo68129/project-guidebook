import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/data";
import type { OnlineOrder } from "@/lib/online-order";
import { OrderReceipt } from "./OrderReceipt";
import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, AlertTriangle, XCircle, RefreshCw, Bell, BellOff, BadgePlus, Volume2, VolumeX, CheckCircle, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNewOrderSound } from "@/hooks/useNewOrderSound";
import { useOnlineOrdersRealtime } from "@/hooks/useOnlineOrdersRealtime";
import { aceitarPedido, recusarPedido } from "@/lib/online-order-api";

// Tempo limite para pagamento em segundos (5 minutos)
const PAYMENT_TIMEOUT_SECONDS = 5 * 60;
// Tempo para considerar um pedido como "novo" (3 minutos)
const NEW_ORDER_THRESHOLD_MS = 3 * 60 * 1000;

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

function isNewOrder(order: OnlineOrder): boolean {
  const createdAt = new Date(order.created_at).getTime();
  return (Date.now() - createdAt) < NEW_ORDER_THRESHOLD_MS;
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

// Função para limpar pedidos expirados via RPC
async function limparPedidosExpirados() {
  try {
    const { data, error } = await (supabase as any).rpc("limpar_pedidos_expirados");
    if (error) {
      console.warn("[OnlineOrders] Erro ao limpar pedidos expirados:", error.message);
    } else if (data?.expirados > 0) {
      console.log(`[OnlineOrders] ${data.expirados} pedido(s) expirado(s) e removido(s)`);
    }
  } catch (e) {
    console.warn("[OnlineOrders] Erro ao limpar pedidos expirados:", e);
  }
}

export function OnlineOrders() {
  const qc = useQueryClient();
  const { playNewOrderSound, isSoundEnabled, toggleSound } = useNewOrderSound();
  const soundEnabled = isSoundEnabled();
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  
  // Estado para diálogo de recusa
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  // Realtime - detecta novos pedidos instantaneamente
  useOnlineOrdersRealtime({
    onNewOrder: useCallback((order: any) => {
      const orderId = order.id;
      console.log("[OnlineOrders] Novo pedido detectado via Realtime:", orderId);
      
      // Toca o som de campainha
      playNewOrderSound(orderId);
      
      // Mostra notificação visual
      toast.success(`🔔 Novo pedido de ${order.cliente}!`, {
        duration: 5000,
      });
      
      // Invalida o cache para atualizar a lista
      qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    }, [playNewOrderSound, qc]),
    
    onOrderStatusChange: useCallback((order: any) => {
      console.log("[OnlineOrders] Status do pedido alterado:", order.id, "→", order.status);
      qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    }, [qc]),
    
    onOrderExpired: useCallback((order: any) => {
      console.log("[OnlineOrders] Pedido expirado:", order.id);
      toast.info(`Pedido de ${order.cliente} expirado automaticamente.`);
      qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    }, [qc]),
    
    onOrderDeleted: useCallback((order: any) => {
      console.log("[OnlineOrders] Pedido removido:", order.id);
      qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    }, [qc]),
  });

  // Limpeza automática de pedidos expirados a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      limparPedidosExpirados();
    }, 30000);
    
    // Executa imediatamente ao montar
    limparPedidosExpirados();
    
    return () => clearInterval(interval);
  }, []);

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

  // Aceitar pedido
  async function handleAceitarPedido(order: OnlineOrder & { token?: string }) {
    try {
      await aceitarPedido(order.id);
      toast.success(`Pedido de ${order.cliente} aceito!`);
      await qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aceitar o pedido");
    }
  }

  // Abrir diálogo de recusa
  function openRejectDialog(orderId: string) {
    setRejectOrderId(orderId);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  // Recusar pedido
  async function handleRecusarPedido() {
    if (!rejectOrderId) return;
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da recusa");
      return;
    }
    try {
      await recusarPedido(rejectOrderId, rejectReason.trim());
      toast.info("Pedido recusado");
      setRejectDialogOpen(false);
      setRejectOrderId(null);
      setRejectReason("");
      await qc.invalidateQueries({ queryKey: ["pedidos-online"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível recusar o pedido");
    }
  }

  return (
    <section className="mb-8 border-b pb-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl">Pedidos online · Aguardando pagamento</h2>
          {pedidosAtivos.some(p => isNewOrder(p)) && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 animate-pulse">
              <BadgePlus className="h-3 w-3" />
              Novo!
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Botão de toggle do som */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSound()}
            title={soundEnabled ? "Desativar som de alerta" : "Ativar som de alerta"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-green-600" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["pedidos-online"] })}
            disabled={q.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
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
          const isNew = isNewOrder(p);
          return (
            <article
              key={p.id}
              className={`rounded-lg border bg-card p-4 transition-all duration-300 ${
                isNew 
                  ? "border-green-400 bg-green-50 shadow-lg shadow-green-100 animate-pulse" 
                  : isUrgent 
                    ? "border-orange-300 shadow-orange-100 shadow-md" 
                    : ""
              }`}
            >
              {/* Selo de novo pedido */}
              {isNew && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white">
                    <BadgePlus className="h-3 w-3" />
                    NOVO PEDIDO
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2 font-semibold">
                <span>{p.cliente}</span>
                <span>{brl(Number(p.total))}</span>
              </div>

              <PaymentTimer
                order={p}
                onExpired={() => handleExpiredAuto(p as OnlineOrder & { token?: string })}
              />

              <p className="my-2 text-sm text-warning">Não pago · Não iniciar preparo</p>

              {/* Status do delivery */}
              {p.status_delivery === 'aceito' && (
                <div className="mb-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Pedido aceito</span>
                </div>
              )}
              {p.status_delivery === 'recusado' && (
                <div className="mb-2 flex items-center gap-2 text-sm text-red-600">
                  <XOctagon className="h-4 w-4" />
                  <span>Pedido recusado: {p.motivo_recusa || 'Sem motivo'}</span>
                </div>
              )}

              <div className="flex gap-2">
                {p.status_delivery === 'pendente' && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAceitarPedido(p as OnlineOrder & { token?: string })}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aceitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                      onClick={() => openRejectDialog(p.id)}
                    >
                      <XOctagon className="h-4 w-4 mr-1" />
                      Recusar
                    </Button>
                  </>
                )}
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

      {/* Diálogo de recusa */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. Este motivo será enviado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da recusa</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Produto indisponível, fora da área de entrega, etc."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRecusarPedido}
              disabled={!rejectReason.trim()}
            >
              <XOctagon className="h-4 w-4 mr-1" />
              Recusar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}