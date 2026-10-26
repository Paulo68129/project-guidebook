import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, motoboysQ, vendasQ, type Venda } from "@/lib/data";
import { PageHeader, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NFCEPrint } from "@/components/NFCEPrint";
import { OnlineOrderNFCE } from "@/components/OnlineOrderNFCE";
import type { OnlineOrder } from "@/lib/online-order";
import { useNewOrderSound } from "@/hooks/useNewOrderSound";
import { useOnlineOrdersRealtime } from "@/hooks/useOnlineOrdersRealtime";
import { aceitarPedido, recusarPedido, confirmarPagamento, salvarPedido } from "@/lib/online-order-api";
import { normalizeItems } from "@/lib/online-order";
import { CheckCircle, XOctagon, MapPin, Phone, Clock, FileText, User, ShoppingBag, X, Download, Trash2, AlertTriangle, Save, Search, Globe, Filter, Calendar, Bell, Volume2, VolumeX } from "lucide-react";

// Tempo em ms para considerar um pedido "novo" (exibe badge NOVO PEDIDO)
const NOVO_PEDIDO_MS = 3 * 60 * 1000; // 3 minutos

// Verifica se um pedido é "novo" (recebido nos últimos minutos)
function isNovoPedido(created_at: string): boolean {
  const diff = Date.now() - new Date(created_at).getTime();
  return diff < NOVO_PEDIDO_MS;
}

// Calcula o tempo restante até expiração (5 minutos desde criação)
function getTempoRestanteExpiracao(created_at: string): { minutos: number; segundos: number; expirado: boolean } {
  const criado = new Date(created_at).getTime();
  const expiracao = criado + 5 * 60 * 1000; // 5 minutos
  const restante = expiracao - Date.now();
  
  if (restante <= 0) return { minutos: 0, segundos: 0, expirado: true };
  
  return {
    minutos: Math.floor(restante / 60000),
    segundos: Math.floor((restante % 60000) / 1000),
    expirado: false,
  };
}

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({ meta: [{ title: "Delivery — PizzaStockAI" }, { name: "description", content: "Acompanhe pedidos de delivery do preparo à entrega." }, { property: "og:title", content: "Delivery — PizzaStockAI" }, { property: "og:description", content: "Quadro de pedidos de delivery." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(vendasQ(2)), context.queryClient.ensureQueryData(motoboysQ)]),
  errorComponent: RouteError,
  component: Delivery,
});

// Fluxo unificado de 6 etapas para todos os tipos de pedido
const cols = [
  { s: "pendente", t: "📥 Pedidos Recentes", next: "recebido", btn: "Receber Pedido" },
  { s: "recebido", t: "✅ Pedido Recebido", next: "preparando", btn: "Preparando Pedido" },
  { s: "preparando", t: "👨‍🍳 Preparando", next: "pronto", btn: "Pedido Pronto" },
  { s: "pronto", t: "📦 Pronto", next: "em_entrega", btn: "Saiu p/ Entrega" },
  { s: "em_entrega", t: "🚚 Saiu p/ Entrega", next: "finalizado", btn: "Finalizar" },
  { s: "finalizado", t: "✅ Entregue", next: null, btn: "" },
] as const;

// Mapeia status de pedidos_online para colunas do delivery
const onlineStatusMap: Record<string, string> = {
  "pendente": "pendente",
  "aguardando_pagamento": "pendente",
  "pago": "pendente",
  "novo": "pendente",
  "recebido": "recebido",
  "preparando": "preparando",
  "preparo": "preparando",
  "pronto": "pronto",
  "em_entrega": "em_entrega",
  "saiu": "em_entrega",
  "finalizado": "finalizado",
  "entregue": "finalizado",
  "cancelado": "cancelado",
};

// Verifica se um pedido online está pendente (aguardando aceitação)
function isPedidoPendente(p: any): boolean {
  return p.status_delivery === "pendente" || p.status === "pendente" || p.status === "aguardando_pagamento";
}

function Delivery() {
  const { data: vendas } = useSuspenseQuery(vendasQ(2));
  const { data: motoboys } = useSuspenseQuery(motoboysQ);
  const qc = useQueryClient();
  const pedidosVendas = vendas.filter((v) => v.tipo === "delivery" || v.tipo === "balcao");
  const [nfceVenda, setNfceVenda] = useState<Venda | null>(null);
  const [nfceOnline, setNfceOnline] = useState<OnlineOrder | null>(null);
  
  // Hook de alerta sonoro para novos pedidos
  const { playNewOrderSound, clearPlayedOrders, toggleSound, isSoundEnabled } = useNewOrderSound();
  
  // Estado para controle de atualização em tempo real dos timers de expiração
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTick(t => t + 1); // Força re-render a cada segundo para atualizar timers
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Estado para diálogo de recusa
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectOrderTipo, setRejectOrderTipo] = useState<"venda" | "online" | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Estado para painel lateral de detalhes do pedido
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Estado para diálogo de confirmação de pagamento
  const [paymentConfirmDialogOpen, setPaymentConfirmDialogOpen] = useState(false);
  const [paymentConfirmOrderId, setPaymentConfirmOrderId] = useState<string | null>(null);
  const [paymentConfirmOrderTipo, setPaymentConfirmOrderTipo] = useState<"venda" | "online" | null>(null);

  // Estado para diálogo de exclusão de entregas
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSingleOrderId, setDeleteSingleOrderId] = useState<string | null>(null);
  const [deleteSingleOrderTipo, setDeleteSingleOrderTipo] = useState<"venda" | "online" | null>(null);

  // Estado para busy durante confirmação de pagamento
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Estado para salvar pedido
  const [savingOrder, setSavingOrder] = useState<string | null>(null);

  // Estado para seção de pedidos salvos
  const [savedOrdersOpen, setSavedOrdersOpen] = useState(false);
  const [savedSearchTerm, setSavedSearchTerm] = useState("");
  const [savedStatusFilter, setSavedStatusFilter] = useState<string>("");
  const [savedDateFilter, setSavedDateFilter] = useState<string>("");

  // Abrir painel de detalhes do pedido
  function openOrderDetail(order: any) {
    setSelectedOrder(order);
    setDetailSheetOpen(true);
  }

  // Busca pedidos online com auto-refresh a cada 5 segundos
  const { data: pedidosOnline, isLoading: isLoadingPedidos } = useQuery({
    queryKey: ["pedidos-online-delivery"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_online")
        .select("id, cliente, telefone, endereco, itens, subtotal, desconto, taxa_entrega, total, status, motoboy_id, created_at, cupom, status_delivery, motivo_recusa, aceito_em, recusado_em, observacoes, origem, salvo_em, salvo_por")
        .in("status", ["pendente", "aguardando_pagamento", "pago", "novo", "recebido", "preparando", "preparo", "pronto", "em_entrega", "saiu", "finalizado", "entregue"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      console.log("[Delivery] Pedidos online carregados do Supabase:", data?.length || 0);
      return (data ?? []).map((row: any) => ({
        ...row,
        itens: normalizeItems(row.itens),
      })) as unknown as OnlineOrder[];
    },
  });

  // Recuperação de pedidos pendentes ao montar a tela
  // Garante que nenhum pedido seja perdido mesmo após queda de conexão ou reinício
  useEffect(() => {
    if (!isLoadingPedidos && pedidosOnline && pedidosOnline.length > 0) {
      // Limpa o set de pedidos já tocados para permitir alerta em pedidos pendentes
      clearPlayedOrders();
      
      // Conta pedidos aguardando pagamento ou novos
      const pendentes = pedidosOnline.filter(p => 
        p.status === "aguardando_pagamento" || p.status === "pendente"
      );
      
      if (pendentes.length > 0) {
        console.log(`[Delivery] 🔄 Recuperação: ${pendentes.length} pedido(s) pendente(s) encontrado(s)`);
        
        // Toca o som para cada pedido pendente
        pendentes.forEach(p => {
          playNewOrderSound(p.id);
        });
        
        // Mostra notificação visual
        toast.info(`📦 ${pendentes.length} pedido(s) pendente(s) recuperado(s)`, {
          duration: 8000,
        });
      }
    }
  }, [isLoadingPedidos, pedidosOnline, clearPlayedOrders, playNewOrderSound]);

  // Estado para banner de novo pedido (aparece no topo da tela)
  const [newOrderBanner, setNewOrderBanner] = useState<{ id: string; cliente: string; total: number; time: string } | null>(null);

  // Realtime - detecta novos pedidos instantaneamente
  const { isConnected: realtimeConnected, reconnectAttempts } = useOnlineOrdersRealtime({
    onNewOrder: useCallback((order: any) => {
      console.log("[Delivery] 🔔 Novo pedido detectado via Realtime:", order.id, "cliente:", order.cliente);
      
      // Toca o som de campainha
      playNewOrderSound(order.id);
      
      // Mostra banner de novo pedido no topo da tela
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setNewOrderBanner({
        id: order.id,
        cliente: order.cliente,
        total: Number(order.total),
        time: hora,
      });
      
      // Remove o banner após 10 segundos
      setTimeout(() => {
        setNewOrderBanner(prev => prev?.id === order.id ? null : prev);
      }, 10000);
      
      // Mostra notificação visual destacada
      toast.success(`🔔 Novo pedido de ${order.cliente}!`, {
        description: `Valor: ${brl(Number(order.total))} — Chegou às ${hora}`,
        duration: 10000,
        position: "top-center",
      });
      
      // Invalida o cache para atualizar a lista imediatamente
      qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    }, [playNewOrderSound, qc]),
    
    onOrderStatusChange: useCallback((order: any) => {
      console.log("[Delivery] 🔄 Status do pedido alterado:", order.id, "→", order.status);
      
      // Notificações baseadas no novo status
      const statusMessages: Record<string, { title: string; description: string }> = {
        "pago": {
          title: `💳 Pagamento confirmado!`,
          description: `Pedido de ${order.cliente} - pagamento confirmado e pronto para aceitar.`,
        },
        "recebido": {
          title: `✅ Pedido aceito!`,
          description: `Pedido de ${order.cliente} - enviado para produção.`,
        },
        "preparando": {
          title: `👨‍🍳 Preparando pedido`,
          description: `Pedido de ${order.cliente} - em preparo na cozinha.`,
        },
        "pronto": {
          title: `📦 Pedido pronto!`,
          description: `Pedido de ${order.cliente} - pronto para entrega.`,
        },
        "em_entrega": {
          title: `🚚 Saiu para entrega`,
          description: `Pedido de ${order.cliente} - motoboy a caminho.`,
        },
        "finalizado": {
          title: `✅ Pedido finalizado!`,
          description: `Pedido de ${order.cliente} - entregue com sucesso.`,
        },
      };
      
      const msg = statusMessages[order.status];
      if (msg) {
        toast.success(msg.title, {
          description: msg.description,
          duration: 5000,
        });
      }
      
      qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    }, [qc]),
    
    onOrderExpired: useCallback((order: any) => {
      console.log("[Delivery] ⏰ Pedido expirado:", order.id, "cliente:", order.cliente);
      toast.info(`⏰ Pedido de ${order.cliente} expirado automaticamente.`, {
        duration: 5000,
      });
      qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    }, [qc]),
    
    onOrderDeleted: useCallback((order: any) => {
      console.log("[Delivery] 🗑️ Pedido removido:", order?.id);
      qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    }, [qc]),
  });

  // Limpeza automática de pedidos expirados a cada 30 segundos
  // Usa RPC do banco como principal e fallback frontend como reserva
  useEffect(() => {
    const limparPedidosExpirados = async () => {
      try {
        const result = await (supabase as any).rpc("limpar_pedidos_expirados");
        if (result?.pedidos_expirados > 0) {
          console.log(`[Delivery] 🧹 ${result.pedidos_expirados} pedido(s) expirado(s) via RPC`);
          qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
        }
      } catch (e: any) {
        console.warn("[Delivery] RPC limpar_pedidos_expirados indisponível, usando fallback frontend:", e?.message || e);
        
        // Fallback frontend: verifica pedidos expirados localmente e os marca
        if (pedidosOnline && pedidosOnline.length > 0) {
          const agora = Date.now();
          const cincoMinutos = 5 * 60 * 1000;
          let expiradosCount = 0;

          for (const p of pedidosOnline) {
            const criado = new Date(p.created_at).getTime();
            const tempoDecorrido = agora - criado;
            
            // Verifica se o pedido é pendente e já passou de 5 minutos
            if (isPedidoPendente(p) && tempoDecorrido > cincoMinutos) {
              console.log(`[Delivery] ⏰ Fallback: Pedido ${p.id} de ${p.cliente} expirado (${Math.floor(tempoDecorrido / 60000)}min)`);
              
              // Tenta atualizar o status via update direto
              try {
                await (supabase as any)
                  .from("pedidos_online")
                  .update({
                    status: "cancelado",
                    status_pagamento: "expirado",
                    status_delivery: "expirado",
                    motivo_recusa: "Tempo de pagamento expirado (5 minutos) — expirado via fallback frontend",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", p.id);
                expiradosCount++;
              } catch (updateErr) {
                console.warn(`[Delivery] Erro ao expirar pedido ${p.id}:`, updateErr);
              }
            }
          }

          if (expiradosCount > 0) {
            console.log(`[Delivery] 🧹 ${expiradosCount} pedido(s) expirado(s) via fallback frontend`);
            toast.info(`⏰ ${expiradosCount} pedido(s) expirado(s) automaticamente`, {
              duration: 5000,
            });
            qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
          }
        }
      }
    };
    
    // Executa imediatamente ao montar
    limparPedidosExpirados();
    
    const interval = setInterval(limparPedidosExpirados, 30000);
    return () => clearInterval(interval);
  }, [pedidosOnline, qc]);

  // Combina pedidos de vendas e pedidos online em uma lista unificada por coluna
  function getPedidosByColumn(status: string) {
    const result: Array<{
      id: string;
      tipo: "venda" | "online";
      origem: string;
      cliente: string;
      telefone: string;
      endereco: string;
      total: number;
      subtotal: number;
      desconto: number;
      taxa_entrega: number;
      cupom: string | null;
      observacoes: string | null;
      itens: Array<{ nome: string; descricao?: string | null; quantidade: number; preco_unitario?: number }>;
      motoboy_id?: string | null;
      created_at: string;
      numero?: string;
      status?: string;
      status_delivery?: string | null;
      motivo_recusa?: string | null;
      aceito_em?: string | null;
      recusado_em?: string | null;
      entregue_em?: string | null;
      salvo_em?: string | null;
      salvo_por?: string | null;
    }> = [];

    // Adiciona vendas do tipo delivery e balcão
    if (status !== "cancelado") {
      result.push(
        ...pedidosVendas
          .filter((v) => v.status === status)
          .map((v) => ({
            id: v.id,
            tipo: "venda" as const,
            origem: v.tipo === "delivery" ? "Delivery" : "Balcão",
            cliente: v.cliente || "",
            telefone: v.telefone || "",
            endereco: v.endereco || "",
            total: Number(v.total),
            subtotal: Number(v.subtotal || 0),
            desconto: Number(v.desconto || 0),
            taxa_entrega: Number(v.taxa_entrega || 0),
            cupom: null,
            observacoes: null,
            itens: (v.venda_itens ?? []).map((i: any) => ({ nome: i.nome, quantidade: i.quantidade, preco_unitario: Number(i.preco_unitario || 0) })),
            motoboy_id: v.motoboy_id || null,
            created_at: v.created_at,
            numero: String(v.numero),
            status: v.status,
          }))
      );
    }

    // Adiciona pedidos online
    if (pedidosOnline && status !== "cancelado") {
      const filtered = pedidosOnline.filter((p) => {
        const mapped = onlineStatusMap[p.status];
        if (!mapped) return false;
        return mapped === status;
      });
      result.push(
        ...filtered.map((p) => ({
          id: p.id,
          tipo: "online" as const,
          origem: "Loja Online",
          cliente: p.cliente,
          telefone: p.telefone,
          endereco: p.endereco,
          total: Number(p.total),
          subtotal: Number(p.subtotal),
          desconto: Number(p.desconto),
          taxa_entrega: Number(p.taxa_entrega),
          cupom: p.cupom || null,
          observacoes: (p as any).observacoes || null,
          itens: p.itens?.map((i) => ({ nome: i.nome, descricao: i.descricao, quantidade: i.quantidade, preco_unitario: i.preco_unitario })) || [],
          motoboy_id: (p as OnlineOrder & { motoboy_id?: string | null }).motoboy_id || null,
          created_at: p.created_at,
          status: p.status,
          status_delivery: (p as any).status_delivery || null,
          motivo_recusa: (p as any).motivo_recusa || null,
          aceito_em: (p as any).aceito_em || null,
          recusado_em: (p as any).recusado_em || null,
          entregue_em: (p as any).entregue_em || null,
          salvo_em: (p as any).salvo_em || null,
          salvo_por: (p as any).salvo_por || null,
        }))
      );
    }

    // Ordena por data mais recente
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }

  async function updateVenda(id: string, patch: { status?: string; motoboy_id?: string | null }) {
    const { error } = await supabase.from("vendas").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }

    if (patch.status === "finalizado") {
      const { data: updatedVenda, error: fetchError } = await supabase
        .from("vendas")
        .select("*, venda_itens(*)")
        .eq("id", id)
        .single();

      if (!fetchError && updatedVenda) {
        setNfceVenda(updatedVenda as Venda);
      }
    }

    qc.invalidateQueries({ queryKey: ["vendas"] });
  }

  async function updateOnline(id: string, patch: { status?: string | undefined; motoboy_id?: string | null | undefined }) {
    let newStatus = patch.status;
    // Se o status mudou para "finalizado", mostra a nota fiscal
    if (patch.status === "finalizado") {
      const pedido = pedidosOnline?.find((p) => p.id === id);
      if (pedido) {
        setNfceOnline(pedido);
      }
    }

    // Tenta RPC avancar_status_pedido primeiro (com validação de transição)
    try {
      const rpcResult = await (supabase as any).rpc("avancar_status_pedido", {
        _pedido_id: id,
        _novo_status: newStatus,
        _motivo: patch.motoboy_id ? null : "",
      });

      if (rpcResult.error) {
        // Fallback: atualiza status diretamente no Supabase
        const { error } = await supabase
          .from("pedidos_online")
          .update({ status: newStatus ?? undefined, motoboy_id: patch.motoboy_id ?? undefined } as any)
          .eq("id", id);
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status");
    }

    qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
  }

  async function update(id: string, tipo: "venda" | "online", patch: { status?: string; motoboy_id?: string | null }) {
    if (tipo === "venda") {
      await updateVenda(id, patch);
    } else {
      await updateOnline(id, patch);
    }
  }

  // Aceitar pedido online
  async function handleAceitarPedido(id: string) {
    try {
      await aceitarPedido(id);
      toast.success("✅ Pedido aceito! Enviado para produção.", {
        description: "O cliente foi notificado e o pedido está sendo preparado.",
        duration: 6000,
      });
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aceitar pedido");
    }
  }

  // Abrir diálogo de recusa
  function openRejectDialog(id: string, tipo: "venda" | "online") {
    setRejectOrderId(id);
    setRejectOrderTipo(tipo);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  // Recusar pedido
  async function handleRecusarPedido() {
    if (!rejectOrderId || !rejectOrderTipo) return;
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da recusa");
      return;
    }
    try {
      if (rejectOrderTipo === "online") {
        await recusarPedido(rejectOrderId, rejectReason.trim());
      } else {
        await updateVenda(rejectOrderId, { status: "cancelado" });
      }
      toast.info("Pedido recusado");
      setRejectDialogOpen(false);
      setRejectOrderId(null);
      setRejectOrderTipo(null);
      setRejectReason("");
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
      await qc.invalidateQueries({ queryKey: ["vendas"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao recusar pedido");
      setRejectDialogOpen(false);
      setRejectOrderId(null);
      setRejectOrderTipo(null);
      setRejectReason("");
    }
  }

  // Conta pedidos pendentes (aguardando aceitação)
  const pedidosPendentes = pedidosOnline?.filter(p => 
    p.status === "pendente" || p.status === "aguardando_pagamento"
  ).length ?? 0;

  // Confirmar pagamento recebido - registra a venda no financeiro e dá baixa no estoque
  async function handleConfirmarPagamento() {
    if (!paymentConfirmOrderId || !paymentConfirmOrderTipo) return;
    setConfirmingPayment(true);

    try {
      if (paymentConfirmOrderTipo === "online") {
        // Usa a função confirmarPagamento que tenta RPC primeiro, depois fallback
        const vendaId = await confirmarPagamento(paymentConfirmOrderId);
        
        toast.success(`✅ Pagamento confirmado! Pedido liberado para aceitação.`, {
          description: "Agora clique em 'Aceitar Pedido' para iniciar a preparação.",
          duration: 6000,
        });
      } else {
        // Para vendas PDV, apenas avança para o próximo status
        await updateVenda(paymentConfirmOrderId, { status: "preparando" });
        toast.success("Pagamento confirmado! Iniciando preparo.");
      }

      setPaymentConfirmDialogOpen(false);
      setPaymentConfirmOrderId(null);
      setPaymentConfirmOrderTipo(null);
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
      await qc.invalidateQueries({ queryKey: ["vendas"] });
      await qc.invalidateQueries({ queryKey: ["ingredientes"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar pagamento");
      setPaymentConfirmDialogOpen(false);
      setPaymentConfirmOrderId(null);
      setPaymentConfirmOrderTipo(null);
    } finally {
      setConfirmingPayment(false);
    }
  }

  // Pagamento não recebido - mantém o pedido bloqueado
  async function handlePagamentoNaoRecebido() {
    if (!paymentConfirmOrderId || !paymentConfirmOrderTipo) return;

    try {
      if (paymentConfirmOrderTipo === "online") {
        // Mantém o status como "aguardando_pagamento" - não registra venda
        toast.info("Pedido mantido como aguardando pagamento. Nenhuma venda registrada.");
      }

      setPaymentConfirmDialogOpen(false);
      setPaymentConfirmOrderId(null);
      setPaymentConfirmOrderTipo(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar pedido");
    }
  }

  // Abrir diálogo de confirmação de pagamento
  function openPaymentConfirmDialog(orderId: string, tipo: "venda" | "online") {
    setPaymentConfirmOrderId(orderId);
    setPaymentConfirmOrderTipo(tipo);
    setPaymentConfirmDialogOpen(true);
  }

  // Exportar entregas para CSV
  function exportarEntregasCSV() {
    const entregas = getPedidosByColumn("finalizado");
    if (entregas.length === 0) {
      toast.error("Nenhuma entrega concluída para exportar");
      return;
    }

    // Cabeçalho CSV
    const headers = ["Pedido", "Cliente", "Telefone", "Endereço", "Produtos", "Valor Total", "Forma de Pagamento", "Data", "Hora", "Status"];
    
    // Linhas de dados
    const rows = entregas.map(p => {
      const data = new Date(p.created_at);
      const produtos = p.itens.map(i => `${i.quantidade}x ${i.nome}`).join("; ");
      const formaPagamento = p.tipo === "online" ? "PIX" : "PDV";
      const status = "Entregue";
      
      return [
        p.numero || p.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
        `"${p.cliente.replace(/"/g, '""')}"`,
        `"${p.telefone.replace(/"/g, '""')}"`,
        `"${p.endereco.replace(/"/g, '""')}"`,
        `"${produtos.replace(/"/g, '""')}"`,
        p.total.toFixed(2),
        formaPagamento,
        data.toLocaleDateString("pt-BR"),
        data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status
      ].join(",");
    });

    // Montar CSV completo
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // Adicionar BOM para UTF-8
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    
    // Criar link de download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `entregas_pizzastockai_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${entregas.length} entrega(s) exportada(s) para CSV`);
  }

  // Excluir entrega concluída individual
  async function handleExcluirEntrega() {
    if (!deleteSingleOrderId || !deleteSingleOrderTipo) return;

    try {
      if (deleteSingleOrderTipo === "online") {
        const { error } = await supabase
          .from("pedidos_online")
          .delete()
          .eq("id", deleteSingleOrderId);
        if (error) throw error;
      } else {
        toast.info("Vendas PDV não podem ser excluídas para preservar registros financeiros.");
        setDeleteDialogOpen(false);
        setDeleteSingleOrderId(null);
        setDeleteSingleOrderTipo(null);
        return;
      }

      toast.success("Entrega excluída com sucesso");
      setDeleteDialogOpen(false);
      setDeleteSingleOrderId(null);
      setDeleteSingleOrderTipo(null);
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir entrega");
      setDeleteDialogOpen(false);
      setDeleteSingleOrderId(null);
      setDeleteSingleOrderTipo(null);
    }
  }

  // Excluir todas as entregas concluídas
  async function handleExcluirTodasEntregas() {
    try {
      const entregasOnline = pedidosOnline?.filter(p => p.status === "finalizado") || [];
      
      if (entregasOnline.length === 0) {
        toast.info("Nenhuma entrega online concluída para excluir");
        setDeleteDialogOpen(false);
        return;
      }

      const ids = entregasOnline.map(p => p.id);
      const { error } = await supabase
        .from("pedidos_online")
        .delete()
        .in("id", ids);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`${ids.length} entrega(s) online excluída(s)`);
      setDeleteDialogOpen(false);
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir entregas");
    }
  }

  // Abrir diálogo de exclusão individual
  function openDeleteDialog(orderId: string, tipo: "venda" | "online") {
    setDeleteSingleOrderId(orderId);
    setDeleteSingleOrderTipo(tipo);
    setDeleteDialogOpen(true);
  }

  // Conta entregas concluídas
  const entregasConcluidas = getPedidosByColumn("finalizado").length;

  // Função para salvar pedido
  async function handleSalvarPedido(pedidoId: string) {
    setSavingOrder(pedidoId);
    try {
      await salvarPedido(pedidoId, "operador");
      toast.success("💾 Pedido salvo com sucesso!", {
        description: "O pedido foi registrado permanentemente e pode ser consultado em 'Pedidos Salvos'.",
        duration: 5000,
      });
      await qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("já está salvo")) {
        toast.info("✅ Este pedido já está salvo no sistema.", {
          duration: 4000,
        });
      } else {
        toast.error(msg || "Erro ao salvar pedido");
      }
    } finally {
      setSavingOrder(null);
    }
  }

  // Busca pedidos salvos com filtros
  function getSavedOrders() {
    if (!pedidosOnline) return [];
    
    let saved = pedidosOnline.filter(p => (p as any).salvo_em != null);
    
    // Filtro por termo de busca (cliente, telefone, número)
    if (savedSearchTerm.trim()) {
      const term = savedSearchTerm.toLowerCase().trim();
      saved = saved.filter(p => {
        const cliente = (p.cliente || "").toLowerCase();
        const telefone = (p.telefone || "").toLowerCase();
        return cliente.includes(term) || telefone.includes(term);
      });
    }
    
    // Filtro por status
    if (savedStatusFilter) {
      saved = saved.filter(p => p.status === savedStatusFilter);
    }
    
    // Filtro por data
    if (savedDateFilter) {
      saved = saved.filter(p => {
        const createdDate = new Date(p.created_at).toISOString().slice(0, 10);
        return createdDate === savedDateFilter;
      });
    }
    
    // Ordena por data de criação, mais recente primeiro
    saved.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return saved;
  }

  // Conta pedidos salvos
  const totalPedidosSalvos = pedidosOnline?.filter(p => (p as any).salvo_em != null).length ?? 0;

  return (
    <div>
      <PageHeader title="Delivery" />

      {/* ======================================== */}
      {/* BANNER: NOVO PEDIDO CHEGOU */}
      {/* ======================================== */}
      {newOrderBanner && (
        <div className="mb-4 rounded-xl border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-lg animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-green-600 animate-bounce" />
              <div>
                <div className="font-bold text-green-800 text-lg">🔔 NOVO PEDIDO!</div>
                <div className="text-sm text-green-700">
                  Cliente: <strong>{newOrderBanner.cliente}</strong> — Valor: <strong>{brl(newOrderBanner.total)}</strong>
                </div>
                <div className="text-xs text-green-600">Chegou às {newOrderBanner.time}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => setNewOrderBanner(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Realtime status */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span>Pedidos das últimas 48h — atualiza sozinho</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          realtimeConnected 
            ? "bg-green-100 text-green-700" 
            : "bg-yellow-100 text-yellow-700"
        }`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            realtimeConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
          }`} />
          {realtimeConnected ? "Realtime ativo" : `Fallback polling ${reconnectAttempts > 0 ? `(reconectando: ${reconnectAttempts})` : ""}`}
        </span>
        {pedidosPendentes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            {pedidosPendentes} pendente{pedidosPendentes > 1 ? 's' : ''}
          </span>
        )}
        {/* Botão de toggle de som */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const newVal = !isSoundEnabled();
            toggleSound(newVal);
            toast.info(newVal ? "🔔 Som de alerta ativado" : "🔕 Som de alerta desativado");
          }}
          className={isSoundEnabled() ? "text-green-600 border-green-300" : "text-muted-foreground"}
        >
          {isSoundEnabled() ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span className="ml-1 text-xs">{isSoundEnabled() ? "Som ON" : "Som OFF"}</span>
        </Button>
      </div>
      {/* Botões de ação */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSavedOrdersOpen(!savedOrdersOpen)}
          className={savedOrdersOpen ? "bg-blue-50 border-blue-300 text-blue-700" : ""}
        >
          <Save className="h-4 w-4 mr-1" />
          📚 Pedidos Salvos ({totalPedidosSalvos})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportarEntregasCSV}
          disabled={entregasConcluidas === 0}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar Entregas CSV ({entregasConcluidas})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={entregasConcluidas === 0}
          className="text-destructive border-destructive hover:bg-destructive hover:text-white"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir Entregas Concluídas
        </Button>
      </div>

      {/* Seção de Pedidos Salvos */}
      {savedOrdersOpen && (
        <div className="mb-6 rounded-xl border bg-muted/30 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Save className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">📚 Pedidos Salvos</h2>
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {getSavedOrders().length}
            </span>
          </div>

          {/* Barra de busca e filtros */}
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou telefone..."
                value={savedSearchTerm}
                onChange={(e) => setSavedSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                className="rounded-lg border bg-background pl-9 pr-8 py-2 text-sm"
                value={savedStatusFilter}
                onChange={(e) => setSavedStatusFilter(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="aguardando_pagamento">Aguardando Pagamento</option>
                <option value="pago">Pagamento Confirmado</option>
                <option value="recebido">Pedido Recebido</option>
                <option value="preparando">Preparando</option>
                <option value="pronto">Pronto</option>
                <option value="em_entrega">Em Entrega</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                className="rounded-lg border bg-background pl-9 pr-3 py-2 text-sm"
                value={savedDateFilter}
                onChange={(e) => setSavedDateFilter(e.target.value)}
              />
            </div>
            {(savedSearchTerm || savedStatusFilter || savedDateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSavedSearchTerm("");
                  setSavedStatusFilter("");
                  setSavedDateFilter("");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Lista de pedidos salvos */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {getSavedOrders().length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center">
                <Save className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {pedidosOnline && pedidosOnline.length > 0
                    ? "Nenhum pedido salvo encontrado com os filtros selecionados."
                    : "Nenhum pedido salvo ainda. Use o botão '💾 Salvar Pedido' nos pedidos online."}
                </p>
              </div>
            ) : (
              getSavedOrders().map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border bg-card p-4 cursor-pointer hover:border-primary hover:shadow-md transition"
                  onClick={() => openOrderDetail(p)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          <Globe className="h-3 w-3" />
                          🌐 Pedido Online
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{p.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                        </span>
                        {(p as any).salvo_em && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                            💾 Salvo em {new Date((p as any).salvo_em).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold">{p.cliente}</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>📞 {p.telefone}</div>
                        <div>📍 {p.endereco}</div>
                        <div>🕐 {new Date(p.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-primary">{brl(p.total)}</div>
                      <div className="text-xs text-muted-foreground">PIX</div>
                      <div className="mt-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.status === "finalizado" ? "bg-green-100 text-green-700" :
                          p.status === "em_entrega" ? "bg-purple-100 text-purple-700" :
                          p.status === "pronto" ? "bg-cyan-100 text-cyan-700" :
                          p.status === "preparando" ? "bg-orange-100 text-orange-700" :
                          p.status === "pago" ? "bg-blue-100 text-blue-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Itens resumidos */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.itens?.slice(0, 3).map((i: any, idx: number) => (
                      <span key={idx} className="inline-block rounded bg-muted px-2 py-0.5 text-[10px]">
                        {i.quantidade}× {i.nome}
                      </span>
                    ))}
                    {p.itens && p.itens.length > 3 && (
                      <span className="inline-block rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{p.itens.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cols.map((c) => {
          const list = getPedidosByColumn(c.s);
          return (
            <div key={c.s} className="rounded-xl border bg-muted/30 p-3">
              <h2 className="mb-3 font-display font-semibold">{c.t} <span className="text-muted-foreground">({list.length})</span></h2>
              <div className="space-y-3">
                {list.slice(0, c.s === "finalizado" ? 10 : 100).map((p) => {
                  const novo = isNovoPedido(p.created_at);
                  const expiracao = p.tipo === "online" && c.s === "pendente"
                    ? getTempoRestanteExpiracao(p.created_at)
                    : null;

                  return (
                  <div
                    key={p.id}
                    className={`rounded-lg border bg-card p-3 text-sm cursor-pointer hover:border-primary hover:shadow-md transition ${
                      novo
                        ? 'border-2 border-green-400 shadow-green-100 shadow-md ring-2 ring-green-200'
                        : expiracao?.expirado
                        ? 'border-2 border-red-300 bg-red-50/50'
                        : ''
                    }`}
                    onClick={() => openOrderDetail(p)}
                  >
                    {/* Badge NOVO PEDIDO */}
                    {novo && (
                      <div className="mb-2 -mx-1 -my-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                          ★ NOVO PEDIDO
                        </span>
                      </div>
                    )}

                    {/* Timer de expiração */}
                    {expiracao && !expiracao.expirado && (
                      <div className={`mb-2 flex items-center gap-1 text-xs font-medium ${
                        expiracao.minutos <= 1 ? 'text-red-600 animate-pulse' :
                        expiracao.minutos <= 2 ? 'text-orange-600' :
                        'text-yellow-600'
                      }`}>
                        <Clock className="h-3 w-3" />
                        Expira em: {String(expiracao.minutos).padStart(2, '0')}:{String(expiracao.segundos).padStart(2, '0')}
                      </div>
                    )}

                    {/* Badge de expirado */}
                    {expiracao?.expirado && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          ⏰ EXPIRADO
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between font-semibold">
                      <span>
                        {p.tipo === "venda" && p.numero ? `#${p.numero} ` : ""}
                        {p.cliente}
                        <span className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          p.tipo === 'online' ? 'bg-blue-100 text-blue-700' :
                          p.origem === 'Delivery' ? 'bg-green-100 text-green-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {p.tipo === 'online' ? '🌐 Online' : p.origem}
                        </span>
                      </span>
                      <span>{brl(p.total)}</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="text-xs text-muted-foreground">📞 {p.telefone}</div>
                      <div className="text-xs text-muted-foreground">📍 {p.endereco}</div>
                      <div className="text-xs text-muted-foreground">🕐 {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                      {p.status && (
                        <div className="text-xs">
                          <span className="font-medium">Status:</span> {p.status}
                          {p.status_delivery && p.status_delivery !== "pendente" && (
                            <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">{p.status_delivery}</span>
                          )}
                        </div>
                      )}
                      {p.observacoes && (
                        <div className="text-xs rounded bg-yellow-50 p-1.5 text-yellow-800">
                          <span className="font-medium">📝 Observações:</span> {p.observacoes}
                        </div>
                      )}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {p.itens && p.itens.length > 0 ? p.itens.map((i, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>
                            {i.quantidade}× {i.nome}
                            {i.descricao && <span className="text-muted-foreground"> — {i.descricao}</span>}
                          </span>
                          {i.preco_unitario && <span className="text-muted-foreground">{brl(i.preco_unitario * i.quantidade)}</span>}
                        </li>
                      )) : <li>Sem itens</li>}
                    </ul>
                    {p.tipo === "online" && (
                      <div className="mt-2 rounded border bg-muted/50 p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{brl(p.subtotal)}</span>
                        </div>
                        {p.desconto > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Desconto{p.cupom ? ` (${p.cupom})` : ""}:</span>
                            <span>-{brl(p.desconto)}</span>
                          </div>
                        )}
                        {p.taxa_entrega > 0 && (
                          <div className="flex justify-between">
                            <span>Taxa de entrega:</span>
                            <span>{brl(p.taxa_entrega)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 border-t">
                          <span>Total:</span>
                          <span>{brl(p.total)}</span>
                        </div>
                      </div>
                    )}
                    {c.s !== "finalizado" && p.tipo !== "online" && (
                      <select className="mt-2 w-full rounded border bg-background p-1 text-xs" value={p.motoboy_id ?? ""} onClick={(e) => e.stopPropagation()} onChange={(e) => update(p.id, p.tipo, { motoboy_id: e.target.value || null })}>
                        <option value="">Sem motoboy</option>
                        {motoboys.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    )}
                    {c.s === "pendente" && p.tipo === "online" && (
                      <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Botão Salvar Pedido - exclusivo para pedidos online */}
                        {!p.salvo_em && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => handleSalvarPedido(p.id)}
                            disabled={savingOrder === p.id}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {savingOrder === p.id ? "Salvando..." : "💾 Salvar Pedido"}
                          </Button>
                        )}
                        {p.salvo_em && (
                          <div className="rounded bg-green-50 border border-green-200 px-2 py-1 text-[10px] font-semibold text-green-700 text-center">
                            ✅ Pedido salvo em {new Date(p.salvo_em).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                        )}
                        {/* Confirmar pagamento - aparece quando aguardando pagamento */}
                        {p.status === "aguardando_pagamento" && (
                          <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-2">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-yellow-800">
                              <Clock className="h-3.5 w-3.5" />
                              Aguardando pagamento PIX
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => openPaymentConfirmDialog(p.id, p.tipo)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirmar Pagamento
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                                onClick={() => openRejectDialog(p.id, p.tipo)}
                              >
                                <XOctagon className="h-4 w-4 mr-1" />
                                Recusar
                              </Button>
                            </div>
                          </div>
                        )}
                        {/* Aceitar/Recusar pedido - aparece quando pago ou pendente */}
                        {p.status !== "aguardando_pagamento" && (
                          <div className="flex flex-col gap-2">
                            {p.status === "pago" && (
                              <div className="rounded-lg border-2 border-green-300 bg-green-50 p-2">
                                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-800">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Pagamento confirmado - pronto para aceitar
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleAceitarPedido(p.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    ✅ Aceitar Pedido
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                                    onClick={() => openRejectDialog(p.id, p.tipo)}
                                  >
                                    <XOctagon className="h-4 w-4 mr-1" />
                                    Recusar
                                  </Button>
                                </div>
                              </div>
                            )}
                            {p.status !== "pago" && p.status !== "aguardando_pagamento" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleAceitarPedido(p.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aceitar Pedido
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                                  onClick={() => openRejectDialog(p.id, p.tipo)}
                                >
                                  <XOctagon className="h-4 w-4 mr-1" />
                                  Recusar
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {c.next && c.s !== "pendente" && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" className="flex-1" onClick={() => update(p.id, p.tipo, { status: c.next! })}>{c.btn}</Button>
                        <Button size="sm" variant="ghost" onClick={() => update(p.id, p.tipo, { status: "cancelado" })}>Cancelar</Button>
                      </div>
                    )}
                    {c.s === "finalizado" && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => openDeleteDialog(p.id, p.tipo)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {nfceVenda && (
        <NFCEPrint
          venda={nfceVenda}
          onClose={() => setNfceVenda(null)}
          onPrint={() => {
            toast.success("Nota fiscal enviada para impressão!");
          }}
        />
      )}

      {nfceOnline && (
        <OnlineOrderNFCE
          pedido={nfceOnline}
          onClose={() => setNfceOnline(null)}
          onPrint={() => {
            toast.success("Nota fiscal enviada para impressão!");
          }}
        />
      )}

      {/* Painel lateral de detalhes do pedido */}
      {selectedOrder && (
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl overflow-y-auto p-0" side="right">
            <SheetHeader className="sticky top-0 z-10 bg-background px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Detalhes do Pedido
                  </SheetTitle>
                  <SheetDescription>
                    {selectedOrder.tipo === "venda" && selectedOrder.numero
                      ? `Pedido #${selectedOrder.numero}`
                      : "Pedido Online"}
                    {selectedOrder.tipo === "online" && (
                      <span className="ml-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        LOJA ONLINE
                      </span>
                    )}
                    {selectedOrder.tipo === "venda" && (
                      <span className="ml-2 inline-block rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        PDV
                      </span>
                    )}
                  </SheetDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetailSheetOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-6 py-4">
              {/* Informações do Cliente */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-primary">
                  <User className="h-4 w-4" />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedOrder.cliente}</span>
                  </div>
                  {selectedOrder.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedOrder.telefone}</span>
                    </div>
                  )}
                  {selectedOrder.endereco && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{selectedOrder.endereco}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(selectedOrder.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-primary">
                  <ShoppingBag className="h-4 w-4" />
                  Itens do Pedido
                </h3>
                <div className="space-y-3">
                  {selectedOrder.itens && selectedOrder.itens.length > 0 ? (
                    selectedOrder.itens.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
                        <div className="flex-1">
                          <div className="font-medium">{item.nome}</div>
                          {item.descricao && (
                            <div className="text-xs text-muted-foreground mt-0.5">{item.descricao}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.quantidade}× {brl(item.preco_unitario || 0)}
                          </div>
                        </div>
                        <div className="font-semibold text-primary whitespace-nowrap">
                          {brl((item.preco_unitario || 0) * item.quantidade)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem itens</p>
                  )}
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-primary">
                  <FileText className="h-4 w-4" />
                  Resumo Financeiro
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{brl(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.desconto > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto{selectedOrder.cupom ? ` (${selectedOrder.cupom})` : ""}:</span>
                      <span>-{brl(selectedOrder.desconto)}</span>
                    </div>
                  )}
                  {selectedOrder.taxa_entrega > 0 && (
                    <div className="flex justify-between">
                      <span>Taxa de entrega:</span>
                      <span>{brl(selectedOrder.taxa_entrega)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-display text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">{brl(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Observações */}
              {selectedOrder.observacoes && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-yellow-800">
                    📝 Observações do Cliente
                  </h3>
                  <p className="text-sm text-yellow-900">{selectedOrder.observacoes}</p>
                </div>
              )}

              {/* Status */}
              {selectedOrder.status && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <h3 className="mb-2 font-semibold text-primary">Status do Pedido</h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-medium capitalize">{selectedOrder.status}</span>
                    {selectedOrder.status_delivery && selectedOrder.status_delivery !== "pendente" && (
                      <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        {selectedOrder.status_delivery}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-primary">Ações</h3>
                {selectedOrder.tipo === "online" ? (
                  <>
                    {!selectedOrder.salvo_em && (
                      <Button
                        className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        variant="outline"
                        size="lg"
                        onClick={() => handleSalvarPedido(selectedOrder.id)}
                        disabled={savingOrder === selectedOrder.id}
                      >
                        <Save className="h-5 w-5 mr-2" />
                        {savingOrder === selectedOrder.id ? "Salvando..." : "💾 Salvar Pedido"}
                      </Button>
                    )}
                    {selectedOrder.salvo_em && (
                      <div className="rounded bg-green-50 border border-green-200 p-3 text-center">
                        <div className="text-xs font-semibold text-green-700">
                          ✅ Pedido salvo em {new Date(selectedOrder.salvo_em).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                      onClick={() => {
                        handleAceitarPedido(selectedOrder.id);
                        setDetailSheetOpen(false);
                      }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Aceitar Pedido
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                      size="lg"
                      onClick={() => {
                        openRejectDialog(selectedOrder.id, selectedOrder.tipo);
                        setDetailSheetOpen(false);
                      }}
                    >
                      <XOctagon className="h-5 w-5 mr-2" />
                      Recusar Pedido
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        update(selectedOrder.id, selectedOrder.tipo, { status: "preparo" });
                        setDetailSheetOpen(false);
                      }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Iniciar Preparo
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                      size="lg"
                      onClick={() => {
                        openRejectDialog(selectedOrder.id, selectedOrder.tipo);
                        setDetailSheetOpen(false);
                      }}
                    >
                      <XOctagon className="h-5 w-5 mr-2" />
                      Recusar Pedido
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Diálogo de recusa */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. Este motivo será enviado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da recusa</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Produto indisponível, fora da área de entrega, etc."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRecusarPedido}
              disabled={!rejectReason.trim()}
            >
              <XOctagon className="h-4 w-4 mr-1" />
              Recusar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de pagamento */}
      <Dialog open={paymentConfirmDialogOpen} onOpenChange={setPaymentConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação de Pagamento</DialogTitle>
            <DialogDescription>
              Confirme que o pagamento PIX foi recebido do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">O que acontece ao confirmar?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Venda registrada no financeiro</li>
                <li>✅ Estoque atualizado automaticamente</li>
                <li>✅ Status muda para "Pagamento Confirmado"</li>
                <li>✅ Cliente recebe notificação em tempo real</li>
                <li>✅ Pedido liberado para aceitação</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
                onClick={handleConfirmarPagamento}
                disabled={confirmingPayment}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {confirmingPayment ? "Registrando..." : "✅ Confirmar Pagamento Recebido"}
              </Button>
              <Button
                variant="outline"
                className="w-full text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                size="lg"
                onClick={handlePagamentoNaoRecebido}
                disabled={confirmingPayment}
              >
                <XOctagon className="h-5 w-5 mr-2" />
                Pagamento Não Recebido
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentConfirmDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de exclusão de entregas */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle>Excluir Entregas Concluídas</DialogTitle>
            </div>
            <DialogDescription>
              {deleteSingleOrderId 
                ? "Deseja excluir esta entrega concluída? Registros financeiros e de estoque não serão afetados."
                : "Deseja excluir todas as entregas concluídas? Registros financeiros e de estoque não serão afetados."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Esta ação não pode ser desfeita. Os registros financeiros e movimentações de estoque serão preservados.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {deleteSingleOrderId ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  size="lg"
                  onClick={handleExcluirEntrega}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Excluir Esta Entrega
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full"
                  size="lg"
                  onClick={handleExcluirTodasEntregas}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Excluir Todas as Entregas Concluídas
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
