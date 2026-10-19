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
 * Cria um pedido online usando a função criar_pedido_online do banco.
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
    
    const { data, error } = await db.rpc("criar_pedido_online", {
      _token: token,
      _cliente: cliente,
      _telefone: telefone,
      _endereco: endereco,
      _itens: itens,
      _cupom: cupom || "",
    });
    
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
