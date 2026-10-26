import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { listarTodosIngredientes, listarTodosProdutos, listarReceitasPorProduto } from "@/lib/rpc-direct";
import {
  getLocalProducts, getLocalIngredients, getLocalRecipes,
  getLocalMotoboys, getLocalCupons, getLocalLojaConfig, mergeWithLocal,
} from "@/lib/local-storage";

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
  refetchInterval: 10000, // Real-time stock refresh every 10s
  queryFn: async () => {
    // Tenta RPC direto primeiro, fallback para query direta
    const { data: rpcData, error: rpcErr } = await listarTodosIngredientes();
    let cloudData: Ingrediente[] = [];
    if (!rpcErr && Array.isArray(rpcData)) {
      cloudData = rpcData as Ingrediente[];
    } else {
      cloudData = must(await supabase.from("ingredientes").select("*").order("nome"));
    }
    // Merge with local storage
    const localData = getLocalIngredients();
    return mergeWithLocal(cloudData, localData) as Ingrediente[];
  },
});
export const produtosQ = queryOptions({
  queryKey: ["produtos"],
  refetchInterval: 15000, // Auto-refresh every 15s
  queryFn: async () => {
    // Tenta RPC direto primeiro, fallback para query direta
    const { data: rpcData, error: rpcErr } = await listarTodosProdutos();
    let cloudData: Produto[] = [];
    if (!rpcErr && Array.isArray(rpcData)) {
      cloudData = rpcData as Produto[];
    } else {
      cloudData = must(await supabase.from("produtos").select("*").order("categoria").order("nome"));
    }
    // Merge with local storage
    const localData = getLocalProducts();
    return mergeWithLocal(cloudData, localData) as Produto[];
  },
});
export const receitasQ = queryOptions({
  queryKey: ["receitas"],
  refetchInterval: 15000,
  queryFn: async () => {
    // Tenta query direta primeiro; se falhar por RLS, coleta por produto via RPC direto
    const { data: directData, error: directErr } = await supabase.from("receitas").select("*");
    let cloudData: Receita[] = [];
    if (!directErr && directData) {
      cloudData = directData as Receita[];
    } else {
      const { data: allProdutos } = await listarTodosProdutos();
      if (Array.isArray(allProdutos)) {
        for (const p of allProdutos as Produto[]) {
          const { data: rData } = await listarReceitasPorProduto(p.id);
          if (Array.isArray(rData)) cloudData.push(...rData as Receita[]);
        }
      }
    }
    // Merge with local storage
    const localData = getLocalRecipes();
    return mergeWithLocal(cloudData, localData) as Receita[];
  },
});

export const motoboysQ = queryOptions({
  queryKey: ["motoboys"],
  queryFn: async () => {
    try {
      const cloudData = must(await supabase.from("motoboys").select("*").order("nome"));
      const localData = getLocalMotoboys();
      return mergeWithLocal(cloudData, localData) as Motoboy[];
    } catch {
      return getLocalMotoboys() as Motoboy[];
    }
  },
});
export const cuponsQ = queryOptions({
  queryKey: ["cupons"],
  queryFn: async () => {
    try {
      const cloudData = must(await supabase.from("cupons").select("*").order("codigo"));
      const localData = getLocalCupons();
      return mergeWithLocal(cloudData, localData) as any[];
    } catch {
      return getLocalCupons();
    }
  },
});
export type LojaConfig = Tables<"loja_config">;
export const configQ = queryOptions({
  queryKey: ["config"],
  queryFn: async () => {
    try {
      return must(await supabase.from("loja_config").select("*").eq("id", 1).single()) as LojaConfig;
    } catch {
      return getLocalLojaConfig() as LojaConfig;
    }
  },
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
