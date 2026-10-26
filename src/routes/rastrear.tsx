import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { consultarPedidoOnline } from "@/lib/loja-online.functions";
import { brl } from "@/lib/data";
import { expirarPedidoOnline } from "@/lib/online-order-api";
import { ArrowLeft, Clock, CheckCircle, ChefHat, Truck, Package, PackageCheck, Search, Loader2, MapPin, User, FileText, Printer, AlertTriangle, XOctagon, Star, CreditCard, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { OnlineOrderNFCE } from "@/components/OnlineOrderNFCE";
import { supabase } from "@/integrations/supabase/client";

// Tempo limite para pagamento em minutos (5 minutos)
const PAYMENT_TIMEOUT_MINUTES = 5;

export const Route = createFileRoute("/rastrear")({
  head: () => ({
    meta: [
      { title: "Rastrear Pedido — PizzaStockAI" },
      { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
    ],
  }),
  component: RastrearPage,
});

interface PedidoOnline {
  id: string;
  cliente: string;
  telefone: string;
  endereco: string;
  itens: Array<{ nome: string; produto_id: string; quantidade: number; preco_unitario: number }>;
  subtotal: number;
  desconto: number;
  taxa_entrega: number;
  total: number;
  cupom?: string;
  status: string;
  status_pagamento?: string;
  status_delivery?: string;
  motivo_recusa?: string;
  created_at: string;
  updated_at?: string;
}

// Mensagens de notificação para cada status
const statusMessages: Record<string, { title: string; message: string }> = {
  pendente: {
    title: "📦 Pedido Recebido",
    message: "Seu pedido foi recebido e está aguardando pagamento.",
  },
  aguardando_pagamento: {
    title: "💳 Aguardando Pagamento",
    message: "Realize o pagamento PIX para confirmar seu pedido.",
  },
  pago: {
    title: "✅ Pagamento Confirmado!",
    message: "Seu pagamento foi confirmado! Aguardando início da preparação.",
  },
  recebido: {
    title: "👨‍🍳 Pedido Aceito",
    message: "Seu pedido foi aceito e já está sendo preparado pela equipe.",
  },
  preparando: {
    title: "🍕 Preparando Pedido",
    message: "Sua equipe está preparando seu pedido com carinho!",
  },
  preparo: {
    title: "🍕 Preparando Pedido",
    message: "Sua equipe está preparando seu pedido com carinho!",
  },
  pronto: {
    title: "📦 Pedido Pronto",
    message: "Seu pedido está pronto e será entregue em breve!",
  },
  em_entrega: {
    title: "🛵 Saiu para Entrega",
    message: "Seu pedido saiu para entrega! Em breve estará com você.",
  },
  saiu: {
    title: "🛵 Saiu para Entrega",
    message: "Seu pedido saiu para entrega! Em breve estará com você.",
  },
  finalizado: {
    title: "✅ Pedido Entregue",
    message: "Seu pedido foi entregue com sucesso! Bom apetite!",
  },
  entregue: {
    title: "✅ Pedido Entregue",
    message: "Seu pedido foi entregue com sucesso! Bom apetite!",
  },
  cancelado: {
    title: "❌ Pedido Cancelado",
    message: "Seu pedido foi cancelado.",
  },
};

// Mapeamento de status para exibição
const statusConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  pendente: {
    label: "Aguardando Pagamento",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  aguardando_pagamento: {
    label: "Aguardando Pagamento",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  pago: {
    label: "Pagamento Confirmado",
    icon: CreditCard,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  recebido: {
    label: "Pedido Recebido",
    icon: CheckCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  preparando: {
    label: "Preparando Pedido",
    icon: ChefHat,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  preparo: {
    label: "Preparando Pedido",
    icon: ChefHat,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  pronto: {
    label: "Pedido Pronto",
    icon: PackageCheck,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
  em_entrega: {
    label: "Saiu para Entrega",
    icon: Truck,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  saiu: {
    label: "Saiu para Entrega",
    icon: Truck,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  finalizado: {
    label: "Entregue",
    icon: Package,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  entregue: {
    label: "Entregue",
    icon: Package,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  cancelado: {
    label: "Cancelado",
    icon: Package,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
};

// Ordem dos status na timeline (7 etapas)
const statusOrder = ["pendente", "pago", "recebido", "preparando", "pronto", "em_entrega", "finalizado"];

// Mapeia status antigos para o novo padrão
function normalizeStatusForDisplay(status: string): string {
  const map: Record<string, string> = {
    "aguardando_pagamento": "pendente",
    "novo": "pendente",
    "preparo": "preparando",
    "saiu": "em_entrega",
    "entregue": "finalizado",
  };
  return map[status] || status;
}

// Verifica se o pedido expirou (mais de 5 minutos pendente)
function isPedidoExpirado(pedido: PedidoOnline): boolean {
  if (pedido.status !== "aguardando_pagamento" && pedido.status !== "pendente") return false;
  const criadoEm = new Date(pedido.created_at).getTime();
  const agora = Date.now();
  return (agora - criadoEm) > PAYMENT_TIMEOUT_MINUTES * 60 * 1000;
}

function RastrearPage() {
  const [searchToken, setSearchToken] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pedido, setPedido] = useState<PedidoOnline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNFCE, setShowNFCE] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);

  // Assinatura Realtime para atualizar status instantaneamente quando o PDV atualizar
  useEffect(() => {
    if (!pedido?.id) return;
    const channel = supabase
      .channel(`rastrear-pedido-${pedido.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos_online",
          filter: `id=eq.${pedido.id}`,
        },
        async (payload) => {
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any).status;
          
          // Se o status mudou, mostra notificação com mensagem personalizada
          if (newStatus !== oldStatus) {
            const msg = statusMessages[newStatus];
            if (msg) {
              toast.success(msg.title, {
                description: msg.message,
                duration: 8000,
                position: "top-center",
              });
            }
            setPreviousStatus(newStatus);
          }
          
          if (searchToken) {
            handleSearch(searchToken);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedido?.id, searchToken]);

  // Se veio com token na URL, busca automaticamente (apenas no cliente)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const urlToken = urlParams.get("token");

  useEffect(() => {
    if (urlToken) {
      setSearchToken(urlToken);
      handleSearch(urlToken);
    }
  }, [urlToken]);

  const handleSearch = async (token: string) => {
    setIsSearching(true);
    setError(null);
    setPedido(null);

    try {
      const data = await (consultarPedidoOnline as any)({ token });
      // Normaliza itens
      let normalizedItens = [];
      if (Array.isArray(data.itens)) {
        normalizedItens = data.itens;
      } else if (typeof data.itens === 'string') {
        try {
          const parsed = JSON.parse(data.itens);
          normalizedItens = Array.isArray(parsed) ? parsed : [];
        } catch {
          normalizedItens = [];
        }
      }
      const pedidoData = {
        ...data,
        itens: normalizedItens,
      } as PedidoOnline;

      // Verifica se o pedido expirou e expira automaticamente
      if (isPedidoExpirado(pedidoData)) {
        await expirarPedidoOnline(token);
        toast.error("O tempo de pagamento deste pedido expirou.");
        // Atualiza o status localmente
        pedidoData.status = "cancelado";
        pedidoData.status_pagamento = "expirado";
      }

      setPedido(pedidoData);
    } catch (e: any) {
      setError(e.message || "Pedido não encontrado");
      toast.error("Pedido não encontrado");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchToken.trim()) {
      toast.error("Digite o código do pedido");
      return;
    }
    handleSearch(searchToken.trim());
  };

  // Polling para atualizar o status
  useEffect(() => {
    if (!pedido) return;

    const interval = setInterval(async () => {
      try {
        const data = await (consultarPedidoOnline as any)({ token: searchToken });
        let normalizedItens = [];
        if (Array.isArray(data.itens)) {
          normalizedItens = data.itens;
        } else if (typeof data.itens === 'string') {
          try {
            const parsed = JSON.parse(data.itens);
            normalizedItens = Array.isArray(parsed) ? parsed : [];
          } catch {
            normalizedItens = [];
          }
        }
        const updatedPedido = {
          ...data,
          itens: normalizedItens,
        } as PedidoOnline;

        // Verifica se o pedido expirou durante o polling
        if (isPedidoExpirado(updatedPedido)) {
          await expirarPedidoOnline(searchToken);
          updatedPedido.status = "cancelado";
          updatedPedido.status_pagamento = "expirado";
          toast.error("O tempo de pagamento deste pedido expirou.");
        }

        // Se o status mudou, mostra notificação com mensagem personalizada
        if (updatedPedido.status !== pedido.status) {
          const msg = statusMessages[updatedPedido.status];
          if (msg) {
            toast.success(msg.title, {
              description: msg.message,
              duration: 8000,
              position: "top-center",
            });
          }
          setPreviousStatus(updatedPedido.status);
        }

        setPedido(updatedPedido);
      } catch {
        // Silently fail on polling
      }
    }, 10000); // A cada 10 segundos

    return () => clearInterval(interval);
  }, [pedido, searchToken]);

  // Calcula o índice do status atual na timeline (usando status normalizado)
  const currentStatusIndex = pedido ? statusOrder.indexOf(normalizeStatusForDisplay(pedido.status)) : -1;

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
        {/* Título */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Rastrear Pedido</h1>
          <p className="text-gray-500 mt-1">Digite o código do seu pedido para acompanhar</p>
        </div>

        {/* Formulário de busca */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Código do pedido"
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...
                </>
              ) : (
                "Buscar"
              )}
            </Button>
          </div>
        </form>

        {/* Erro */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-lg font-bold text-red-700 mb-2">Pedido não encontrado</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-red-500 text-xs mt-2">
              Verifique o código e tente novamente. O código foi enviado por WhatsApp após o pedido.
            </p>
          </div>
        )}

        {/* Detalhes do Pedido */}
        {pedido && !error && (
          <>
            {/* Pedido expirado - mostra mensagem especial */}
            {pedido.status === "cancelado" && pedido.status_pagamento === "expirado" && (
              <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                <h2 className="mt-3 text-lg font-bold text-red-700">Tempo de pagamento expirado</h2>
                <p className="mt-2 text-sm text-red-600">
                  O tempo limite de 5 minutos para pagamento acabou. Este pedido foi cancelado automaticamente.
                </p>
                <p className="mt-1 text-xs text-red-500">
                  Código do pedido: {pedido.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                </p>
                <Button className="mt-4" onClick={() => window.location.href = "/loja"}>
                  Fazer novo pedido
                </Button>
              </div>
            )}

            {/* Pedido recusado - mostra mensagem especial */}
            {pedido.status_delivery === "recusado" && (
              <div className="mb-6 rounded-xl border-2 border-orange-200 bg-orange-50 p-6 text-center">
                <XOctagon className="mx-auto h-12 w-12 text-orange-500" />
                <h2 className="mt-3 text-lg font-bold text-orange-700">Pedido recusado</h2>
                <p className="mt-2 text-sm text-orange-600">
                  {pedido.motivo_recusa || "Infelizmente não foi possível atender seu pedido neste momento."}
                </p>
                <p className="mt-1 text-xs text-orange-500">
                  Código do pedido: {pedido.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                </p>
                <Button className="mt-4" onClick={() => window.location.href = "/loja"}>
                  Fazer novo pedido
                </Button>
              </div>
            )}

            {/* Pedido aceito e confirmado */}
            {pedido.status_delivery === "aceito" && pedido.status !== "cancelado" && (
              <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h2 className="mt-3 text-lg font-bold text-green-700">Pedido confirmado!</h2>
                <p className="mt-2 text-sm text-green-600">
                  Seu pedido foi confirmado e o pagamento foi aprovado. Estamos iniciando a preparação.
                </p>
              </div>
            )}

            {/* Status atual - só mostra se não expirou e não foi recusado */}
            {!(pedido.status === "cancelado" && pedido.status_pagamento === "expirado") && pedido.status_delivery !== "recusado" && (
            <>
            {/* Banner de notificação do status atual */}
            {(() => {
              const msg = statusMessages[pedido.status];
              if (!msg) return null;
              return (
                <div className={`mb-6 rounded-xl border-2 p-6 text-center ${
                  pedido.status === "pago" ? "border-green-300 bg-green-50" :
                  pedido.status === "recebido" ? "border-blue-300 bg-blue-50" :
                  pedido.status === "preparando" || pedido.status === "preparo" ? "border-orange-300 bg-orange-50" :
                  pedido.status === "pronto" ? "border-cyan-300 bg-cyan-50" :
                  pedido.status === "em_entrega" || pedido.status === "saiu" ? "border-purple-300 bg-purple-50" :
                  pedido.status === "finalizado" || pedido.status === "entregue" ? "border-green-300 bg-green-50" :
                  "border-gray-200 bg-gray-50"
                }`}>
                  <Bell className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                  <h2 className="text-lg font-bold text-gray-900">{msg.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{msg.message}</p>
                </div>
              );
            })()}

            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                {(() => {
                  const normalized = normalizeStatusForDisplay(pedido.status);
                  const config = statusConfig[normalized] || statusConfig[pedido.status];
                  const Icon = config?.icon || Clock;
                  return (
                    <>
                    <div className={`flex h-16 w-16 items-center justify-center rounded-full ${config?.bgColor || 'bg-gray-100'}`}>
                      <Icon className={`h-8 w-8 ${config?.color || 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        {config?.label || pedido.status}
                      </h2>
                      <p className="text-sm text-gray-500">
                        Pedido de {pedido.cliente}
                      </p>
                    </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Timeline */}
            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Acompanhamento</h3>
              <div className="space-y-4">
                {statusOrder.map((statusKey, index) => {
                  const config = statusConfig[statusKey];
                  if (!config) return null;
                  const Icon = config.icon;
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;

                  return (
                    <div key={statusKey} className="flex items-center gap-4">
                      {/* Ícone */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isCompleted
                          ? `${config.bgColor} ${config.color}`
                          : "bg-gray-100 text-gray-400"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Texto */}
                      <div className="flex-1">
                        <p className={`font-medium ${
                          isCompleted ? "text-gray-900" : "text-gray-400"
                        }`}>
                          {config.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Em andamento
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      {isCompleted && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {isCurrent ? "Agora" : "Concluído"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Informações do cliente */}
            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Informações</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Cliente:</span>
                  <span className="font-medium text-gray-900">{pedido.cliente}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Endereço:</span>
                  <span className="font-medium text-gray-900">{pedido.endereco}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Pedido realizado:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(pedido.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Itens do pedido */}
            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Itens do Pedido</h3>
              <div className="space-y-3">
                {pedido.itens && pedido.itens.length > 0 ? (
                  pedido.itens.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0">
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
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhum item no pedido</p>
                )}
              </div>

              {/* Totais */}
              <div className="space-y-2 border-t pt-4 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{brl(Number(pedido.subtotal))}</span>
                </div>
                {Number(pedido.desconto) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto:</span>
                    <span>-{brl(Number(pedido.desconto))}</span>
                  </div>
                )}
                {Number(pedido.taxa_entrega) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Taxa de entrega:</span>
                    <span className="text-gray-900">{brl(Number(pedido.taxa_entrega))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-3 text-lg font-bold">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-primary">{brl(Number(pedido.total))}</span>
                </div>
              </div>
            </div>

            {/* Indicador de atualização */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-6">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Atualizando automaticamente a cada 10 segundos</span>
            </div>
            {/* Botão para visualizar Cupom Fiscal / Comprovante */}
            <Button
              className="w-full mb-3 bg-black text-white hover:bg-gray-800 font-semibold"
              size="lg"
              onClick={() => setShowNFCE(true)}
            >
              <Printer className="mr-2 h-4 w-4" /> Ver / Imprimir Cupom do Pedido
            </Button>

            {/* Botão de avaliação - só mostra se pedido foi entregue */}
            {pedido.status === "entregue" && (
              <Button
                className="w-full mb-3 bg-yellow-500 text-white hover:bg-yellow-600 font-semibold"
                size="lg"
                onClick={() => window.location.href = `/avaliacoes?token=${pedido.id}`}
              >
                <Star className="mr-2 h-4 w-4" /> Avaliar este pedido
              </Button>
            )}
            </>
            )}
          </>
        )}

        {/* Botão para voltar */}
        <Button className="w-full" variant="outline" size="lg" onClick={() => window.location.href = "/loja"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Loja
        </Button>
      </main>

      {/* Modal do Cupom Fiscal / NFC-e */}
      {showNFCE && pedido && (
        <OnlineOrderNFCE
          pedido={pedido as any}
          onClose={() => setShowNFCE(false)}
          onPrint={() => toast.success("Cupom fiscal enviado para impressão!")}
        />
      )}
    </div>
  );
}
