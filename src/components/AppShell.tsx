import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ShoppingCart, Bike, Package, Pizza, Wallet, Brain, Bell, Settings, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Clock } from "./Clock";
import { OrderBell } from "./OrderBell";

const nav = [
  { to: "/dashboard", label: "Central", icon: LayoutDashboard },
  { to: "/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/delivery", label: "Delivery", icon: Bike },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/cardapio", label: "Cardápio", icon: Pizza },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, manager: true },
  { to: "/previsoes", label: "Previsões", icon: Brain, manager: true },
  { to: "/equipe", label: "Equipe", icon: Users, manager: true },
  { to: "/config", label: "Configurações", icon: Settings, manager: true },
] as const;

export function AppShell() {
  const { role, email, isManager } = useRole();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function sair() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6 font-display text-lg font-bold text-sidebar-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ember-gradient">🍕</span> PizzaStockAI
        </div>
        <nav className="flex-1 space-y-1">
          {nav.filter((n) => !("manager" in n) || isManager).map((n) => (
            <Link key={n.to} to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-primary font-semibold" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <div className="truncate">{email}</div>
          <div className="mt-1 capitalize text-primary">{role ?? "sem perfil"}</div>
          <button onClick={sair} className="mt-3 flex items-center gap-2 text-sidebar-foreground hover:text-primary"><LogOut className="h-4 w-4" /> Sair</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-6 py-3">
          <div className="flex gap-1 overflow-x-auto md:hidden">
            {nav.filter((n) => !("manager" in n) || isManager).map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md p-2 text-muted-foreground" activeProps={{ className: "text-primary" }}><n.icon className="h-4 w-4" /></Link>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <OrderBell />
          </div>
          <div className="flex items-center gap-3">
            <Clock />
          </div>
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
