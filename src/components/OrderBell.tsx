import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/data";

export type PedidoAlerta = {
  numero: number;
  cliente: string;
  itens: { nome: string; quantidade: number; preco_unitario: number }[];
  total: number;
  created_at: string;
  /** Origem do pedido: PDV, DELIVERY, LOJA ONLINE */
  origem?: "PDV" | "DELIVERY" | "LOJA ONLINE";
};

export function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.15);
    });
  } catch {
    /* sem áudio */
  }
}

export function OrderBell({ onNotify }: { onNotify?: (pedido: PedidoAlerta) => void }) {
  const qc = useQueryClient();
  const [alerts, setAlerts] = useState<PedidoAlerta[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const somRef = useRef(true);

  useEffect(() => {
    // Carregar configuração de som
    supabase
      .from("loja_config")
      .select("som_alerta")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        somRef.current = data?.som_alerta ?? true;
      });

    // Canal unificado: escuta vendas (PDV) E pedidos_online (Loja Online)
    const ch = supabase
      .channel("loja-online-pedidos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vendas" },
        async (payload) => {
          const venda = payload.new as {
            id: string;
            numero: number;
            cliente: string;
            total: number;
            tipo: string;
            created_at: string;
          };

          // Buscar itens da venda
          const { data: itens } = await supabase
            .from("venda_itens")
            .select("nome, quantidade, preco_unitario")
            .eq("venda_id", venda.id);

          const pedido: PedidoAlerta = {
            numero: venda.numero,
            cliente: venda.cliente ?? "Cliente",
            itens: itens ?? [],
            total: Number(venda.total),
            created_at: venda.created_at,
            origem: venda.tipo === "delivery" ? "DELIVERY" : "PDV",
          };

          setAlerts((prev) => [pedido, ...prev].slice(0, 20));
          setShowPanel(true);

          if (somRef.current) {
            beep();
          }

          qc.invalidateQueries({ queryKey: ["vendas"] });
          qc.invalidateQueries({ queryKey: ["ingredientes"] });

          onNotify?.(pedido);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos_online" },
        async (payload) => {
          const pedidoOnline = payload.new as {
            id: string;
            cliente: string;
            total: number;
            itens: any;
            created_at: string;
          };

          // Normaliza os itens do pedido online
          let itens: { nome: string; quantidade: number; preco_unitario: number }[] = [];
          try {
            const raw = typeof pedidoOnline.itens === "string"
              ? JSON.parse(pedidoOnline.itens)
              : pedidoOnline.itens;
            if (Array.isArray(raw)) {
              itens = raw.map((item: any) => ({
                nome: item.nome ?? "Item",
                quantidade: Number(item.quantidade) || 1,
                preco_unitario: Number(item.preco_unitario) || 0,
              }));
            }
          } catch {
            // Se falhar, usa itens vazios
          }

          const pedido: PedidoAlerta = {
            numero: 0, // pedidos_online não tem número sequencial
            cliente: pedidoOnline.cliente ?? "Cliente",
            itens,
            total: Number(pedidoOnline.total),
            created_at: pedidoOnline.created_at,
            origem: "LOJA ONLINE",
          };

          setAlerts((prev) => [pedido, ...prev].slice(0, 20));
          setShowPanel(true);

          if (somRef.current) {
            beep();
          }

          qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });

          onNotify?.(pedido);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, onNotify]);

  const unreadCount = alerts.length;

  return (
    <>
      {/* Botão da campainha */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary transition"
        title="Alertas de pedidos"
      >
        <Bell className={`h-5 w-5 ${unreadCount > 0 ? "animate-bounce text-primary" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span className="hidden sm:inline">Pedidos</span>
      </button>

      {/* Painel de alertas */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm" onClick={() => setShowPanel(false)}>
          <div
            className="w-full max-w-md h-full overflow-y-auto border-l bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Pedidos Recentes
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAlerts([]);
                  setShowPanel(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {alerts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bell className="mx-auto h-12 w-12 opacity-30" />
                <p className="mt-3">Nenhum pedido novo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((pedido) => {
                  const origemBadge = pedido.origem === "LOJA ONLINE"
                    ? { label: "Online", className: "bg-blue-100 text-blue-700" }
                    : pedido.origem === "DELIVERY"
                    ? { label: "Delivery", className: "bg-green-100 text-green-700" }
                    : { label: "PDV", className: "bg-orange-100 text-orange-700" };

                  return (
                  <div
                    key={`${pedido.numero}-${pedido.created_at}`}
                    className="rounded-xl border border-primary/30 bg-muted/30 p-4 transition hover:border-primary"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-semibold">
                          {pedido.numero ? `Pedido #${pedido.numero}` : "Pedido Online"}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${origemBadge.className}`}>
                          {origemBadge.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(pedido.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="mb-2 text-sm">
                      <span className="text-muted-foreground">Cliente:</span>{" "}
                      <span className="font-medium">{pedido.cliente}</span>
                    </div>

                    <div className="mb-3 rounded-lg border bg-background p-2">
                      <ul className="space-y-1 text-sm">
                        {pedido.itens && pedido.itens.length > 0 ? (
                          pedido.itens.map((item, i) => (
                            <li key={i} className="flex justify-between">
                              <span>
                                {item.quantidade}× {item.nome}
                              </span>
                              <span className="text-muted-foreground">
                                {brl(Number(item.preco_unitario) * item.quantidade)}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground text-xs">Nenhum item</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="font-display text-lg font-bold text-primary">
                        {brl(pedido.total)}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
