import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({ meta: [{ title: "Config — PizzaStockAI" }, { name: "description", content: "Config da pizzaria." }, { property: "og:title", content: "Config — PizzaStockAI" }, { property: "og:description", content: "Config da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Config</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
