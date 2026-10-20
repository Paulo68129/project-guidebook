import { BadgeCheck, Bike, Check, ChefHat, CircleX, Clock3, House, ReceiptText, Timer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OrderStatus } from "@/lib/online-order";

type Step = { label: string; description: string; icon: LucideIcon };

const STEPS: Step[] = [
  { label: "Pedido recebido", description: "A pizzaria recebeu o seu pedido.", icon: ReceiptText },
  { label: "Pagamento confirmado", description: "PIX confirmado pela loja.", icon: BadgeCheck },
  { label: "Em preparo", description: "Seu pedido está sendo preparado.", icon: ChefHat },
  { label: "Saiu para entrega", description: "O entregador está a caminho.", icon: Bike },
  { label: "Entregue", description: "Pedido entregue. Bom apetite!", icon: House },
];

const CURRENT_STEP: Record<Exclude<OrderStatus, "cancelado" | "expirado">, number> = {
  aguardando_pagamento: 1,
  pago: 1,
  preparo: 2,
  saiu: 3,
  entregue: 4,
};

type StepState = "done" | "active" | "waiting" | "upcoming" | "expired";

function stepState(status: Exclude<OrderStatus, "cancelado" | "expirado">, index: number): StepState {
  const current = CURRENT_STEP[status];
  if (index < current) return "done";
  if (index > current) return "upcoming";
  if (status === "aguardando_pagamento") return "waiting";
  if (status === "pago" || status === "entregue") return "done";
  return "active";
}

function CancelledNotice({ className }: { className?: string | undefined }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive",
        className,
      )}
    >
      <CircleX className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Pedido cancelado</p>
        <p className="text-sm text-destructive/80">Se você já pagou, fale com a pizzaria para receber o estorno.</p>
      </div>
    </div>
  );
}

function ExpiredNotice({ className }: { className?: string | undefined }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive",
        className,
      )}
    >
      <Timer className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Tempo de pagamento expirado</p>
        <p className="text-sm text-destructive/80">O tempo para pagamento acabou. Faça um novo pedido para continuar.</p>
      </div>
    </div>
  );
}

export function OrderTracker({
  status,
  variant = "full",
  className,
}: {
  status: OrderStatus;
  variant?: "full" | "compact";
  className?: string;
}) {
  if (status === "cancelado") return <CancelledNotice className={className} />;
  if (status === "expirado") return <ExpiredNotice className={className} />;

  if (variant === "compact") {
    const current = CURRENT_STEP[status];
    const filled = status === "aguardando_pagamento" ? 0 : current;
    const delivered = status === "entregue";
    return (
      <div className={className}>
        <div
          role="progressbar"
          aria-label="Progresso do pedido"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={filled + 1}
          aria-valuetext={STATUS_LABEL[status]}
          className="flex gap-1"
        >
          {STEPS.map((step, index) => (
            <span
              key={step.label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index <= filled ? (delivered ? "bg-success" : "bg-primary") : "bg-muted",
                index === filled + 1 && !delivered && "animate-pulse bg-primary/40",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "aguardando_pagamento"
            ? "Aguardando o pagamento via PIX para iniciar o preparo."
            : (STEPS[current]?.description ?? STATUS_LABEL[status])}
        </p>
      </div>
    );
  }

  return (
    <ol className={cn("space-y-0", className)} aria-label="Etapas do pedido">
      {STEPS.map((step, index) => {
        const state = stepState(status, index);
        const isLast = index === STEPS.length - 1;
        const Icon = state === "done" ? Check : state === "waiting" ? Clock3 : step.icon;
        const label = state === "waiting" ? "Aguardando pagamento" : step.label;
        const description =
          state === "waiting" ? "Pague com o PIX abaixo. A loja confirma e inicia o preparo." : step.description;
        return (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0" aria-current={state === "active" || state === "waiting" ? "step" : undefined}>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded-full",
                  state === "done" ? "bg-success/60" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2",
                state === "done" && "border-success bg-success text-background",
                state === "active" && "border-primary bg-primary/15 text-primary",
                state === "waiting" && "border-warning bg-warning/15 text-warning",
                state === "upcoming" && "border-border bg-muted text-muted-foreground",
              )}
            >
              {(state === "active" || state === "waiting") && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 animate-ping rounded-full opacity-30",
                    state === "active" ? "bg-primary" : "bg-warning",
                  )}
                />
              )}
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1">
              <p
                className={cn(
                  "text-sm font-semibold leading-tight",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {label}
                <span className="sr-only">
                  {state === "done" ? " (concluído)" : state === "upcoming" ? " (próxima etapa)" : " (etapa atual)"}
                </span>
              </p>
              {state !== "upcoming" && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
