import { useEffect, useState, type FormEvent } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, History, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderTracker } from "@/components/OrderTracker";
import { forgetOrder, useMyOrders } from "@/hooks/useMyOrders";
import { brl } from "@/lib/data";
import { buscarPedidoOnline } from "@/lib/online-order-api";
import { extractOrderToken, isFinalStatus, orderCode, type OnlineOrder } from "@/lib/online-order";

const MAX_TRACKED = 5;

export type TrackedOrder = {
  token: string;
  pedido: OnlineOrder | null | undefined;
  isLoading: boolean;
  isError: boolean;
};

function refetchWhileActive(pedido: OnlineOrder | null | undefined) {
  return pedido && isFinalStatus(pedido.status) ? false : 10_000;
}

/** Pedidos feitos neste aparelho, com status ao vivo (atualiza a cada 10s enquanto não finalizar). */
export function useTrackedOrders(): TrackedOrder[] {
  const saved = useMyOrders().slice(0, MAX_TRACKED);
  const results = useQueries({
    queries: saved.map(({ token }) => ({
      queryKey: ["pedido-online", token],
      queryFn: () => buscarPedidoOnline(token),
      refetchInterval: (query: { state: { data: OnlineOrder | null | undefined } }) =>
        refetchWhileActive(query.state.data),
      retry: 1,
    })),
  });

  const tracked = saved.map(({ token }, i) => {
    const r = results[i];
    return { token, pedido: r?.data, isLoading: r?.isPending ?? true, isError: r?.isError ?? false };
  });

  const missing = tracked
    .filter((t) => t.pedido === null)
    .map((t) => t.token)
    .join(",");
  useEffect(() => {
    if (missing) missing.split(",").forEach(forgetOrder);
  }, [missing]);

  return tracked;
}

export function countActive(orders: TrackedOrder[]) {
  return orders.filter((o) => o.pedido && !isFinalStatus(o.pedido.status)).length;
}

export function MyOrdersBanner({ orders, onOpenAll }: { orders: TrackedOrder[]; onOpenAll: () => void }) {
  const ativo = orders.find((o) => o.pedido && !isFinalStatus(o.pedido.status));
  if (!ativo?.pedido) return null;
  const { pedido, token } = ativo;
  const aguardando = pedido.status === "aguardando_pagamento";

  return (
    <section
      aria-labelledby="acompanhe-title"
      className="mb-8 rounded-xl border border-primary/40 bg-card p-4 shadow-lg shadow-primary/5 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Acompanhe seu pedido</p>
          <h2 id="acompanhe-title" className="font-display text-xl font-bold">
            Pedido #{orderCode(pedido.id)} · {brl(pedido.total)}
          </h2>
        </div>
        <OrderStatusBadge status={pedido.status} />
      </div>
      <OrderTracker status={pedido.status} variant="compact" className="mt-4" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to="/pagamento/$vendaId" params={{ vendaId: token }}>
            {aguardando ? "Pagar com PIX" : "Ver acompanhamento"} <ChevronRight />
          </Link>
        </Button>
        {orders.length > 1 && (
          <Button size="sm" variant="outline" onClick={onOpenAll}>
            <History /> Todos os pedidos ({orders.length})
          </Button>
        )}
      </div>
    </section>
  );
}

function TrackForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = extractOrderToken(value);
    if (!token) {
      setError("Cole o link de acompanhamento completo que você recebeu.");
      return;
    }
    setError(null);
    onDone();
    void navigate({ to: "/pagamento/$vendaId", params: { vendaId: token } });
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border bg-muted/30 p-3" noValidate>
      <label htmlFor="rastrear-link" className="text-sm font-semibold">
        Tem um link de acompanhamento?
      </label>
      <div className="flex gap-2">
        <Input
          id="rastrear-link"
          placeholder="Cole o link ou código do pedido"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "rastrear-erro" : undefined}
        />
        <Button type="submit" variant="secondary">
          <Search /> <span className="sr-only sm:not-sr-only">Rastrear</span>
        </Button>
      </div>
      {error && (
        <p id="rastrear-erro" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export function MyOrdersSheet({
  orders,
  open,
  onOpenChange,
}: {
  orders: TrackedOrder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Meus pedidos</SheetTitle>
          <SheetDescription>Acompanhe em tempo real os pedidos feitos neste aparelho.</SheetDescription>
        </SheetHeader>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido feito neste aparelho ainda.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map(({ token, pedido, isLoading, isError }) => (
              <li key={token} className="rounded-xl border bg-card p-4">
                {isLoading && !pedido ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ) : pedido ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">Pedido #{orderCode(pedido.id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(pedido.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {brl(pedido.total)}
                        </p>
                      </div>
                      <OrderStatusBadge status={pedido.status} />
                    </div>
                    <OrderTracker status={pedido.status} variant="compact" className="mt-3" />
                    <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
                      <Link to="/pagamento/$vendaId" params={{ vendaId: token }} onClick={() => onOpenChange(false)}>
                        {pedido.status === "aguardando_pagamento" ? "Pagar com PIX" : "Ver detalhes"} <ChevronRight />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isError ? "Não foi possível atualizar este pedido agora." : "Pedido indisponível."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <TrackForm onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
