import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, diasParaVencer, ingredientesQ, serieDiaria, vendasQ, dayKey } from "@/lib/data";
import { PageHeader, Panel, RouteError, Stat } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Central — PizzaStockAI" }, { name: "description", content: "Resumo do dia da pizzaria: vendas, lucro e alertas." }, { property: "og:title", content: "Central — PizzaStockAI" }, { property: "og:description", content: "Resumo do dia da pizzaria." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(vendasQ(30)), context.queryClient.ensureQueryData(ingredientesQ)]),
  errorComponent: RouteError,
  component: Dashboard,
});

function Dashboard() {
  const { data: vendas } = useSuspenseQuery(vendasQ(30));
  const { data: ings } = useSuspenseQuery(ingredientesQ);
  const hoje = dayKey(new Date());
  const vHoje = vendas.filter((v) => v.status !== "cancelado" && dayKey(new Date(v.created_at)) === hoje);
  const fat = vHoje.reduce((s, v) => s + Number(v.total), 0);
  const lucro = vHoje.reduce((s, v) => s + Number(v.lucro), 0);
  const baixo = ings.filter((i) => Number(i.quantidade) <= Number(i.estoque_minimo));
  const vencendo = ings.filter((i) => diasParaVencer(i.validade) <= 3);
  const abertos = vendas.filter((v) => v.tipo === "delivery" && !["entregue", "cancelado"].includes(v.status));
  const serie = serieDiaria(vendas, 14).map((d) => ({ ...d, dia: d.dia.slice(5) }));
  const top = new Map<string, number>();
  vendas.forEach((v) => v.status !== "cancelado" && v.venda_itens.forEach((i) => top.set(i.nome, (top.get(i.nome) ?? 0) + i.quantidade)));
  const ranking = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Central" sub="Como está a pizzaria hoje" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Faturamento hoje" value={brl(fat)} hint={`${vHoje.length} pedidos`} />
        <Stat label="Lucro hoje" value={brl(lucro)} />
        <Stat label="Deliveries em aberto" value={abertos.length} tone={abertos.length ? "warn" : "ok"} />
        <Stat label="Alertas de estoque" value={baixo.length + vencendo.length} tone={baixo.length + vencendo.length ? "bad" : "ok"} hint={`${baixo.length} baixo · ${vencendo.length} vencendo`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Faturamento — 14 dias" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip formatter={((v: number) => [brl(v), '']) as any} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Area dataKey="faturamento" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Mais vendidos (30 dias)">
          <ol className="space-y-2 text-sm">
            {ranking.map(([n, q], i) => (
              <li key={n} className="flex justify-between"><span>{i + 1}. {n}</span><span className="text-muted-foreground">{q} un.</span></li>
            ))}
          </ol>
        </Panel>
      </div>
      {(baixo.length > 0 || vencendo.length > 0) && (
        <Panel title="Atenção no estoque">
          <ul className="space-y-1 text-sm">
            {baixo.map((i) => <li key={i.id}>⚠️ {i.nome}: {i.quantidade} {i.unidade} (mínimo {i.estoque_minimo})</li>)}
            {vencendo.map((i) => <li key={"v" + i.id}>⏰ {i.nome} vence em {diasParaVencer(i.validade)} dia(s)</li>)}
          </ul>
          <Link to="/estoque" className="mt-3 inline-block text-sm text-primary">Ir para o estoque →</Link>
        </Panel>
      )}
    </div>
  );
}
