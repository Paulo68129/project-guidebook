import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, dayKey, ingredientesQ, num, receitasQ, serieDiaria, vendasQ } from "@/lib/data";
import { forecast, sugestaoCompra } from "@/lib/forecast";
import { PageHeader, Panel, RouteError, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/previsoes")({
  head: () => ({ meta: [{ title: "Previsões — PizzaStockAI" }, { name: "description", content: "Previsão de demanda e sugestão de compras de ingredientes." }, { property: "og:title", content: "Previsões — PizzaStockAI" }, { property: "og:description", content: "Previsão de demanda da pizzaria." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(vendasQ(60)), context.queryClient.ensureQueryData(ingredientesQ), context.queryClient.ensureQueryData(receitasQ)]),
  errorComponent: RouteError,
  component: Previsoes,
});

function Previsoes() {
  const { data: vendas } = useSuspenseQuery(vendasQ(60));
  const { data: ings } = useSuspenseQuery(ingredientesQ);
  const { data: receitas } = useSuspenseQuery(receitasQ);
  const [h, setH] = useState(7);

  const hist = serieDiaria(vendas, 30);
  const prevPed = forecast(hist.map((d) => d.pedidos), h);
  const prevFat = forecast(hist.map((d) => d.faturamento), h);
  const chart = [
    ...hist.map((d) => ({ dia: d.dia.slice(5), real: d.pedidos, previsto: null as number | null })),
    ...prevPed.map((p, i) => ({ dia: dayKey(new Date(Date.now() + (i + 1) * 86400000)).slice(5), real: null as number | null, previsto: +p.toFixed(1) })),
  ];

  // consumo diário de cada ingrediente nos últimos 30 dias
  const dias = hist.map((d) => d.dia);
  const consumo = new Map<string, number[]>(ings.map((i) => [i.id, dias.map(() => 0)]));
  for (const v of vendas) {
    if (v.status === "cancelado") continue;
    const idx = dias.indexOf(dayKey(new Date(v.created_at)));
    if (idx < 0) continue;
    for (const it of v.venda_itens) for (const r of receitas.filter((x) => x.produto_id === it.produto_id)) {
      const arr = consumo.get(r.ingrediente_id); if (arr) arr[idx] = (arr[idx] ?? 0) + Number(r.quantidade) * it.quantidade;
    }
  }
  const sugestoes = ings.map((i) => {
    const previsto = forecast(consumo.get(i.id) ?? [], h).reduce((a, b) => a + b, 0);
    const comprar = sugestaoCompra(previsto, Number(i.quantidade), Number(i.estoque_minimo));
    return { i, previsto, comprar, valor: comprar * Number(i.custo_unitario) };
  }).sort((a, b) => b.valor - a.valor);
  const totalCompra = sugestoes.reduce((s, x) => s + x.valor, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Previsões" sub="Tendência calculada a partir dos últimos 30 dias de vendas">
        <div className="flex gap-2">{[7, 14].map((d) => <Button key={d} size="sm" variant={h === d ? "default" : "outline"} onClick={() => setH(d)}>Próximos {d} dias</Button>)}</div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pedidos previstos" value={num(prevPed.reduce((a, b) => a + b, 0), 0)} />
        <Stat label="Faturamento previsto" value={brl(prevFat.reduce((a, b) => a + b, 0))} />
        <Stat label="Compra sugerida" value={brl(totalCompra)} tone={totalCompra ? "warn" : "ok"} />
      </div>
      <Panel title="Pedidos por dia: real e previsto">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Line dataKey="real" stroke="var(--foreground)" dot={false} />
              <Line dataKey="previsto" stroke="var(--primary)" strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Lista de compras sugerida">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Ingrediente</th><th>Em estoque</th><th>Consumo previsto</th><th>Comprar</th><th className="text-right">Valor</th></tr></thead>
          <tbody>
            {sugestoes.filter((s) => s.comprar > 0).map(({ i, previsto, comprar, valor }) => (
              <tr key={i.id} className="border-t"><td className="py-2">{i.nome}</td><td>{num(Number(i.quantidade))} {i.unidade}</td><td>{num(previsto)} {i.unidade}</td><td className="font-semibold text-primary">{num(comprar)} {i.unidade}</td><td className="text-right">{brl(valor)}</td></tr>
            ))}
          </tbody>
        </table>
        {!sugestoes.some((s) => s.comprar > 0) && <p className="text-sm text-muted-foreground">Estoque suficiente para o período.</p>}
      </Panel>
    </div>
  );
}
