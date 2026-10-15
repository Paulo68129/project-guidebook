import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "Pdv — PizzaStockAI" }, { name: "description", content: "Pdv da pizzaria." }, { property: "og:title", content: "Pdv — PizzaStockAI" }, { property: "og:description", content: "Pdv da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Pdv</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
