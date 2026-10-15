import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, configQ, cuponsQ, produtosQ } from "@/lib/data";
import { PageHeader, Panel, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "PDV — PizzaStockAI" }, { name: "description", content: "Ponto de venda de balcão e delivery." }, { property: "og:title", content: "PDV — PizzaStockAI" }, { property: "og:description", content: "Ponto de venda da pizzaria." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(produtosQ), context.queryClient.ensureQueryData(configQ), context.queryClient.ensureQueryData(cuponsQ)]),
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

  const ativos = produtos.filter((p) => p.ativo);
  const cats = [...new Set(ativos.map((p) => p.categoria))];
  const add = (id: string, d: number) => setCart((c) => { const q = (c[id] ?? 0) + d; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });
  const linhas = Object.entries(cart).map(([id, q]) => ({ p: produtos.find((x) => x.id === id)!, q })).filter((l) => l.p);
  const sub = linhas.reduce((s, l) => s + Number(l.p.preco) * l.q, 0);
  const cupom = cupons.find((c) => c.ativo && c.codigo.toUpperCase() === cli.cupom.trim().toUpperCase());
  const desc = cupom ? sub * Number(cupom.percentual) / 100 : 0;
  const taxa = tipo === "delivery" ? Number(config.taxa_entrega) : 0;
  const total = sub - desc + taxa;

  async function finalizar() {
    if (!linhas.length) return toast.error("Adicione itens ao pedido");
    if (tipo === "delivery" && (!cli.cliente || !cli.endereco)) return toast.error("Informe nome e endereço para delivery");
    setBusy(true);
    const { error } = await supabase.rpc("registrar_venda", {
      _itens: linhas.map((l) => ({ produto_id: l.p.id, quantidade: l.q })),
      _tipo: tipo, _cliente: cli.cliente || undefined, _telefone: cli.telefone || undefined,
      _endereco: cli.endereco || undefined, _cupom: cli.cupom.trim() || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Venda registrada!");
    setCart({}); setCli({ cliente: "", telefone: "", endereco: "", cupom: "" });
    qc.invalidateQueries({ queryKey: ["vendas"] }); qc.invalidateQueries({ queryKey: ["ingredientes"] });
  }

  return (
    <div>
      <PageHeader title="PDV" sub="Toque nos produtos para montar o pedido" />
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
    </div>
  );
}
