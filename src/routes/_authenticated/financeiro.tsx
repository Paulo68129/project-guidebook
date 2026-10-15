import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — PizzaStockAI" }, { name: "description", content: "Financeiro da pizzaria." }, { property: "og:title", content: "Financeiro — PizzaStockAI" }, { property: "og:description", content: "Financeiro da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Financeiro</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
