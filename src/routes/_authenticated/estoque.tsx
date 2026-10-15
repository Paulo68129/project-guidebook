import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, diasParaVencer, ingredientesQ, num, type Ingrediente } from "@/lib/data";
import { useRole } from "@/hooks/useRole";
import { PageHeader, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — PizzaStockAI" }, { name: "description", content: "Controle de ingredientes, validade e estoque mínimo." }, { property: "og:title", content: "Estoque — PizzaStockAI" }, { property: "og:description", content: "Controle de ingredientes da pizzaria." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ingredientesQ),
  errorComponent: RouteError,
  component: Estoque,
});

type Form = { id?: string; nome: string; unidade: string; quantidade: string; estoque_minimo: string; custo_unitario: string; validade: string };
const vazio: Form = { nome: "", unidade: "kg", quantidade: "0", estoque_minimo: "0", custo_unitario: "0", validade: "" };

function Estoque() {
  const { data: ings } = useSuspenseQuery(ingredientesQ);
  const { isManager } = useRole();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [entrada, setEntrada] = useState<{ ing: Ingrediente; qtd: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["ingredientes"] });

  async function salvar() {
    if (!form) return;
    const row = { nome: form.nome, unidade: form.unidade, quantidade: Number(form.quantidade), estoque_minimo: Number(form.estoque_minimo), custo_unitario: Number(form.custo_unitario), validade: form.validade || null };
    const { error } = form.id ? await supabase.from("ingredientes").update(row).eq("id", form.id) : await supabase.from("ingredientes").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Ingrediente salvo"); setForm(null); refresh();
  }
  async function darEntrada() {
    if (!entrada) return;
    const q = Number(entrada.qtd);
    if (!(q > 0)) return toast.error("Quantidade inválida");
    const { error } = await supabase.from("ingredientes").update({ quantidade: Number(entrada.ing.quantidade) + q }).eq("id", entrada.ing.id);
    if (error) return toast.error(error.message);
    toast.success("Entrada registrada"); setEntrada(null); refresh();
  }
  async function excluir(id: string) {
    if (!confirm("Excluir este ingrediente?")) return;
    const { error } = await supabase.from("ingredientes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  const lista = ings.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()));
  const valorTotal = ings.reduce((s, i) => s + Number(i.quantidade) * Number(i.custo_unitario), 0);

  return (
    <div>
      <PageHeader title="Estoque" sub={`Valor em estoque: ${brl(valorTotal)}`}>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
          {isManager && <Button onClick={() => setForm(vazio)}>Novo ingrediente</Button>}
        </div>
      </PageHeader>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Ingrediente</th><th>Quantidade</th><th>Mínimo</th><th>Custo/un.</th><th>Validade</th><th className="p-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((i) => {
              const baixo = Number(i.quantidade) <= Number(i.estoque_minimo);
              const d = diasParaVencer(i.validade);
              return (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{i.nome}</td>
                  <td className={baixo ? "font-semibold text-destructive" : ""}>{num(Number(i.quantidade))} {i.unidade}</td>
                  <td className="text-muted-foreground">{num(Number(i.estoque_minimo))}</td>
                  <td>{brl(Number(i.custo_unitario))}</td>
                  <td className={d < 0 ? "text-destructive" : d <= 3 ? "text-primary" : ""}>{i.validade ? new Date(i.validade + "T00:00").toLocaleDateString("pt-BR") : "—"}{d < 0 && " (vencido)"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setEntrada({ ing: i, qtd: "" })}>Entrada</Button>
                    {isManager && (<>
                      <Button size="sm" variant="ghost" onClick={() => setForm({ id: i.id, nome: i.nome, unidade: i.unidade, quantidade: String(i.quantidade), estoque_minimo: String(i.estoque_minimo), custo_unitario: String(i.custo_unitario), validade: i.validade ?? "" })}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(i.id)}>Excluir</Button>
                    </>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar" : "Novo"} ingrediente</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              {([["nome", "Nome"], ["unidade", "Unidade"], ["quantidade", "Quantidade"], ["estoque_minimo", "Estoque mínimo"], ["custo_unitario", "Custo por unidade (R$)"], ["validade", "Validade"]] as const).map(([k, l]) => (
                <label key={k} className={`text-sm ${k === "nome" ? "col-span-2" : ""}`}>{l}
                  <Input type={k === "validade" ? "date" : ["nome", "unidade"].includes(k) ? "text" : "number"} step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
              <Button className="col-span-2" onClick={salvar}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!entrada} onOpenChange={(o) => !o && setEntrada(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Entrada de {entrada?.ing.nome}</DialogTitle></DialogHeader>
          <Input type="number" step="any" placeholder={`Quantidade em ${entrada?.ing.unidade}`} value={entrada?.qtd ?? ""} onChange={(e) => entrada && setEntrada({ ...entrada, qtd: e.target.value })} />
          <Button onClick={darEntrada}>Registrar entrada</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
