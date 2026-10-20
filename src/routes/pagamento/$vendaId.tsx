import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Link2, RefreshCw, SearchX, TriangleAlert, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlineOrderNFCE } from "@/components/OnlineOrderNFCE";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderSummary } from "@/components/OrderSummary";
import { OrderTracker } from "@/components/OrderTracker";
import { PixPaymentSection } from "@/components/PixPaymentSection";
import { rememberOrder } from "@/hooks/useMyOrders";
import { buscarPedidoOnline } from "@/lib/online-order-api";
import { errorMessage, isFinalStatus, orderCode } from "@/lib/online-order";

// Tempo limite para pagamento em segundos (15 minutos)
const PAYMENT_TIMEOUT_SECONDS = 15 * 60;

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getRemainingSeconds(pedido: { created_at: string; expires_at?: string | null }): number {
  const expiresAt = pedido.expires_at ? new Date(pedido.expires_at).getTime() : new Date(pedido.created_at).getTime() + PAYMENT_TIMEOUT_SECONDS * 1000;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

function PaymentCountdown({ pedido, onExpired }: { pedido: { created_at: string; expires_at?: string | null }; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(getRemainingSeconds(pedido));

  useEffect(() => {
    const interval = setInterval(() => {
      const newRemaining = getRemainingSeconds(pedido);
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pedido, onExpired]);

  const isUrgent = remaining < 120 && remaining > 0; // Menos de 2 minutos
  const isExpired = remaining <= 0;

  if (isExpired) {
    return (
      <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-3 font-display text-xl font-bold text-destructive">Tempo de pagamento expirado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O tempo para pagamento deste pedido acabou. Faça um novo pedido para continuar.
        </p>
        <Button className="mt-4" asChild>
          <Link to="/loja">
            <ArrowLeft /> Fazer novo pedido
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${isUrgent ? "border-orange-300 bg-orange-50" : "border bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className={`h-5 w-5 ${isUrgent ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
          <div>
            <p className="text-sm font-medium">
              {isUrgent ? "Pague agora! Tempo acabando..." : "Tempo restante para pagamento"}
            </p>
            <p className={`text-2xl font-mono font-bold ${isUrgent ? "text-orange-600" : "text-primary"}`}>
              {formatTime(remaining)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Após o tempo</p>
          <p className="text-xs text-muted-foreground">expirar, o pedido</p>
          <p className="text-xs text-muted-foreground">será cancelado</p>
        </div>
      </div>
      {isUrgent && (
        <div className="mt-3">
          <div className="h-2 rounded-full bg-orange-200">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-1000"
              style={{ width: `${Math.min(100, (remaining / 120) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/pagamento/$vendaId")({
  head: () => ({
    meta: [
      { title: "Acompanhar pedido — PizzaStockAI" },
      { name: "description", content: "Pague com PIX e acompanhe seu pedido em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PagamentoPage,
});

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-hearth">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/loja">
              <ArrowLeft /> Loja
            </Link>
          </Button>
          <span className="font-display text-lg font-bold">PizzaStockAI</span>
          <span className="w-16" aria-hidden="true" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">{children}</main>
    </div>
  );
}

function StateCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof SearchX;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-8 text-center">
      <Icon className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

function PagamentoPage() {
  const { vendaId: token } = Route.useParams();
  const [showNFCE, setShowNFCE] = useState(false);
  const [pedidoExpirado, setPedidoExpirado] = useState(false);

  const pedidoQ = useQuery({
    queryKey: ["pedido-online", token],
    queryFn: () => buscarPedidoOnline(token),
    refetchInterval: (query) => {
      const atual = query.state.data;
      return atual && isFinalStatus(atual.status) ? false : 8000;
    },
    retry: 2,
  });
  const pedido = pedidoQ.data;
  const encontrado = !!pedido;

  useEffect(() => {
    if (encontrado) rememberOrder(token);
  }, [encontrado, token]);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link de acompanhamento copiado");
    } catch {
      toast.error("Não foi possível copiar. Copie o endereço da barra do navegador.");
    }
  }

  function handleExpired() {
    if (!pedidoExpirado) {
      setPedidoExpirado(true);
      toast.error("O tempo de pagamento expirou. Faça um novo pedido.");
    }
  }

  if (pedidoQ.isPending) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24" role="status">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando seu pedido…</p>
        </div>
      </PageShell>
    );
  }

  if (pedidoQ.isError && !pedido) {
    return (
      <PageShell>
        <StateCard
          icon={TriangleAlert}
          title="Não conseguimos carregar seu pedido"
          description={errorMessage(pedidoQ.error, "Verifique sua conexão e tente novamente.")}
        >
          <Button onClick={() => pedidoQ.refetch()} disabled={pedidoQ.isFetching}>
            <RefreshCw className={pedidoQ.isFetching ? "animate-spin" : undefined} /> Tentar novamente
          </Button>
          <Button variant="outline" asChild>
            <Link to="/loja">Voltar para a loja</Link>
          </Button>
        </StateCard>
      </PageShell>
    );
  }

  if (!pedido) {
    return (
      <PageShell>
        <StateCard
          icon={SearchX}
          title="Pedido não encontrado"
          description="Confira se o link de acompanhamento está completo. Se o problema continuar, fale com a pizzaria."
        >
          <Button asChild>
            <Link to="/loja">
              <ArrowLeft /> Voltar para a loja
            </Link>
          </Button>
        </StateCard>
      </PageShell>
    );
  }

  const criadoEm = new Date(pedido.created_at);

  return (
    <PageShell>
      <section aria-labelledby="pedido-title" className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Acompanhe seu pedido</p>
            <h1 id="pedido-title" className="font-display text-2xl font-bold">
              Pedido #{orderCode(pedido.id)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Feito em {criadoEm.toLocaleDateString("pt-BR")} às{" "}
              {criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <OrderStatusBadge status={pedido.status} className="text-sm" />
        </div>

        <OrderTracker status={pedido.status} />

        {!isFinalStatus(pedido.status) && (
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {pedidoQ.isError ? "Sem conexão — tentando atualizar…" : "Atualizando automaticamente"}
          </p>
        )}
      </section>

      {/* Timer de pagamento - mostra apenas se aguardando pagamento */}
      {pedido.status === "aguardando_pagamento" && !pedidoExpirado && (
        <PaymentCountdown pedido={pedido} onExpired={handleExpired} />
      )}
      {pedidoExpirado && (
        <PaymentCountdown pedido={pedido} onExpired={handleExpired} />
      )}

      {/* Seção de pagamento - esconde se expirado */}
      {!pedidoExpirado && pedido.status === "aguardando_pagamento" && (
        <PixPaymentSection pedido={pedido} />
      )}

      <OrderSummary pedido={pedido} />

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="lg" onClick={copiarLink}>
          <Link2 /> Copiar link de acompanhamento
        </Button>
        <Button variant="outline" size="lg" onClick={() => setShowNFCE(true)}>
          <FileText /> Ver comprovante
        </Button>
      </div>
      <Button size="lg" className="w-full" asChild>
        <Link to="/loja">
          <ArrowLeft /> Voltar para a loja
        </Link>
      </Button>

      {showNFCE && (
        <OnlineOrderNFCE
          pedido={pedido}
          onClose={() => setShowNFCE(false)}
          onPrint={() => toast.success("Comprovante enviado para impressão!")}
        />
      )}
    </PageShell>
  );
}
