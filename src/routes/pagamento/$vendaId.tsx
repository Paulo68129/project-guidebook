import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, Venda } from "@/lib/data";
import { generatePixPayload, getPixConfig, maskPixChave, maskTelefone } from "@/lib/pix";
import QRCode from "qrcode";
import { ArrowLeft, MapPin, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixPaymentModal } from "@/components/PixPaymentModal";
import { toast } from "sonner";

// Taxas fiscais padrão (percentuais)
const TAXAS_FISCAIS = {
  icms: 18,
  pis: 1.65,
  cofins: 7.6,
  iss: 5,
};

export const Route = createFileRoute("/pagamento/$vendaId")({
  head: () => ({
    meta: [
      { title: "Pagamento — PizzaStockAI" },
      { name: "description", content: "Escaneie o QR Code PIX para pagar seu pedido." },
    ],
  }),
  component: PagamentoPage,
});

function PagamentoPage() {
  const { vendaId } = Route.useParams();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [pixPayload, setPixPayload] = useState<string>("");
  const pixConfig = getPixConfig();

  // Buscar dados da venda
  const { data: venda, isLoading, error } = useQuery({
    queryKey: ["venda", vendaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, venda_itens(*)")
        .eq("id", vendaId)
        .single();
      if (error) throw error;
      return data as Venda;
    },
  });

  // Gerar QR Code PIX quando a venda for carregada
  useEffect(() => {
    if (venda) {
      const total = Number(venda.total);
      if (total > 0) {
        const payload = generatePixPayload(total);
        setPixPayload(payload);
        QRCode.toDataURL(payload, { width: 256, margin: 2 })
          .then(setQrCodeUrl)
          .catch(() => setQrCodeUrl(""));
      }
    }
  }, [venda]);

  // Handler quando o timer expira
  const handlePixExpire = () => {
    toast.warning("O tempo de pagamento expirou. Solicite um novo QR Code.");
  };

  // Calcular taxas fiscais
  const subtotal = venda ? Number(venda.subtotal) : 0;
  const icmsValue = subtotal * (TAXAS_FISCAIS.icms / 100);
  const pisValue = subtotal * (TAXAS_FISCAIS.pis / 100);
  const cofinsValue = subtotal * (TAXAS_FISCAIS.cofins / 100);
  const issValue = subtotal * (TAXAS_FISCAIS.iss / 100);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !venda) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido não encontrado</h2>
          <p className="text-gray-600 mb-6">Não conseguimos encontrar o pedido solicitado.</p>
          <Button onClick={() => window.location.href = "/loja"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Loja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => window.location.href = "/loja"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="font-display text-lg font-bold">
            PizzaStockAI
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Status do Pedido */}
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pedido #{venda.numero} Confirmado!</h1>
              <p className="text-sm text-gray-600">Escaneie o QR Code abaixo para pagar via PIX</p>
            </div>
          </div>
        </div>

        {/* QR Code PIX com Copia e Cola + Timer */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              Pagamento via PIX
            </div>
          </div>

          {pixPayload && qrCodeUrl && venda && (
            <PixPaymentModal
              pixPayload={pixPayload}
              qrCodeUrl={qrCodeUrl}
              valor={Number(venda.total)}
              beneficiario={pixConfig.nome}
              onExpire={handlePixExpire}
            />
          )}
        </div>

        {/* Detalhes do Pedido */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-bold text-gray-900">
            Detalhes do Pedido
          </h2>

          {/* Informações do cliente (dados mascarados) */}
          <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-4">
            {venda.cliente && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium text-gray-900">{venda.cliente}</span>
              </div>
            )}
            {venda.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 text-gray-500">📞</span>
                <span className="text-gray-600">Telefone:</span>
                <span className="font-medium text-gray-900">{maskTelefone(venda.telefone)}</span>
              </div>
            )}
            {venda.endereco && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Endereço:</span>
                <span className="font-medium text-gray-900">{venda.endereco}</span>
              </div>
            )}
          </div>

          {/* Itens do pedido */}
          <div className="mb-4 space-y-3">
            {venda.venda_itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{item.nome}</p>
                  <p className="text-sm text-gray-500">
                    {item.quantidade}x {brl(Number(item.preco_unitario))}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  {brl(Number(item.preco_unitario) * item.quantidade)}
                </span>
              </div>
            ))}
          </div>

          {/* Totais */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-gray-900">{brl(Number(venda.subtotal))}</span>
            </div>
            {Number(venda.desconto) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto:</span>
                <span>-{brl(Number(venda.desconto))}</span>
              </div>
            )}
            {Number(venda.taxa_entrega) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxa de entrega:</span>
                <span className="text-gray-900">{brl(Number(venda.taxa_entrega))}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span className="text-gray-900">Total:</span>
              <span className="text-primary">{brl(Number(venda.total))}</span>
            </div>
          </div>
        </div>

        {/* Taxas Fiscais */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-bold text-gray-900">
            Taxas Fiscais
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">ICMS ({TAXAS_FISCAIS.icms}%):</span>
              <span className="text-gray-900">{brl(icmsValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PIS ({TAXAS_FISCAIS.pis}%):</span>
              <span className="text-gray-900">{brl(pisValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">COFINS ({TAXAS_FISCAIS.cofins}%):</span>
              <span className="text-gray-900">{brl(cofinsValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ISS ({TAXAS_FISCAIS.iss}%):</span>
              <span className="text-gray-900">{brl(issValue)}</span>
            </div>
          </div>
        </div>

        {/* Botão para voltar */}
        <Button className="w-full" size="lg" onClick={() => window.location.href = "/loja"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Loja
        </Button>
      </main>
    </div>
  );
}
