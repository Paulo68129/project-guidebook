import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { configQ } from "@/lib/data";

export function lojaAberta(abre: string, fecha: string, manual: boolean | null, now = new Date()) {
  if (manual !== null) return manual;
  const hm = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false }).slice(0, 5);
  const a = abre.slice(0, 5), f = fecha.slice(0, 5);
  return a <= f ? hm >= a && hm <= f : hm >= a || hm <= f;
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  const { data } = useQuery(configQ);
  const cfg = data as { abre: string; fecha: string; aberta_manual: boolean | null } | undefined;
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  if (!now) return null;
  const aberta = cfg ? lojaAberta(cfg.abre, cfg.fecha, cfg.aberta_manual, now) : null;
  return (
    <div className="flex items-center gap-3 text-sm">
      {aberta !== null && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aberta ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
          {aberta ? "Aberto" : "Fechado"}
        </span>
      )}
      <span className="tabular-nums text-muted-foreground">
        {now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" })} · Brasília
      </span>
    </div>
  );
}
