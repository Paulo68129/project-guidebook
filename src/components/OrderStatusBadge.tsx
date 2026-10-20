import { BadgeCheck, Bike, ChefHat, CircleX, Clock3, House, Timer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OrderStatus } from "@/lib/online-order";

export const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  aguardando_pagamento: Clock3,
  pago: BadgeCheck,
  preparo: ChefHat,
  saiu: Bike,
  entregue: House,
  cancelado: CircleX,
  expirado: Timer,
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  aguardando_pagamento: "border-warning/30 bg-warning/15 text-warning",
  pago: "border-success/30 bg-success/15 text-success",
  preparo: "border-primary/30 bg-primary/15 text-primary",
  saiu: "border-primary/30 bg-primary/15 text-primary",
  entregue: "border-success/20 bg-success/10 text-success",
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
