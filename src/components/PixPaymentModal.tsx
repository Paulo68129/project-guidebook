import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Copy, LoaderCircle, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/data";
import { cn } from "@/lib/utils";

const DURATION_MS = 5 * 60 * 1000;

interface PixPaymentModalProps {
  pixPayload: string;
  qrCodeUrl: string | null;
  qrLoading?: boolean;
  valor: number;
  beneficiario?: string;
  onExpire?: () => void;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textArea);
    return ok;
  }
}

export function PixPaymentModal({
  pixPayload,
  qrCodeUrl,
  qrLoading = false,
  valor,
  beneficiario = "PizzaStockAI",
  onExpire,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + DURATION_MS);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expired = remaining === 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  const handleCopy = useCallback(async () => {
    if (await copyText(pixPayload)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  }, [pixPayload]);

  function renew() {
    const t = Date.now();
    setExpiresAt(t + DURATION_MS);
    setNow(t);
  }

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timerTone = remaining > 180 ? "text-success" : remaining > 60 ? "text-warning" : "text-destructive";
  const timerBox =
    remaining > 180
      ? "border-success/30 bg-success/10"
      : remaining > 60
        ? "border-warning/30 bg-warning/10"
        : "border-destructive/30 bg-destructive/10";

  return (
    <div className="space-y-5">
      <div className="relative mx-auto w-fit">
        <div className="rounded-2xl bg-white p-3 shadow-lg">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt={`QR Code PIX no valor de ${brl(valor)}`}
              width={224}
              height={224}
              className={cn("h-56 w-56 transition", expired && "opacity-15 blur-[2px]")}
            />
          ) : (
            <div className="grid h-56 w-56 place-items-center p-4 text-center text-sm text-neutral-600">
              {qrLoading ? (
                <LoaderCircle className="h-8 w-8 animate-spin text-neutral-500" aria-label="Gerando QR Code" />
              ) : (
                "Não foi possível desenhar o QR Code. Use o código copia e cola abaixo."
              )}
            </div>
          )}
        </div>
        {expired && (
          <div className="absolute inset-0 grid place-items-center">
            <Button onClick={renew} className="shadow-lg">
              <RefreshCw /> Gerar novo QR Code
            </Button>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="font-display text-3xl font-bold text-foreground">{brl(valor)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Beneficiário: <span className="font-semibold text-foreground">{beneficiario}</span>
        </p>
      </div>

      <div className={cn("rounded-xl border p-3 text-center transition-colors", timerBox)} aria-live="polite">
        <div className="flex items-center justify-center gap-2">
          <Clock className={cn("h-5 w-5", timerTone)} aria-hidden="true" />
          <span className={cn("font-mono text-2xl font-bold tabular-nums", timerTone)}>
            {minutes}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
        <p className={cn("mt-1 text-xs", timerTone)}>
          {expired ? "QR Code expirado — gere um novo para pagar" : "Escaneie o QR Code ou copie o código abaixo"}
        </p>
      </div>

      <div className="space-y-2">
        <Button
          onClick={expired ? renew : handleCopy}
          size="lg"
          className="w-full bg-success text-base font-semibold text-background hover:bg-success/90"
        >
          {expired ? (
            <>
              <RefreshCw /> Gerar novo código
            </>
          ) : copied ? (
            <>
              <Check /> Código copiado!
            </>
          ) : (
            <>
              <Copy /> Copiar código PIX
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPayload((v) => !v)}
          className="w-full text-xs"
          aria-expanded={showPayload}
        >
          <QrCode /> {showPayload ? "Ocultar" : "Mostrar"} código PIX completo
        </Button>

        {showPayload && (
          <p className="select-all break-all rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {pixPayload}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="mb-2 font-semibold text-foreground">Como pagar</p>
        <ol className="space-y-1.5 text-xs text-muted-foreground">
          {[
            "Abra o app do seu banco e entre na área Pix.",
            "Escolha “Pix Copia e Cola” ou “Ler QR Code”.",
            "Confirme o valor e pague. Esta tela atualiza sozinha quando a loja confirmar.",
          ].map((texto, i) => (
            <li key={texto} className="flex items-start gap-2">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <span>{texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
