import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { friendlyDbError, isMissingFunction } from "./db-errors";
import {
  isUuid,
  normalizeOrder,
  parseNovoPedido,
  type NovoPedido,
  type NovoPedidoInput,
  type OnlineOrder,
} from "./online-order";

function serverSupabase() {
  // Runtime env first; build-time VITE_* values are inlined as a last resort so the
  // store keeps working on hosts where server env vars were not configured.
  const url = (
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    import.meta.env["VITE_SUPABASE_URL"] ||
    ""
  ).replace(/\/+$/, "");
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "";

  if (!url || !key) throw new Error("Loja temporariamente indisponível: configuração do banco ausente.");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New sb_publishable_ keys are opaque strings and are rejected as bearer tokens.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type ServerDb = ReturnType<typeof serverSupabase>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Usado apenas se a função SQL criar_pedido_online não existir no banco. Preços sempre vêm do banco. */
async function inserirPedidoDireto(db: ServerDb, pedido: NovoPedido): Promise<{ token: string; pedido: OnlineOrder }> {
  const ids = [...new Set(pedido.itens.map((i) => i.produto_id))];
  const { data: produtos, error: produtosError } = await db
    .from("produtos")
    .select("id, nome, preco")
    .in("id", ids)
    .eq("ativo", true);
  if (produtosError) throw new Error(friendlyDbError(produtosError, "Não foi possível validar os produtos"));

  const porId = new Map((produtos ?? []).map((p) => [p.id, p]));
  const itens = pedido.itens.map((item) => {
    const produto = porId.get(item.produto_id);
    if (!produto) throw new Error("Produto indisponível");
    return {
      nome: produto.nome,
      produto_id: produto.id,
      quantidade: item.quantidade,
      preco_unitario: Number(produto.preco),
    };
  });
  const subtotal = round2(itens.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0));

  const { data: config } = await db.from("loja_config").select("taxa_entrega").eq("id", 1).maybeSingle();
  const taxaEntrega = Number(config?.taxa_entrega ?? 0) || 0;

  let desconto = 0;
  if (pedido.cupom) {
    const { data: cupom } = await db
      .from("cupons")
      .select("percentual")
      .ilike("codigo", pedido.cupom.replace(/[%_\\]/g, "\\$&"))
      .eq("ativo", true)
      .maybeSingle();
    if (!cupom) throw new Error("Cupom inválido");
    desconto = round2((subtotal * Number(cupom.percentual)) / 100);
  }

  const row = {
    id: crypto.randomUUID(),
    token: pedido.token,
    cliente: pedido.cliente,
    telefone: pedido.telefone,
    endereco: pedido.endereco,
    itens,
    subtotal,
    desconto,
    taxa_entrega: taxaEntrega,
    total: round2(subtotal - desconto + taxaEntrega),
    cupom: pedido.cupom || null,
    status: "aguardando_pagamento",
    created_at: new Date().toISOString(),
  };
  // No .select(): anonymous clients may insert but not read the table back.
  const { error } = await db.from("pedidos_online").insert(row);
  if (error) throw new Error(friendlyDbError(error, "Não foi possível registrar o pedido"));

  const { token: _token, ...publico } = row;
  const normalized = normalizeOrder(publico);
  if (!normalized) throw new Error("Falha ao montar o pedido");
  return { token: pedido.token, pedido: normalized };
}

/**
 * Cria um pedido online sem login. Os preços são recalculados no banco.
 * Chamar como `criarPedidoOnline({ data: { ... } })`.
 */
export const criarPedidoOnline = createServerFn({ method: "POST" })
  .validator((input: NovoPedidoInput) => parseNovoPedido(input))
  .handler(async ({ data }): Promise<{ token: string; pedido: OnlineOrder }> => {
    const db = serverSupabase();
    const { data: result, error } = await db.rpc("criar_pedido_online", {
      _token: data.token,
      _cliente: data.cliente,
      _telefone: data.telefone,
      _endereco: data.endereco,
      _itens: data.itens,
      _cupom: data.cupom,
    });

    if (error) {
      if (isMissingFunction(error)) return inserirPedidoDireto(db, data);
      throw new Error(friendlyDbError(error, "Não foi possível registrar o pedido"));
    }

    const pedido = normalizeOrder(result);
    if (!pedido) throw new Error("O banco não confirmou o pedido. Tente novamente.");
    return { token: data.token, pedido };
  });

/**
 * Consulta um pedido pelo token secreto (link de acompanhamento). Retorna `null` se não existir.
 * Chamar como `consultarPedidoOnline({ data: { token } })`.
 */
export const consultarPedidoOnline = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => {
    const token = String(input?.token ?? "").trim();
    if (!isUuid(token)) throw new Error("Código de pedido inválido");
    return { token: token.toLowerCase() };
  })
  .handler(async ({ data }): Promise<OnlineOrder | null> => {
    const db = serverSupabase();
    const { data: result, error } = await db.rpc("consultar_pedido_online", { _token: data.token });
    if (!error) return normalizeOrder(result);
    if (!isMissingFunction(error)) throw new Error(friendlyDbError(error, "Não foi possível consultar o pedido"));

    const { data: row, error: queryError } = await db
      .from("pedidos_online")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (queryError) throw new Error(friendlyDbError(queryError, "Não foi possível consultar o pedido"));
    if (!row) return null;
    const { token: _token, ...publico } = row;
    return normalizeOrder(publico);
  });
