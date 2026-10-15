import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cardapio")({
  head: () => ({ meta: [{ title: "Cardapio — PizzaStockAI" }, { name: "description", content: "Cardapio da pizzaria." }, { property: "og:title", content: "Cardapio — PizzaStockAI" }, { property: "og:description", content: "Cardapio da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Cardapio</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
