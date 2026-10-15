import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { LayoutDashboard, ShoppingCart, Bike, Package, Pizza, Wallet, Brain, Bell, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { Clock } from "./Clock";

const nav = [
  { to: "/dashboard", label: "Central", icon: LayoutDashboard },
  { to: "/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/delivery", label: "Delivery", icon: Bike },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/cardapio", label: "Cardápio", icon: Pizza },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, manager: true },
  { to: "/previsoes", label: "Previsões", icon: Brain, manager: true },
  { to: "/config", label: "Configurações", icon: Settings, manager: true },
] as const;

export function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.15);
    });
  } catch { /* sem áudio */ }
}

export function AppShell() {
  const { role, email, isManager } = useRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const somRef = useRef(true);

  useEffect(() => {
    supabase.from("loja_config").select("som_alerta").eq("id", 1).single().then(({ data }) => { somRef.current = data?.som_alerta ?? true; });
    const ch = supabase.channel("vendas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, (p) => {
        qc.invalidateQueries({ queryKey: ["vendas"] });
        qc.invalidateQueries({ queryKey: ["ingredientes"] });
        const row = p.new as { tipo?: string; numero?: number } | null;
        if (p.eventType === "INSERT" && row?.tipo === "delivery") {
          toast.info(`Novo pedido de delivery #${row.numero}`);
          if (somRef.current) beep();
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

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
          <div className="hidden md:block" />
          <Clock />
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
