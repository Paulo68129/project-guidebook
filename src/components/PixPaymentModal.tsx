import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Clock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PixPaymentModalProps {
  pixPayload: string;
  qrCodeUrl: string;
  valor: number;
  beneficiario?: string;
  onExpire?: () => void;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PixPaymentModal({
  pixPayload,
  qrCodeUrl,
  valor,
  beneficiario = "PizzaStockAI",
  onExpire,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(5 * 60); // 5 minutos em segundos
  const [showPayload, setShowPayload] = useState(false);

  // Timer regressivo
  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, onExpire]);

  // Copiar código PIX
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para navegadores sem clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = pixPayload;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [pixPayload]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, "0")}`;

  // Cor do timer muda conforme o tempo restante
  const timerColor = seconds > 180 ? "text-green-600" : seconds > 60 ? "text-yellow-600" : "text-red-600";
  const timerBg = seconds > 180 ? "bg-green-50 border-green-200" : seconds > 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      {/* QR Code */}
      {qrCodeUrl && (
        <div className="flex justify-center">
          <div className="rounded-xl border-2 border-gray-200 p-4 bg-white shadow-sm">
            <img src={qrCodeUrl} alt="QR Code PIX" className="w-56 h-56" />
          </div>
        </div>
      )}

      {/* Valor */}
      <div className="text-center">
        <p className="text-sm text-gray-500">Valor a pagar</p>
        <p className="text-3xl font-bold text-gray-900">{brl(valor)}</p>
      </div>

      {/* Beneficiário */}
      <div className="text-center text-sm text-gray-600">
        Beneficiário: <span className="font-semibold text-gray-900">{beneficiario}</span>
      </div>

      {/* Timer regressivo */}
      <div className={`rounded-xl border ${timerBg} p-4 text-center transition-colors`}>
        <div className="flex items-center justify-center gap-2">
          <Clock className={`h-5 w-5 ${timerColor}`} />
          <span className={`text-2xl font-mono font-bold ${timerColor}`}>{timeStr}</span>
        </div>
        <p className={`text-xs mt-1 ${timerColor}`}>
          {seconds > 0 ? "Escaneie o QR Code ou copie o código abaixo" : "Tempo de pagamento expirado"}
        </p>
      </div>

      {/* Botão Copia e Cola */}
      <div className="space-y-2">
        <Button
          onClick={handleCopy}
          disabled={seconds <= 0}
          className={`w-full text-base font-semibold transition-all ${
            copied
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          size="lg"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-5 w-5" />
              Código Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-5 w-5" />
              Copiar código PIX
            </>
          )}
        </Button>

        {/* Toggle para mostrar/ocultar o BR Code */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPayload(!showPayload)}
          className="w-full text-xs"
        >
          <QrCode className="mr-2 h-3 w-3" />
          {showPayload ? "Ocultar" : "Mostrar"} código PIX completo
        </Button>

        {showPayload && (
          <div className="rounded-lg border bg-gray-50 p-3">
            <p className="text-[10px] text-gray-500 break-all font-mono leading-relaxed select-all">
              {pixPayload}
            </p>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Clique no código para selecionar e copiar
            </p>
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">Como pagar:</p>
        <ol className="space-y-1 text-xs text-left">
          <li className="flex items-start gap-2">
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold">1</span>
            <span>Abra o app do seu banco</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold">2</span>
            <span>Escolha "Pix" → "Copia e Cola" ou escaneie o QR Code</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold">3</span>
            <span>Confirme e aguarde a aprovação</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
