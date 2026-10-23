import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import { PixPaymentModal } from "@/components/PixPaymentModal";
import { gerarQrCodePix, generatePixPayload, getPixConfig, pixTxidFromOrderId } from "@/lib/pix";
import { STATUS_LABEL, type OnlineOrder } from "@/lib/online-order";

export function PixPaymentSection({ pedido }: { pedido: OnlineOrder }) {
  const pixConfig = getPixConfig();
  const payload = useMemo(
    () => (pedido.total > 0 ? generatePixPayload(pedido.total, pixTxidFromOrderId(pedido.id)) : ""),
    [pedido.total, pedido.id],
  );
  const qr = useQuery({
    queryKey: ["pix-qr", payload],
    queryFn: () => gerarQrCodePix(payload),
    enabled: payload !== "",
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
  const handleExpire = useCallback(() => toast.warning("O QR Code expirou. Gere um novo para concluir o pagamento."), []);

  if (pedido.status === "cancelado") {
    return (
      <section className="rounded-xl border bg-card p-6 text-center">
        <CircleX className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-bold">Pagamento indisponível</h2>
        <p className="mt-1 text-sm text-muted-foreground">Este pedido foi cancelado pela pizzaria.</p>
      </section>
    );
  }

  if (pedido.status !== "aguardando_pagamento") {
    return (
      <section className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/10 p-5">
        <BadgeCheck className="h-10 w-10 shrink-0 text-success" aria-hidden="true" />
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Pagamento confirmado</h2>
          <p className="text-sm text-muted-foreground">
            Status atual: <span className="font-semibold text-foreground">{STATUS_LABEL[pedido.status]}</span>. Acompanhe
            as etapas acima.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="pix-title" className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 text-center">
        <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          Pagamento via PIX
        </span>
        <h2 id="pix-title" className="mt-2 font-display text-xl font-bold">
          Pague para liberar o preparo
        </h2>
      </div>
      {payload ? (
        <PixPaymentModal
          pixPayload={payload}
          qrCodeUrl={qr.data ?? null}
          qrLoading={qr.isPending}
          valor={pedido.total}
          beneficiario={pixConfig.nome}
          onExpire={handleExpire}
        />
      ) : (
        <p className="text-center text-sm text-destructive">Valor do pedido inválido para gerar o PIX. Fale com a pizzaria.</p>
      )}
    </section>
  );
}
