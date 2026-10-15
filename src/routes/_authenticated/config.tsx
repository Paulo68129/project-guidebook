import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { configQ, cuponsQ, motoboysQ } from "@/lib/data";
import { PageHeader, Panel, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/config")({
  head: () => ({ meta: [{ title: "Configurações — PizzaStockAI" }, { name: "description", content: "Horários, taxa de entrega, motoboys e cupons." }, { property: "og:title", content: "Configurações — PizzaStockAI" }, { property: "og:description", content: "Configurações da pizzaria." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(configQ), context.queryClient.ensureQueryData(motoboysQ), context.queryClient.ensureQueryData(cuponsQ)]),
  errorComponent: RouteError,
  component: Config,
});

function Config() {
  const { data: cfg } = useSuspenseQuery(configQ);
  const { data: motoboys } = useSuspenseQuery(motoboysQ);
  const { data: cupons } = useSuspenseQuery(cuponsQ);
  const qc = useQueryClient();
  const [loja, setLoja] = useState({ abre: cfg.abre.slice(0, 5), fecha: cfg.fecha.slice(0, 5), taxa: String(cfg.taxa_entrega), som: cfg.som_alerta });
  const [moto, setMoto] = useState({ nome: "", telefone: "" });
  const [cup, setCup] = useState({ codigo: "", percentual: "10" });
  const done = (k: string) => (r: { error: { message: string } | null }) => { if (r.error) toast.error(r.error.message); else { toast.success("Salvo"); qc.invalidateQueries({ queryKey: [k] }); } };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />
      <Panel title="Loja">
        <div className="grid max-w-xl grid-cols-2 gap-3 text-sm">
          <label>Abre às<Input type="time" value={loja.abre} onChange={(e) => setLoja({ ...loja, abre: e.target.value })} /></label>
          <label>Fecha às<Input type="time" value={loja.fecha} onChange={(e) => setLoja({ ...loja, fecha: e.target.value })} /></label>
          <label>Taxa de entrega (R$)<Input type="number" step="0.01" value={loja.taxa} onChange={(e) => setLoja({ ...loja, taxa: e.target.value })} /></label>
          <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={loja.som} onChange={(e) => setLoja({ ...loja, som: e.target.checked })} /> Som ao chegar delivery</label>
          <Button className="col-span-2" onClick={() => supabase.from("loja_config").update({ abre: loja.abre, fecha: loja.fecha, taxa_entrega: Number(loja.taxa), som_alerta: loja.som }).eq("id", 1).then(done("config"))}>Salvar loja</Button>
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Motoboys">
          <ul className="mb-3 space-y-2 text-sm">
            {motoboys.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span className={m.ativo ? "" : "text-muted-foreground line-through"}>{m.nome} <span className="text-muted-foreground">{m.telefone}</span></span>
                <Button size="sm" variant="ghost" onClick={() => supabase.from("motoboys").update({ ativo: !m.ativo }).eq("id", m.id).then(done("motoboys"))}>{m.ativo ? "Desativar" : "Ativar"}</Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Nome" value={moto.nome} onChange={(e) => setMoto({ ...moto, nome: e.target.value })} />
            <Input placeholder="Telefone" value={moto.telefone} onChange={(e) => setMoto({ ...moto, telefone: e.target.value })} />
            <Button disabled={!moto.nome} onClick={() => supabase.from("motoboys").insert({ nome: moto.nome, telefone: moto.telefone || null }).then((r) => { done("motoboys")(r); if (!r.error) setMoto({ nome: "", telefone: "" }); })}>Adicionar</Button>
          </div>
        </Panel>
        <Panel title="Cupons de desconto">
          <ul className="mb-3 space-y-2 text-sm">
            {cupons.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className={c.ativo ? "font-mono" : "font-mono text-muted-foreground line-through"}>{c.codigo} — {c.percentual}%</span>
                <Button size="sm" variant="ghost" onClick={() => supabase.from("cupons").update({ ativo: !c.ativo }).eq("id", c.id).then(done("cupons"))}>{c.ativo ? "Desativar" : "Ativar"}</Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="CÓDIGO" value={cup.codigo} onChange={(e) => setCup({ ...cup, codigo: e.target.value.toUpperCase() })} />
            <Input className="w-24" type="number" value={cup.percentual} onChange={(e) => setCup({ ...cup, percentual: e.target.value })} />
            <Button disabled={!cup.codigo} onClick={() => supabase.from("cupons").insert({ codigo: cup.codigo, percentual: Number(cup.percentual) }).then((r) => { done("cupons")(r); if (!r.error) setCup({ codigo: "", percentual: "10" }); })}>Adicionar</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
