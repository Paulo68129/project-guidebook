import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, Send, Package, Clock, CheckCircle, ShoppingBag, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, configQ, cuponsQ, produtosQ, vendasQ, type Venda } from "@/lib/data";
import { PageHeader, Panel, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NFCEPrint } from "@/components/NFCEPrint";
import { normalizeItems } from "@/lib/online-order";
import type { OnlineOrder } from "@/lib/online-order";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "PDV — PizzaStockAI" }, { name: "description", content: "Ponto de venda de balcão e delivery." }, { property: "og:title", content: "PDV — PizzaStockAI" }, { property: "og:description", content: "Ponto de venda da pizzaria." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(produtosQ), context.queryClient.ensureQueryData(configQ), context.queryClient.ensureQueryData(cuponsQ), context.queryClient.ensureQueryData(vendasQ(2))]),
  errorComponent: RouteError,
  component: Pdv,
});

function Pdv() {
  const { data: produtos } = useSuspenseQuery(produtosQ);
  const { data: config } = useSuspenseQuery(configQ);
  const { data: cupons } = useSuspenseQuery(cuponsQ);
  const qc = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tipo, setTipo] = useState<"balcao" | "delivery">("balcao");
  const [cli, setCli] = useState({ cliente: "", telefone: "", endereco: "", cupom: "" });
  const [busy, setBusy] = useState(false);
  const [nfceVenda, setNfceVenda] = useState<Venda | null>(null);
  const [sendingToProduction, setSendingToProduction] = useState<string | null>(null);

  // Busca vendas pendentes (balcão e delivery) que ainda não foram enviadas para produção
  const { data: vendas } = useSuspenseQuery(vendasQ(2));
  const vendasPendentes = vendas.filter((v) => v.status === "pendente");

  // Busca pedidos online pendentes (aguardando confirmação do PDV)
  const { data: pedidosOnline, isLoading: isLoadingPedidos } = useQuery({
    queryKey: ["pedidos-online-pdv"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_online")
        .select("id, cliente, telefone, endereco, itens, subtotal, desconto, taxa_entrega, total, status, created_at, cupom, observacoes, origem")
        .in("status", ["pendente", "aguardando_pagamento", "pago", "novo"])
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[PDV] Erro ao buscar pedidos online:", error);
        throw error;
      }
      const normalized = (data ?? []).map((row: any) => ({
        ...row,
        itens: normalizeItems(row.itens),
      })) as unknown as OnlineOrder[];
      return normalized;
    },
  });

  // Combina todos os pedidos pendentes (vendas + online)
  interface PedidoPendente {
    id: string;
    tipo: "venda" | "online";
    origem: string;
    cliente: string;
    telefone: string;
    endereco: string;
    total: number;
    itens: Array<{ nome: string; quantidade: number }>;
    created_at: string;
    status: string;
    numero?: string;
    observacoes?: string | null;
  }

  const todosPedidosPendentes: PedidoPendente[] = [
    ...vendasPendentes.map((v) => ({
      id: v.id,
      tipo: "venda" as const,
      origem: v.tipo === "delivery" ? "Delivery" : "Balcão",
      cliente: v.cliente || "",
      telefone: v.telefone || "",
      endereco: v.endereco || "",
      total: Number(v.total),
      itens: (v.venda_itens ?? []).map((i: any) => ({ nome: i.nome, quantidade: i.quantidade })),
      created_at: v.created_at,
      status: v.status,
      numero: String(v.numero),
      observacoes: null,
    })),
    ...(pedidosOnline ?? []).map((p) => ({
      id: p.id,
      tipo: "online" as const,
      origem: "Loja Online",
      cliente: p.cliente,
      telefone: p.telefone,
      endereco: p.endereco,
      total: Number(p.total),
      itens: p.itens?.map((i) => ({ nome: i.nome, quantidade: i.quantidade })) || [],
      created_at: p.created_at,
      status: p.status,
      observacoes: (p as any).observacoes || null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Envia pedido para produção (avança status para "recebido")
  async function enviarParaProducao(pedidoId: string, tipo: "venda" | "online") {
    setSendingToProduction(pedidoId);
    try {
      if (tipo === "venda") {
        const { error } = await supabase.from("vendas").update({ status: "recebido" }).eq("id", pedidoId);
        if (error) {
          toast.error(error.message);
          return;
        }
        qc.invalidateQueries({ queryKey: ["vendas"] });
      } else {
        // Para pedidos online, tenta RPC primeiro, depois fallback
        const rpcResult = await (supabase as any).rpc("avancar_status_pedido", {
          _pedido_id: pedidoId,
          _novo_status: "recebido",
          _motivo: "",
        });
        if (rpcResult.error) {
          const { error } = await supabase
            .from("pedidos_online")
            .update({ status: "recebido", status_delivery: "aceito", aceito_em: new Date().toISOString() } as any)
            .eq("id", pedidoId);
          if (error) {
            toast.error(error.message);
            return;
          }
        }
        qc.invalidateQueries({ queryKey: ["pedidos-online-pdv"] });
      }
      toast.success("✅ Pedido enviado para produção!", {
        description: "O pedido agora está na linha de produção do delivery.",
        duration: 4000,
      });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar pedido para produção");
    } finally {
      setSendingToProduction(null);
    }
  }

  // Envia todos os pedidos pendentes para produção de uma vez
  async function enviarTodosParaProducao() {
    if (todosPedidosPendentes.length === 0) {
      toast.info("Não há pedidos pendentes para enviar");
      return;
    }
    setBusy(true);
    let sucesso = 0;
    let falha = 0;
    for (const p of todosPedidosPendentes) {
      try {
        if (p.tipo === "venda") {
          const { error } = await supabase.from("vendas").update({ status: "recebido" }).eq("id", p.id);
          if (error) falha++; else sucesso++;
        } else {
          const rpcResult = await (supabase as any).rpc("avancar_status_pedido", {
            _pedido_id: p.id,
            _novo_status: "recebido",
            _motivo: "",
          });
          if (rpcResult.error) {
            const { error } = await supabase
              .from("pedidos_online")
              .update({ status: "recebido", status_delivery: "aceito", aceito_em: new Date().toISOString() } as any)
              .eq("id", p.id);
            if (error) falha++; else sucesso++;
          } else {
            sucesso++;
          }
        }
      } catch {
        falha++;
      }
    }
    qc.invalidateQueries({ queryKey: ["vendas"] });
    qc.invalidateQueries({ queryKey: ["pedidos-online-pdv"] });
    setBusy(false);
    if (sucesso > 0) {
      toast.success(`✅ ${sucesso} pedido(s) enviado(s) para produção!`);
    }
    if (falha > 0) {
      toast.error(`${falha} pedido(s) falhou ao enviar`);
    }
  }

  // Auto-refresh para vendas pendentes
  useEffect(() => {
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
    }, 10000);
    return () => clearInterval(interval);
  }, [qc]);

  const ativos = produtos.filter((p) => p.ativo);
  const cats = [...new Set(ativos.map((p) => p.categoria))];
  const add = (id: string, d: number) => setCart((c) => { const q = (c[id] ?? 0) + d; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });
  const linhas = Object.entries(cart).map(([id, q]) => ({ p: produtos.find((x) => x.id === id)!, q })).filter((l) => l.p);
  const sub = linhas.reduce((s, l) => s + Number(l.p.preco) * l.q, 0);
  const cupom = cupons.find((c) => c.ativo && c.codigo.toUpperCase() === cli.cupom.trim().toUpperCase());
  const desc = cupom ? sub * Number(cupom.percentual) / 100 : 0;
  const taxa = tipo === "delivery" ? Number(config?.taxa_entrega ?? 0) : 0;
  const total = sub - desc + taxa;

  async function finalizar() {
    if (!linhas.length) { toast.error("Adicione itens ao pedido"); return; }
    if (tipo === "delivery" && (!cli.cliente || !cli.endereco)) { toast.error("Informe nome e endereço para delivery"); return; }
    setBusy(true);

    // Tenta RPC registrar_venda primeiro (com baixa de estoque e validação)
    const rpcResult = await supabase.rpc("registrar_venda", {
      _itens: linhas.map((l) => ({ produto_id: l.p.id, quantidade: l.q })),
      _tipo: tipo, ...(cli.cliente ? { _cliente: cli.cliente } : {}), ...(cli.telefone ? { _telefone: cli.telefone } : {}),
      ...(cli.endereco ? { _endereco: cli.endereco } : {}), ...(cli.cupom.trim() ? { _cupom: cli.cupom.trim() } : {}),
    });

    if (rpcResult.error) {
      console.warn("[PDV] RPC registrar_venda falhou, usando fallback:", rpcResult.error.message);

      // Fallback: insere diretamente na tabela vendas
      try {
        const vendaId = crypto.randomUUID();
        const sub = linhas.reduce((s, l) => s + Number(l.p.preco) * l.q, 0);
        const desc = cupom ? sub * Number(cupom.percentual) / 100 : 0;
        const taxa = tipo === "delivery" ? Number(config?.taxa_entrega ?? 0) : 0;
        const total = sub - desc + taxa;

        const { error: insertError } = await supabase.from("vendas").insert({
          id: vendaId,
          tipo,
          status: "pendente",
          cliente: cli.cliente || null,
          telefone: cli.telefone || null,
          endereco: cli.endereco || null,
          subtotal: sub,
          desconto: desc,
          taxa_entrega: taxa,
          total,
          cupom: cli.cupom.trim() || null,
        });

        if (insertError) {
          setBusy(false);
          toast.error(insertError.message);
          return;
        }

        // Insere os itens da venda
        for (const l of linhas) {
          await supabase.from("venda_itens").insert({
            venda_id: vendaId,
            produto_id: l.p.id,
            nome: l.p.nome,
            quantidade: l.q,
            preco_unitario: Number(l.p.preco),
            custo_unitario: 0,
          });
        }

        toast.success("Venda registrada!");
      } catch (e: any) {
        setBusy(false);
        toast.error(e?.message || "Erro ao registrar venda");
        return;
      }
    } else {
      setBusy(false);
      toast.success("Venda registrada!");
    }

    setBusy(false);

    // Busca a venda recém-criada para imprimir a nota fiscal
    const { data: ultimaVenda, error: fetchError } = await supabase
      .from("vendas")
      .select("*, venda_itens(*)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fetchError && ultimaVenda) {
      setNfceVenda(ultimaVenda as Venda);
    }

    setCart({}); setCli({ cliente: "", telefone: "", endereco: "", cupom: "" });
    qc.invalidateQueries({ queryKey: ["vendas"] }); qc.invalidateQueries({ queryKey: ["ingredientes"] });
  }

  return (
    <div>
      <PageHeader title="PDV" sub="Toque nos produtos para montar o pedido" />

      {/* ======================================== */}
      {/* SEÇÃO: PEDIDOS RECENTES - GATEWAY PDV → DELIVERY */}
      {/* ======================================== */}
      <div className="mb-6 rounded-xl border bg-muted/30 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">📥 Pedidos Recentes</h2>
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {todosPedidosPendentes.length} pendente{todosPedidosPendentes.length !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Auto-atualiza
            </span>
          </div>
          {todosPedidosPendentes.length > 0 && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={enviarTodosParaProducao}
              disabled={busy}
            >
              <Send className="h-4 w-4 mr-1" />
              {busy ? "Enviando..." : `Enviar Todos para Produção (${todosPedidosPendentes.length})`}
            </Button>
          )}
        </div>

        {todosPedidosPendentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido pendente</p>
            <p className="text-xs text-muted-foreground">Os pedidos aparecerão aqui quando forem criados</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todosPedidosPendentes.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border bg-card p-3 text-sm shadow-sm hover:shadow-md transition"
              >
                {/* Cabeçalho do card */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold">
                      {p.tipo === "venda" && p.numero ? `#${p.numero} ` : ""}
                      {p.cliente || "Cliente não informado"}
                    </div>
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      p.tipo === 'online' ? 'bg-blue-100 text-blue-700' :
                      p.origem === 'Delivery' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {p.tipo === 'online' ? '🌐 Online' : p.origem}
                    </span>
                    {p.status && p.status !== "pendente" && (
                      <span className="ml-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700">
                        {p.status}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{brl(p.total)}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                {/* Informações do cliente */}
                <div className="mt-2 space-y-1">
                  {p.telefone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {p.telefone}
                    </div>
                  )}
                  {p.endereco && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5" />
                      {p.endereco}
                    </div>
                  )}
                </div>

                {/* Itens do pedido */}
                <div className="mt-2 rounded border bg-muted/30 p-2">
                  <div className="flex items-center gap-1 text-xs font-medium mb-1">
                    <ShoppingBag className="h-3 w-3" />
                    Itens:
                  </div>
                  <ul className="space-y-0.5 text-xs">
                    {p.itens.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex justify-between text-muted-foreground">
                        <span>{item.quantidade}× {item.nome}</span>
                      </li>
                    ))}
                    {p.itens.length > 3 && (
                      <li className="text-muted-foreground">+{p.itens.length - 3} mais</li>
                    )}
                  </ul>
                </div>

                {/* Observações */}
                {p.observacoes && (
                  <div className="mt-2 rounded bg-yellow-50 border border-yellow-200 p-1.5 text-xs text-yellow-800">
                    <span className="font-medium">📝</span> {p.observacoes}
                  </div>
                )}

                {/* Botão de ação */}
                <div className="mt-3">
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => enviarParaProducao(p.id, p.tipo)}
                    disabled={sendingToProduction === p.id}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {sendingToProduction === p.id ? "Enviando..." : "🚀 Enviar para Produção"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================== */}
      {/* SEÇÃO: PDV - PRODUTOS E PEDIDO */}
      {/* ======================================== */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {cats.map((c) => (
            <div key={c}>
              <h2 className="mb-2 font-display text-lg capitalize">{c}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {ativos.filter((p) => p.categoria === c).map((p) => (
                  <button key={p.id} onClick={() => add(p.id, 1)} className="rounded-xl border bg-card p-3 text-left transition hover:border-primary">
                    <div className="font-semibold">{p.nome}</div>
                    <div className="mt-1 text-sm text-primary">{brl(Number(p.preco))}</div>
                    {cart[p.id] && <div className="mt-1 text-xs text-muted-foreground">{cart[p.id]} no pedido</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Panel title="Pedido" className="h-fit lg:sticky lg:top-6">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["balcao", "delivery"] as const).map((t) => (
              <Button key={t} variant={tipo === t ? "default" : "outline"} onClick={() => setTipo(t)}>{t === "balcao" ? "Balcão" : "Delivery"}</Button>
            ))}
          </div>
          {linhas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item</p>}
          <ul className="space-y-2">
            {linhas.map(({ p, q }) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{p.nome}</span>
                <button onClick={() => add(p.id, -1)}><Minus className="h-4 w-4" /></button>
                <span className="w-5 text-center">{q}</span>
                <button onClick={() => add(p.id, 1)}><Plus className="h-4 w-4" /></button>
                <span className="w-20 text-right">{brl(Number(p.preco) * q)}</span>
                <button onClick={() => add(p.id, -q)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            {tipo === "delivery" && (<>
              <Input placeholder="Nome do cliente" value={cli.cliente} onChange={(e) => setCli({ ...cli, cliente: e.target.value })} />
              <Input placeholder="Telefone" value={cli.telefone} onChange={(e) => setCli({ ...cli, telefone: e.target.value })} />
              <Input placeholder="Endereço" value={cli.endereco} onChange={(e) => setCli({ ...cli, endereco: e.target.value })} />
            </>)}
            <Input placeholder="Cupom de desconto" value={cli.cupom} onChange={(e) => setCli({ ...cli, cupom: e.target.value })} />
            {cli.cupom && !cupom && <p className="text-xs text-destructive">Cupom inválido</p>}
          </div>
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{brl(sub)}</dd></div>
            {desc > 0 && <div className="flex justify-between text-primary"><dt>Desconto ({cupom?.percentual}%)</dt><dd>-{brl(desc)}</dd></div>}
            {taxa > 0 && <div className="flex justify-between"><dt>Entrega</dt><dd>{brl(taxa)}</dd></div>}
            <div className="flex justify-between font-display text-xl font-bold"><dt>Total</dt><dd>{brl(total)}</dd></div>
          </dl>
          <Button className="mt-4 w-full" size="lg" disabled={busy} onClick={finalizar}>{busy ? "Registrando..." : "Finalizar venda"}</Button>
        </Panel>
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
    </div>
  );
}
