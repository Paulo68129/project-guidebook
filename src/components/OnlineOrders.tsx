import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/data";
import type { OnlineOrder } from "@/lib/online-order";
import { OrderReceipt } from "./OrderReceipt";

export function OnlineOrders() {
  const q = useQuery({ queryKey: ["pedidos-online"], refetchInterval: 10000, queryFn: async () => {
    const { data, error } = await supabase.from("pedidos_online").select("id,cliente,telefone,endereco,itens,subtotal,desconto,taxa_entrega,total,status,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data as unknown as OnlineOrder[];
  } });
  return <section className="mb-8 border-b pb-6">
    <h2 className="mb-4 font-display text-xl">Pedidos online · Aguardando pagamento</h2>
    {q.isPending && <p className="text-muted-foreground">Carregando pedidos…</p>}
    {q.isError && <p className="text-destructive">Não foi possível carregar os pedidos online.</p>}
    {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido online recebido.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data?.map((p) => <article key={p.id} className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>{p.cliente}</span><span>{brl(Number(p.total))}</span></div>
      <p className="my-2 text-sm text-warning">Não pago · Não iniciar preparo</p>
      <details><summary className="cursor-pointer text-sm text-primary">Itens e comprovante</summary><div className="mt-3"><OrderReceipt order={p} /></div></details>
    </article>)}</div>
  </section>;
}