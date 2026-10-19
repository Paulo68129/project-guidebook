import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createServerSupabaseClient() {
  const url = process.env['SUPABASE_URL'];
  const anonKey = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  
  if (!url || !anonKey) {
    throw new Error("Configuração do banco de dados indisponível");
  }
  
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cria um pedido online usando queries diretas do Supabase.
 * Fallback para quando a função SQL criar_pedido_online não está disponível.
 * Esta função permite vendas sem autenticação (anon).
 */
async function criarPedidoOnlineFallback(db: ReturnType<typeof createClient>, {
  token,
  itens,
  cliente,
  endereco,
  telefone,
  cupom,
}: {
  token: string;
  itens: Array<{ produto_id: string; quantidade: number }>;
  cliente: string;
  endereco: string;
  telefone: string;
  cupom?: string;
}) {
  // Busca os produtos ativos
  const { data: produtos, error: produtosError } = await db
    .from("produtos")
    .select("id, nome, preco")
    .in("id", itens.map((i) => i.produto_id))
    .eq("ativo", true);

  if (produtosError) {
    throw new Error("Erro ao buscar produtos");
  }

  if (!produtos || produtos.length !== itens.length) {
    throw new Error("Um ou mais produtos não estão disponíveis");
  }

  // Calcula subtotal
  let subtotal = 0;
  const itensCompletos = itens.map((item) => {
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    const valor = Number(produto.preco) * item.quantidade;
    subtotal += valor;
    return {
      nome: produto.nome,
      produto_id: produto.id,
      quantidade: item.quantidade,
      preco_unitario: Number(produto.preco),
    };
  });

  // Busca taxa de entrega
  let taxaEntrega = 0;
  const { data: config } = await db
    .from("loja_config")
    .select("taxa_entrega")
    .eq("id", 1)
    .single();
  
  if (config && config.taxa_entrega) {
    taxaEntrega = Number(config.taxa_entrega);
  }

  // Valida cupom se informado
  let desconto = 0;
  if (cupom && cupom.trim()) {
    const { data: cupomData } = await db
      .from("cupons")
      .select("percentual")
      .ilike("codigo", cupom.trim())
      .eq("ativo", true)
      .single();
    
    if (!cupomData) {
      throw new Error("Cupom inválido");
    }
    desconto = Math.round(subtotal * Number(cupomData.percentual) / 100, 2);
  }

  const total = subtotal - desconto + taxaEntrega;

  // Verifica se a tabela pedidos_online existe
  const { data: tableCheck, error: tableError } = await db
    .from("pedidos_online")
    .select("id")
    .limit(1);

  if (tableError && (tableError.message.includes("does not exist") || tableError.code === "42P01")) {
    throw new Error("A loja online ainda não está configurada. Execute a migração SQL no Lovable Cloud (Cloud → Database → SQL Editor) usando o arquivo supabase/migrations/0001_online_store.sql");
  }

  // Insere o pedido
  const { data: pedido, error: insertError } = await db
    .from("pedidos_online")
    .insert({
      token,
      cliente: cliente.trim(),
      telefone: telefone.trim(),
      endereco: endereco.trim(),
      itens: itensCompletos,
      subtotal,
      desconto,
      taxa_entrega: taxaEntrega,
      total,
      cupom: cupom?.trim() || null,
      status: "aguardando_pagamento",
    })
    .select()
    .single();

  if (insertError) {
    // Se a tabela não existe, dá uma mensagem clara
    if (insertError.message.includes("does not exist") || insertError.code === "42P01") {
      throw new Error("A loja online ainda não está configurada. Execute a migração SQL no Lovable Cloud (Cloud → Database → SQL Editor) usando o arquivo supabase/migrations/0001_online_store.sql");
    }
    throw new Error(insertError.message || "Erro ao criar pedido");
  }

  return { token, pedido };
}

/**
 * Cria um pedido online usando a função criar_pedido_online do banco.
 * Se a função não estiver disponível (schema cache), usa fallback com queries diretas.
 * Esta função permite vendas sem autenticação (anon).
 * Retorna o token do pedido para consulta posterior.
 */
export const criarPedidoOnline = createServerFn({ method: "POST" }).handler(
  async ({
    itens,
    cliente,
    endereco,
    telefone,
    cupom,
  }: {
    itens: Array<{ produto_id: string; quantidade: number }>;
    cliente: string;
    endereco: string;
    telefone: string;
    cupom?: string;
  }) => {
    const db = createServerSupabaseClient();
    
    // Gera um token UUID único para este pedido
    const token = crypto.randomUUID();
    
    // Tenta usar a função SQL primeiro
    const { data, error } = await db.rpc("criar_pedido_online", {
      _token: token,
      _cliente: cliente,
      _telefone: telefone,
      _endereco: endereco,
      _itens: itens,
      _cupom: cupom || "",
    });
    
    // Se a função não existe (schema cache) ou a tabela não existe, usa fallback
    if (error && (
      error.message.includes("Could not find the function") || 
      error.code === "PGRST202" ||
      error.message.includes("does not exist") ||
      error.code === "42P01"
    )) {
      return criarPedidoOnlineFallback(db, { token, itens, cliente, endereco, telefone, cupom });
    }
    
    if (error) {
      throw new Error(error.message || "Erro ao criar pedido");
    }
    
    // Retorna o token e os dados do pedido
    return { token, pedido: data };
  }
);

/**
 * Consulta um pedido online pelo token.
 * Permite acesso sem autenticação (anon).
 * Se a função SQL não estiver disponível, usa query direta.
 */
export const consultarPedidoOnline = createServerFn({ method: "GET" }).handler(
  async ({ token }: { token: string }) => {
    const db = createServerSupabaseClient();
    
    // Tenta usar a função SQL primeiro
    const { data, error } = await db.rpc("consultar_pedido_online", {
      _token: token,
    });
    
    // Se a função não existe (schema cache) ou a tabela não existe, usa query direta
    if (error && (
      error.message.includes("Could not find the function") || 
      error.code === "PGRST202" ||
      error.message.includes("does not exist") ||
      error.code === "42P01"
    )) {
      const { data: pedido, error: queryError } = await db
        .from("pedidos_online")
        .select("id, cliente, telefone, endereco, itens, subtotal, desconto, taxa_entrega, total, cupom, status, created_at")
        .eq("token", token)
        .single();
      
      if (queryError && (queryError.message.includes("does not exist") || queryError.code === "42P01")) {
        throw new Error("A loja online ainda não está configurada. Execute a migração SQL no Lovable Cloud.");
      }
      
      if (queryError || !pedido) {
        throw new Error("Pedido não encontrado");
      }

      // Normaliza itens: pode vir como array, string JSON, ou null/undefined
      let normalizedItens = [];
      if (Array.isArray(pedido.itens)) {
        normalizedItens = pedido.itens;
      } else if (typeof pedido.itens === 'string') {
        try {
          const parsed = JSON.parse(pedido.itens);
          normalizedItens = Array.isArray(parsed) ? parsed : [];
        } catch {
          normalizedItens = [];
        }
      }

      const normalizedPedido = {
        ...pedido,
        itens: normalizedItens,
      };
      
      return normalizedPedido;
    }
    
    if (error) {
      throw new Error("Pedido não encontrado");
    }
    
    if (!data) {
      throw new Error("Pedido não encontrado");
    }

    // Normaliza itens: pode vir como array, string JSON, ou null/undefined
    // A função SQL to_jsonb() converte jsonb para string JSON, então precisamos fazer parse
    let normalizedItens = [];
    if (Array.isArray(data.itens)) {
      normalizedItens = data.itens;
    } else if (typeof data.itens === 'string') {
      try {
        const parsed = JSON.parse(data.itens);
        normalizedItens = Array.isArray(parsed) ? parsed : [];
      } catch {
        normalizedItens = [];
      }
    }

    // Garante que itens seja sempre um array - data pode vir como objeto com chaves diferentes
    const normalizedData = {
      id: data.id || "",
      cliente: data.cliente || "",
      telefone: data.telefone || "",
      endereco: data.endereco || "",
      itens: normalizedItens,
      subtotal: Number(data.subtotal) || 0,
      desconto: Number(data.desconto) || 0,
      taxa_entrega: Number(data.taxa_entrega) || 0,
      total: Number(data.total) || 0,
      cupom: data.cupom || null,
      status: data.status || "aguardando_pagamento",
      created_at: data.created_at || new Date().toISOString(),
    };

    return normalizedData;
  }
);
