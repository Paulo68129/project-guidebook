import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/previsoes")({
  head: () => ({ meta: [{ title: "Previsoes — PizzaStockAI" }, { name: "description", content: "Previsoes da pizzaria." }, { property: "og:title", content: "Previsoes — PizzaStockAI" }, { property: "og:description", content: "Previsoes da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Previsoes</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
