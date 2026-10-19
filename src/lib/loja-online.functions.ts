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
    
    // Se a função não existe (schema cache), usa fallback
    if (error && (error.message.includes("Could not find the function") || error.code === "PGRST202")) {
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
 */
export const consultarPedidoOnline = createServerFn({ method: "GET" }).handler(
  async ({ token }: { token: string }) => {
    const db = createServerSupabaseClient();
    
    const { data, error } = await db.rpc("consultar_pedido_online", {
      _token: token,
    });
    
    if (error) {
      throw new Error("Pedido não encontrado");
    }
    
    if (!data) {
      throw new Error("Pedido não encontrado");
    }
    
    return data;
  }
);
