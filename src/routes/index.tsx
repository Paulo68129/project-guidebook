import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Flame, Package, Bike, LineChart, Brain, ShieldCheck, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PizzaStockAI — Gestão inteligente para pizzarias" },
      { name: "description", content: "Controle estoque, vendas, delivery e finanças da sua pizzaria com previsão de demanda." },
      { property: "og:title", content: "PizzaStockAI — Gestão inteligente para pizzarias" },
      { property: "og:description", content: "Estoque, PDV, delivery e previsão de demanda em um só lugar." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Package, t: "Estoque vivo", d: "Baixa automática por receita, validade e estoque mínimo." },
  { icon: Flame, t: "PDV rápido", d: "Venda balcão ou delivery com validação atômica de insumos." },
  { icon: Bike, t: "Delivery", d: "Pedidos em tempo real, motoboys, cupons e alertas sonoros." },
  { icon: LineChart, t: "Dashboard", d: "Faturamento, ticket médio, CMV, ranking e horários de pico." },
  { icon: Brain, t: "Previsão", d: "Regressão linear sobre o histórico para sugerir compras." },
  { icon: ShieldCheck, t: "Perfis", d: "Administrador, gerente e atendente com acessos distintos." },
];

function Index() {
  return (
    <div className="min-h-screen bg-hearth">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ember-gradient text-primary-foreground">🍕</span>
          PizzaStockAI
        </div>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Forno aceso, números na mão</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
          A gestão da sua pizzaria, <span className="text-primary">assada no ponto.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Menos desperdício, nenhuma ruptura no pico e compras guiadas por previsão de demanda.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg" className="bg-ember-gradient shadow-glow"><Link to="/loja">
            <ShoppingCart className="mr-2 h-5 w-5" /> Peça Online
          </Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth">Acessar o sistema</Link></Button>
        </div>
        <div className="mt-24 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-xl border bg-card/70 p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
