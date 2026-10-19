import { useState, useEffect } from "react";
import { brl } from "@/lib/data";
import { generatePixPayload, getPixConfig, maskPixChave, maskTelefone } from "@/lib/pix";
import QRCode from "qrcode";
import type { OnlineOrder } from "@/lib/online-order";

interface OnlineOrderNFCEProps {
  pedido: OnlineOrder;
  onPrint?: () => void;
  onClose?: () => void;
}

// Taxas fiscais padrão (percentuais)
const TAXAS_FISCAIS = {
  icms: 18, // ICMS 18%
  pis: 1.65, // PIS 1.65%
  cofins: 7.6, // COFINS 7.6%
  iss: 5, // ISS 5%
};

export function OnlineOrderNFCE({ pedido, onPrint, onClose }: OnlineOrderNFCEProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const pixConfig = getPixConfig();

  // Gerar QR Code PIX quando o componente montar
  useEffect(() => {
    const total = Number(pedido.total);
    if (total > 0) {
      const pixPayload = generatePixPayload(total);
      QRCode.toDataURL(pixPayload, { width: 200, margin: 1 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(""));
    }
  }, [pedido.total]);

  // Calcular taxas fiscais
  const subtotal = Number(pedido.subtotal);
  const icmsValue = subtotal * (TAXAS_FISCAIS.icms / 100);
  const pisValue = subtotal * (TAXAS_FISCAIS.pis / 100);
  const cofinsValue = subtotal * (TAXAS_FISCAIS.cofins / 100);
  const issValue = subtotal * (TAXAS_FISCAIS.iss / 100);

  const handlePrint = () => {
    window.print();
    onPrint?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="text-center border-b-2 border-black pb-3 mb-3">
          <h2 className="text-xl font-bold">PizzaStockAI</h2>
          <p className="text-xs text-gray-600">CUPOM NÃO FISCAL</p>
          <p className="text-xs text-gray-600">Pedido Online #{pedido.id.slice(0, 8)}</p>
        </div>

        {/* Dados do pedido */}
        <div className="text-xs space-y-1 mb-3">
          <p>Data: {new Date(pedido.created_at).toLocaleDateString("pt-BR")}</p>
          <p>Hora: {new Date(pedido.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          <p>Tipo: Delivery</p>
          {pedido.cliente && <p>Cliente: {pedido.cliente}</p>}
          {pedido.telefone && <p>Telefone: {maskTelefone(pedido.telefone)}</p>}
          {pedido.endereco && <p>Endereço: {pedido.endereco}</p>}
        </div>

        {/* Itens */}
        <div className="border-t border-b border-black py-2 mb-3">
          <p className="text-xs font-bold mb-2">ITENS DO PEDIDO</p>
          <div className="space-y-1">
            {pedido.itens && pedido.itens.length > 0 ? (
              pedido.itens.map((item, idx) => (
                <div key={idx} className="text-xs flex justify-between">
                  <span>
                    {item.quantidade}x {item.nome}
                  </span>
                  <span>{brl(Number(item.preco_unitario) * item.quantidade)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center">Nenhum item no pedido</p>
            )}
          </div>
        </div>

        {/* Totais */}
        <div className="text-xs space-y-1 mb-3">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{brl(Number(pedido.subtotal))}</span>
          </div>
          {Number(pedido.desconto) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto:</span>
              <span>-{brl(Number(pedido.desconto))}</span>
            </div>
          )}
          {Number(pedido.taxa_entrega) > 0 && (
            <div className="flex justify-between">
              <span>Taxa de entrega:</span>
              <span>{brl(Number(pedido.taxa_entrega))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-black pt-2 mt-2">
            <span>TOTAL:</span>
            <span>{brl(Number(pedido.total))}</span>
          </div>
        </div>

        {/* Taxas Fiscais */}
        <div className="text-xs space-y-1 mb-3 border-t border-b border-black py-2">
          <p className="font-bold mb-1">TAXAS FISCAIS</p>
          <div className="flex justify-between">
            <span>ICMS ({TAXAS_FISCAIS.icms}%):</span>
            <span>{brl(icmsValue)}</span>
          </div>
          <div className="flex justify-between">
            <span>PIS ({TAXAS_FISCAIS.pis}%):</span>
            <span>{brl(pisValue)}</span>
          </div>
          <div className="flex justify-between">
            <span>COFINS ({TAXAS_FISCAIS.cofins}%):</span>
            <span>{brl(cofinsValue)}</span>
          </div>
          <div className="flex justify-between">
            <span>ISS ({TAXAS_FISCAIS.iss}%):</span>
            <span>{brl(issValue)}</span>
          </div>
        </div>

        {/* PIX QR Code */}
        <div className="text-center border-t border-b border-black py-3 mb-3">
          <p className="text-xs font-bold mb-2">PAGAMENTO VIA PIX</p>
          {qrCodeUrl && (
            <div className="flex justify-center mb-2">
              <img src={qrCodeUrl} alt="QR Code PIX" className="w-40 h-40" />
            </div>
          )}
          <p className="text-xs text-gray-600">Beneficiário: {pixConfig.nome}</p>
          <p className="text-xs text-gray-600">Chave PIX: {maskPixChave(pixConfig.chave)}</p>
          <p className="text-xs text-gray-500 mt-1">📋 Escaneie o QR Code para pagar</p>
          <p className="text-xs font-bold mt-1">Valor: {brl(Number(pedido.total))}</p>
          <p className="text-xs text-green-600 font-medium mt-1">Válido para pagamento em 5 minutos</p>
        </div>

        {/* Status */}
        <div className="text-center text-xs text-gray-600 border-t border-black pt-3 mb-4">
          <p>Status: {pedido.status}</p>
          <p className="mt-1">Obrigado pela preferência!</p>
        </div>

        {/* Botões de ação */}
        <div className="print:hidden flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 transition"
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-100 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
