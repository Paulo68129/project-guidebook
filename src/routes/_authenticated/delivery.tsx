import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({ meta: [{ title: "Delivery — PizzaStockAI" }, { name: "description", content: "Delivery da pizzaria." }, { property: "og:title", content: "Delivery — PizzaStockAI" }, { property: "og:description", content: "Delivery da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Delivery</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
