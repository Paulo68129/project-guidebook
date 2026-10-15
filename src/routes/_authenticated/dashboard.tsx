import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PizzaStockAI" }, { name: "description", content: "Dashboard da pizzaria." }, { property: "og:title", content: "Dashboard — PizzaStockAI" }, { property: "og:description", content: "Dashboard da pizzaria." }] }),
  component: () => (
    <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="mt-2 text-muted-foreground">Esta tela ainda será construída.</p></div>
  ),
});
