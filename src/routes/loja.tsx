import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingCart, Store, Image, Clock3 } from "lucide-react";
import { brl, configQ, produtosQ } from "@/lib/data";
import { lojaAberta } from "@/components/Clock";
import { registrarVendaOnline } from "@/lib/loja-online.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FOTOS_PADRAO: Record<string, string> = {
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
  bebida: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  refrigerante: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  suco: "https://images.unsplash.com/photo-1600271886742-f049cd451bba",
  sobremesa: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  entrada: "https://images.unsplash.com/photo-1528735602780-2552fd1b1d59?w=400&h=300&fit=crop",
  combo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
};

function getFoto(p: { foto_url?: string | null; categoria?: string }) {
  const cat = p.categoria?.toLowerCase();
  return p.foto_url || (cat ? FOTOS_PADRAO[cat] : undefined) || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop";
}

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Loja Online — PizzaStockAI" },
      { name: "description", content: "Faça seu pedido online e receba no conforto da sua casa." },
      { property: "og:title", content: "Loja Online — PizzaStockAI" },
      { property: "og:description", content: "Peça suas pizzas e acompanhamentos online." },
    ],
  }),
  component: LojaOnline,
});

function LojaOnline() {
  const { data: produtos, isLoading } = useQuery(produtosQ);
  const { data: config } = useQuery(configQ);
  const qc = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cliente, setCliente] = useState({ nome: "", telefone: "", endereco: "" });
  const [busy, setBusy] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const ativos = produtos?.filter((p) => p.ativo) ?? [];
  const cats = [...new Set(ativos.map((p) => p.categoria))];

  const add = (id: string, d: number) => {
    setCart((c) => {
      const q = (c[id] ?? 0) + d;
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  };

  const linhas = Object.entries(cart).map(([id, q]) => ({
    p: ativos.find((x) => x.id === id)!,
    q,
  })).filter((l) => l.p);

  const totalItens = Object.values(cart).reduce((s, q) => s + q, 0);
  const sub = linhas.reduce((s, l) => s + Number(l.p.preco) * l.q, 0);

  async function finalizar() {
    if (!linhas.length) {
      toast.error("Adicione itens ao pedido");
      return;
    }
    if (!cliente.nome.trim() || !cliente.endereco.trim()) {
      toast.error("Informe seu nome e endereço");
      return;
    }
    setBusy(true);

    try {
      const telefone = cliente.telefone.trim();
      const vendaId = await registrarVendaOnline({
        itens: linhas.map((l) => ({ produto_id: l.p.id, quantidade: l.q })),
        cliente: cliente.nome.trim(),
        endereco: cliente.endereco.trim(),
        telefone: telefone || undefined,
      });

      toast.success("Pedido realizado com sucesso! 🎉");
      setCart({});
      setCliente({ nome: "", telefone: "", endereco: "" });
      setShowCart(false);
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["ingredientes"] });

      // Redirecionar para a página de pagamento
      if (vendaId) {
        window.location.href = `/pagamento/${vendaId}`;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao registrar pedido";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Store className="mx-auto h-12 w-12 text-primary animate-pulse" />
          <p className="mt-4 text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hearth">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ember-gradient text-primary-foreground">🍕</span>
            PizzaStockAI
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm hover:border-primary"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItens > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {totalItens}
              </span>
            )}
            Carrinho
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Peça online, <span className="text-primary">receba em casa.</span>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Escolha seus produtos e finalize o pedido em segundos.
          </p>

          {/* Horário de funcionamento */}
          {config && (() => {
            const cfg = config as { abre: string; fecha: string; aberta_manual: boolean | null };
            const abre = cfg.abre.slice(0, 5);
            const fecha = cfg.fecha.slice(0, 5);
            const now = new Date();
            const aberta = lojaAberta(cfg.abre, cfg.fecha, cfg.aberta_manual, now);
            return (
              <div className="mt-5 inline-flex items-center gap-3 rounded-xl border bg-card px-5 py-3">
                <Clock3 className={`h-5 w-5 ${aberta ? "text-success" : "text-destructive"}`} />
                <div className="text-left">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aberta ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                      {aberta ? "Aberto agora" : "Fechado agora"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Funcionamento: {abre} — {fecha}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Produtos */}
          <div className="space-y-8">
            {cats.map((c) => (
              <div key={c}>
                <h2 className="mb-3 font-display text-xl capitalize">{c}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ativos.filter((p) => p.categoria === c).map((p) => (
                    <div
                      key={p.id}
                      className="group overflow-hidden rounded-xl border bg-card transition hover:border-primary hover:shadow-lg"
                    >
                      {/* Foto do produto */}
                      <div className="relative h-44 overflow-hidden bg-muted">
                        <img
                          src={getFoto(p)}
                          alt={p.nome}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FOTOS_PADRAO[p.categoria?.toLowerCase()] || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop";
                          }}
                        />
                        {cart[p.id] && (
                          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg">
                            {cart[p.id]}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="font-semibold text-lg">{p.nome}</div>
                        {p.descricao && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.descricao}</p>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="font-display text-xl font-bold text-primary">
                            {brl(Number(p.preco))}
                          </span>
                          <div className="flex items-center gap-2">
                            {cart[p.id] ? (
                              <>
                                <button onClick={() => add(p.id, -1)} className="rounded-md border p-1 hover:bg-muted">
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-8 text-center font-semibold">{cart[p.id]}</span>
                                <button onClick={() => add(p.id, 1)} className="rounded-md border p-1 hover:bg-muted">
                                  <Plus className="h-4 w-4" />
                                </button>
                                <button onClick={() => { const qty = cart[p.id]; if (qty !== undefined) add(p.id, -qty); }} className="rounded-md p-1 text-destructive hover:bg-muted">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <Button size="sm" onClick={() => add(p.id, 1)}>
                                <Plus className="mr-1 h-4 w-4" /> Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Carrinho lateral */}
          <div className={`lg:sticky lg:top-24 lg:h-fit ${showCart ? "block" : "hidden lg:block"}`}>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 font-display text-lg font-semibold">Seu Pedido</h2>

              {linhas.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Seu carrinho está vazio. Adicione produtos para começar!
                </p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {linhas.map(({ p, q }) => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                          <img
                            src={getFoto(p)}
                            alt={p.nome}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FOTOS_PADRAO[p.categoria?.toLowerCase()] || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop";
                            }}
                          />
                        </div>
                        <span className="flex-1 font-medium min-w-0 truncate">{p.nome}</span>
                        <button onClick={() => add(p.id, -1)} className="rounded p-1 hover:bg-muted">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center">{q}</span>
                        <button onClick={() => add(p.id, 1)} className="rounded p-1 hover:bg-muted">
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="w-20 text-right font-medium flex-shrink-0">{brl(Number(p.preco) * q)}</span>
                        <button onClick={() => add(p.id, -q)} className="text-destructive hover:bg-muted rounded p-1 flex-shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 border-t pt-3">
                    <div className="flex justify-between font-display text-xl font-bold">
                      <span>Total</span>
                      <span>{brl(sub)}</span>
                    </div>
                  </div>

                  {/* Dados do cliente */}
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold">Seus dados para entrega</h3>
                    <Input
                      placeholder="Seu nome completo"
                      value={cliente.nome}
                      onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                    />
                    <Input
                      placeholder="Telefone / WhatsApp"
                      value={cliente.telefone}
                      onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
                    />
                    <Input
                      placeholder="Endereço completo com número"
                      value={cliente.endereco}
                      onChange={(e) => setCliente({ ...cliente, endereco: e.target.value })}
                    />
                  </div>

                  <Button
                    className="mt-4 w-full"
                    size="lg"
                    disabled={busy}
                    onClick={finalizar}
                  >
                    {busy ? "Enviando pedido..." : "Finalizar Pedido"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
