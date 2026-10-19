import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, motoboysQ, vendasQ, type Venda } from "@/lib/data";
import { PageHeader, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { NFCEPrint } from "@/components/NFCEPrint";
import { OnlineOrderNFCE } from "@/components/OnlineOrderNFCE";
import type { OnlineOrder } from "@/lib/online-order";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({ meta: [{ title: "Delivery — PizzaStockAI" }, { name: "description", content: "Acompanhe pedidos de delivery do preparo à entrega." }, { property: "og:title", content: "Delivery — PizzaStockAI" }, { property: "og:description", content: "Quadro de pedidos de delivery." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(vendasQ(2)), context.queryClient.ensureQueryData(motoboysQ)]),
  errorComponent: RouteError,
  component: Delivery,
});

const cols = [
  { s: "novo", t: "Novos", next: "preparo", btn: "Iniciar preparo" },
  { s: "preparo", t: "Em preparo", next: "saiu", btn: "Saiu p/ entrega" },
  { s: "saiu", t: "Saiu para entrega", next: "entregue", btn: "Marcar entregue" },
  { s: "entregue", t: "Entregues", next: null, btn: "" },
] as const;

// Mapeia status de pedidos_online para status do delivery
const onlineStatusMap: Record<string, string> = {
  "aguardando_pagamento": "novo",
  "pago": "novo",
  "novo": "novo",
  "preparo": "preparo",
  "saiu": "saiu",
  "entregue": "entregue",
  "cancelado": "cancelado",
};

function Delivery() {
  const { data: vendas } = useSuspenseQuery(vendasQ(2));
  const { data: motoboys } = useSuspenseQuery(motoboysQ);
  const qc = useQueryClient();
  const pedidosVendas = vendas.filter((v) => v.tipo === "delivery");
  const [nfceVenda, setNfceVenda] = useState<Venda | null>(null);
  const [nfceOnline, setNfceOnline] = useState<OnlineOrder | null>(null);

  // Busca pedidos online com auto-refresh
  const { data: pedidosOnline } = useQuery({
    queryKey: ["pedidos-online-delivery"],
    refetchInterval: 15000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 2 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("pedidos_online")
        .select("id, cliente, telefone, endereco, itens, subtotal, desconto, taxa_entrega, total, status, motoboy_id, created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OnlineOrder[];
    },
  });

  // Combina pedidos de vendas e pedidos online em uma lista unificada por coluna
  function getPedidosByColumn(status: string) {
    const result: Array<{
      id: string;
      tipo: "venda" | "online";
      cliente: string;
      telefone: string;
      endereco: string;
      total: number;
      itens: Array<{ nome: string; quantidade: number }>;
      motoboy_id?: string | null;
      created_at: string;
      numero?: string;
    }> = [];

    // Adiciona vendas do tipo delivery
    if (status !== "cancelado") {
      result.push(
        ...pedidosVendas
          .filter((v) => v.status === status)
          .map((v) => ({
            id: v.id,
            tipo: "venda" as const,
            cliente: v.cliente || "",
            telefone: v.telefone || "",
            endereco: v.endereco || "",
            total: Number(v.total),
            itens: v.venda_itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
            motoboy_id: v.motoboy_id || null,
            created_at: v.created_at,
            numero: v.numero,
          }))
      );
    }

    // Adiciona pedidos online
    if (pedidosOnline && status !== "cancelado") {
      result.push(
        ...pedidosOnline
          .filter((p) => onlineStatusMap[p.status] === status)
          .map((p) => ({
            id: p.id,
            tipo: "online" as const,
            cliente: p.cliente,
            telefone: p.telefone,
            endereco: p.endereco,
            total: Number(p.total),
            itens: p.itens?.map((i) => ({ nome: i.nome, quantidade: i.quantidade })) || [],
            motoboy_id: (p as OnlineOrder & { motoboy_id?: string | null }).motoboy_id || null,
            created_at: p.created_at,
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

    if (patch.status === "entregue") {
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

  async function updateOnline(id: string, patch: { status?: string; motoboy_id?: string | null }) {
    let newStatus = patch.status;
    // Se o status mudou para "entregue", mostra a nota fiscal
    if (patch.status === "entregue") {
      const pedido = pedidosOnline?.find((p) => p.id === id);
      if (pedido) {
        setNfceOnline(pedido);
      }
    }
    const { error } = await supabase
      .from("pedidos_online")
      .update({ status: newStatus, motoboy_id: patch.motoboy_id })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pedidos-online-delivery"] });
  }

  async function update(id: string, tipo: "venda" | "online", patch: { status?: string; motoboy_id?: string | null }) {
    if (tipo === "venda") {
      await updateVenda(id, patch);
    } else {
      await updateOnline(id, patch);
    }
  }

  return (
    <div>
      <PageHeader title="Delivery" sub="Pedidos das últimas 48h — atualiza sozinho" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cols.map((c) => {
          const list = getPedidosByColumn(c.s);
          return (
            <div key={c.s} className="rounded-xl border bg-muted/30 p-3">
              <h2 className="mb-3 font-display font-semibold">{c.t} <span className="text-muted-foreground">({list.length})</span></h2>
              <div className="space-y-3">
                {list.slice(0, c.s === "entregue" ? 10 : 100).map((p) => (
                  <div key={p.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span>
                        {p.tipo === "venda" && p.numero ? `#${p.numero} ` : ""}
                        {p.cliente}
                        {p.tipo === "online" && (
                          <span className="ml-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Online</span>
                        )}
                      </span>
                      <span>{brl(p.total)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{p.endereco} · {p.telefone}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                    <ul className="mt-2 text-xs">
                      {p.itens && p.itens.length > 0 ? p.itens.map((i, idx) => <li key={idx}>{i.quantidade}× {i.nome}</li>) : <li>Sem itens</li>}
                    </ul>
                    {c.s !== "entregue" && (
                      <select className="mt-2 w-full rounded border bg-background p-1 text-xs" value={p.motoboy_id ?? ""} onChange={(e) => update(p.id, p.tipo, { motoboy_id: e.target.value || null })}>
                        <option value="">Sem motoboy</option>
                        {motoboys.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    )}
                    {c.next && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => update(p.id, p.tipo, { status: c.next! })}>{c.btn}</Button>
                        <Button size="sm" variant="ghost" onClick={() => update(p.id, p.tipo, { status: "cancelado" })}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                ))}
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
    </div>
  );
}
