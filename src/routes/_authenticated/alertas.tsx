import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { diasParaVencer, ingredientesQ, num } from "@/lib/data";
import { PageHeader, Panel, RouteError } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — PizzaStockAI" }, { name: "description", content: "Ingredientes vencidos, vencendo ou abaixo do mínimo." }, { property: "og:title", content: "Alertas — PizzaStockAI" }, { property: "og:description", content: "Alertas de estoque da pizzaria." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ingredientesQ),
  errorComponent: RouteError,
  component: Alertas,
});

function Alertas() {
  const { data: ings } = useSuspenseQuery(ingredientesQ);
  const vencidos = ings.filter((i) => diasParaVencer(i.validade) < 0);
  const vencendo = ings.filter((i) => { const d = diasParaVencer(i.validade); return d >= 0 && d <= 3; });
  const zerados = ings.filter((i) => Number(i.quantidade) <= 0);
  const baixos = ings.filter((i) => Number(i.quantidade) > 0 && Number(i.quantidade) <= Number(i.estoque_minimo));
  const grupos = [
    { t: "Vencidos — não podem ser usados", l: vencidos, f: (i: (typeof ings)[number]) => `venceu há ${-diasParaVencer(i.validade)} dia(s)`, c: "border-destructive" },
    { t: "Vencendo em até 3 dias", l: vencendo, f: (i: (typeof ings)[number]) => `vence em ${diasParaVencer(i.validade)} dia(s)`, c: "border-primary" },
    { t: "Sem estoque", l: zerados, f: () => "zerado", c: "border-destructive" },
    { t: "Abaixo do mínimo", l: baixos, f: (i: (typeof ings)[number]) => `${num(Number(i.quantidade))} ${i.unidade} (mín. ${num(Number(i.estoque_minimo))})`, c: "border-primary" },
  ];
  const total = grupos.reduce((s, g) => s + g.l.length, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Alertas" sub={total ? `${total} alerta(s) precisam de atenção` : "Tudo certo no estoque 🎉"} />
      {grupos.filter((g) => g.l.length).map((g) => (
        <Panel key={g.t} title={`${g.t} (${g.l.length})`} className={`border-l-4 ${g.c}`}>
          <ul className="space-y-1 text-sm">{g.l.map((i) => <li key={i.id} className="flex justify-between"><span>{i.nome}</span><span className="text-muted-foreground">{g.f(i)}</span></li>)}</ul>
        </Panel>
      ))}
      <Link to="/estoque" className="inline-block text-sm text-primary">Ir para o estoque →</Link>
    </div>
  );
}
