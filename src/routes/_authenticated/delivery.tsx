import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, motoboysQ, vendasQ } from "@/lib/data";
import { PageHeader, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

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

function Delivery() {
  const { data: vendas } = useSuspenseQuery(vendasQ(2));
  const { data: motoboys } = useSuspenseQuery(motoboysQ);
  const qc = useQueryClient();
  const pedidos = vendas.filter((v) => v.tipo === "delivery");

  async function update(id: string, patch: { status?: string; motoboy_id?: string | null }) {
    const { error } = await supabase.from("vendas").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vendas"] });
  }

  return (
    <div>
      <PageHeader title="Delivery" sub="Pedidos das últimas 48h — atualiza sozinho" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cols.map((c) => {
          const list = pedidos.filter((p) => p.status === c.s);
          return (
            <div key={c.s} className="rounded-xl border bg-muted/30 p-3">
              <h2 className="mb-3 font-display font-semibold">{c.t} <span className="text-muted-foreground">({list.length})</span></h2>
              <div className="space-y-3">
                {list.slice(0, c.s === "entregue" ? 10 : 100).map((p) => (
                  <div key={p.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="flex justify-between font-semibold"><span>#{p.numero} {p.cliente}</span><span>{brl(Number(p.total))}</span></div>
                    <div className="text-xs text-muted-foreground">{p.endereco} · {p.telefone}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                    <ul className="mt-2 text-xs">{p.venda_itens.map((i) => <li key={i.id}>{i.quantidade}× {i.nome}</li>)}</ul>
                    {c.s !== "entregue" && (
                      <select className="mt-2 w-full rounded border bg-background p-1 text-xs" value={p.motoboy_id ?? ""} onChange={(e) => update(p.id, { motoboy_id: e.target.value || null })}>
                        <option value="">Sem motoboy</option>
                        {motoboys.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    )}
                    {c.next && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => update(p.id, { status: c.next! })}>{c.btn}</Button>
                        <Button size="sm" variant="ghost" onClick={() => update(p.id, { status: "cancelado" })}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
