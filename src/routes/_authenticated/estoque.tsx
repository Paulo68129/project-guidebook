import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — PizzaStockAI" }, { name: "description", content: "Estoque da pizzaria." }, { property: "og:title", content: "Estoque — PizzaStockAI" }, { property: "og:description", content: "Estoque da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Estoque</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
