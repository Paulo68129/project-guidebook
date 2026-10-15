import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — PizzaStockAI" }, { name: "description", content: "Alertas da pizzaria." }, { property: "og:title", content: "Alertas — PizzaStockAI" }, { property: "og:description", content: "Alertas da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Alertas</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
