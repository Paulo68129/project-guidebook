import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { brl, serieDiaria, vendasQ } from "@/lib/data";
import { PageHeader, Panel, RouteError, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — PizzaStockAI" }, { name: "description", content: "Faturamento, custos, lucro e ticket médio." }, { property: "og:title", content: "Financeiro — PizzaStockAI" }, { property: "og:description", content: "Resultados financeiros da pizzaria." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(vendasQ(90)),
  errorComponent: RouteError,
  component: Financeiro,
});

function Financeiro() {
  const { data: vendas } = useSuspenseQuery(vendasQ(90));
  const [dias, setDias] = useState(30);
  const desde = Date.now() - dias * 86400000;
  const v = vendas.filter((x) => x.status !== "cancelado" && new Date(x.created_at).getTime() >= desde);
  const fat = v.reduce((s, x) => s + Number(x.total), 0);
  const custo = v.reduce((s, x) => s + Number(x.custo), 0);
  const lucro = v.reduce((s, x) => s + Number(x.lucro), 0);
  const desc = v.reduce((s, x) => s + Number(x.desconto), 0);
  const deliv = v.filter((x) => x.tipo === "delivery");
  const serie = serieDiaria(vendas, dias).map((d) => ({ dia: d.dia.slice(5), Faturamento: +d.faturamento.toFixed(2), Lucro: +d.lucro.toFixed(2) }));

  function exportar() {
    const linhas = [["numero", "data", "tipo", "status", "subtotal", "desconto", "taxa", "total", "custo", "lucro"], ...v.map((x) => [x.numero, x.created_at, x.tipo, x.status, x.subtotal, x.desconto, x.taxa_entrega, x.total, x.custo, x.lucro])];
    const blob = new Blob([linhas.map((l) => l.join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `vendas-${dias}d.csv`; a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" sub={`Últimos ${dias} dias`}>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>{d} dias</Button>)}
          <Button size="sm" variant="outline" onClick={exportar}>Exportar CSV</Button>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Faturamento" value={brl(fat)} hint={`${v.length} pedidos`} />
        <Stat label="Custo dos produtos" value={brl(custo)} />
        <Stat label="Lucro" value={brl(lucro)} hint={fat ? `Margem ${((lucro / fat) * 100).toFixed(0)}%` : ""} />
        <Stat label="Ticket médio" value={brl(v.length ? fat / v.length : 0)} hint={`${deliv.length} deliveries · ${brl(desc)} em descontos`} />
      </div>
      <Panel title="Faturamento x lucro por dia">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(x: number) => brl(x)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Legend />
              <Bar dataKey="Faturamento" fill="var(--primary)" />
              <Bar dataKey="Lucro" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
