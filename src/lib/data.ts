import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type Ingrediente = Tables<"ingredientes">;
export type Produto = Tables<"produtos">;
export type Receita = Tables<"receitas">;
export type Venda = Tables<"vendas"> & { venda_itens: Tables<"venda_itens">[] };
export type Motoboy = Tables<"motoboys">;

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const ingredientesQ = queryOptions({
  queryKey: ["ingredientes"],
  queryFn: async () => must(await supabase.from("ingredientes").select("*").order("nome")),
});
export const produtosQ = queryOptions({
  queryKey: ["produtos"],
  queryFn: async () => must(await supabase.from("produtos").select("*").order("categoria").order("nome")),
});
export const receitasQ = queryOptions({
  queryKey: ["receitas"],
  queryFn: async () => must(await supabase.from("receitas").select("*")),
});
export const motoboysQ = queryOptions({
  queryKey: ["motoboys"],
  queryFn: async () => must(await supabase.from("motoboys").select("*").order("nome")),
});
export const cuponsQ = queryOptions({
  queryKey: ["cupons"],
  queryFn: async () => must(await supabase.from("cupons").select("*").order("codigo")),
});
export const configQ = queryOptions({
  queryKey: ["config"],
  queryFn: async () => must(await supabase.from("loja_config").select("*").eq("id", 1).single()),
});

/** Vendas dos últimos N dias, paginando além do limite de 1000 linhas. */
export const vendasQ = (dias = 90) =>
  queryOptions({
    queryKey: ["vendas", dias],
    queryFn: async () => {
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const all: Venda[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = must(
          await supabase.from("vendas").select("*, venda_itens(*)").gte("created_at", desde)
            .order("created_at", { ascending: false }).range(from, from + 999),
        ) as Venda[];
        all.push(...rows);
        if (rows.length < 1000) break;
      }
      return all;
    },
  });

export function custoProduto(produtoId: string, receitas: Receita[], ings: Ingrediente[]) {
  return receitas.filter((r) => r.produto_id === produtoId).reduce((s, r) => {
    const i = ings.find((x) => x.id === r.ingrediente_id);
    return s + (i ? Number(i.custo_unitario) * Number(r.quantidade) : 0);
  }, 0);
}

export function diasParaVencer(validade: string | null) {
  if (!validade) return Infinity;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(validade + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
}

export const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");

/** Série diária de faturamento/pedidos nos últimos `dias` dias. */
export function serieDiaria(vendas: Venda[], dias: number) {
  const map = new Map<string, { dia: string; faturamento: number; pedidos: number; lucro: number }>();
  for (let i = dias - 1; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 86400000));
    map.set(k, { dia: k, faturamento: 0, pedidos: 0, lucro: 0 });
  }
  for (const v of vendas) {
    if (v.status === "cancelado") continue;
    const e = map.get(dayKey(new Date(v.created_at)));
    if (e) { e.faturamento += Number(v.total); e.pedidos++; e.lucro += Number(v.lucro); }
  }
  return [...map.values()];
}
