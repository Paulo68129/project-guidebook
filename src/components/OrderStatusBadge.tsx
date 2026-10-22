import { BadgeCheck, Bike, ChefHat, CircleX, Clock3, House, Timer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OrderStatus } from "@/lib/online-order";

export const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  aguardando_pagamento: Clock3,
  pago: BadgeCheck,
  pendente: Clock3,
  recebido: BadgeCheck,
  preparando: ChefHat,
  pronto: BadgeCheck,
  em_entrega: Bike,
  finalizado: House,
  cancelado: CircleX,
  expirado: Timer,
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  aguardando_pagamento: "border-warning/30 bg-warning/15 text-warning",
  pago: "border-success/30 bg-success/15 text-success",
  pendente: "border-muted-foreground/30 bg-muted/15 text-muted-foreground",
  recebido: "border-blue-400/30 bg-blue-500/15 text-blue-600",
  preparando: "border-primary/30 bg-primary/15 text-primary",
  pronto: "border-cyan-400/30 bg-cyan-500/15 text-cyan-600",
  em_entrega: "border-purple-400/30 bg-purple-500/15 text-purple-600",
  finalizado: "border-success/20 bg-success/10 text-success",
  cancelado: "border-destructive/30 bg-destructive/15 text-destructive",
  expirado: "border-destructive/30 bg-destructive/15 text-destructive",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        STATUS_STYLE[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
