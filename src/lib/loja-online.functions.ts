import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createServerSupabaseClient() {
  const url = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  
  if (!url || !serviceKey) {
    throw new Error("Configuração do banco de dados indisponível");
  }
  
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (serviceKey.startsWith('sb_') && h.get('Authorization') === `Bearer ${serviceKey}`) {
          h.delete('Authorization');
        }
        h.set('apikey', serviceKey);
        return fetch(input, { ...init, headers: h });
      }
    }
  });
}

// Registrar venda na loja online (bypass RLS)
export const registrarVendaOnline = createServerFn({ method: "POST" }).handler(
  async ({
    itens,
    cliente,
    endereco,
    telefone,
  }: {
    itens: Array<{ produto_id: string; quantidade: number }>;
    cliente: string;
    endereco: string;
    telefone?: string;
  }) => {
    const db = createServerSupabaseClient();
    
    const { data, error } = await db.rpc("registrar_venda", {
      _itens: itens,
      _tipo: "delivery",
      _cliente: cliente,
      _endereco: endereco,
      _telefone: telefone || "",
    });
    
    if (error) {
      throw new Error(error.message || "Erro ao registrar venda");
    }
    
    return data as string;
  }
);

// Buscar dados da venda para página de pagamento (bypass RLS)
export const getVendaById = createServerFn({ method: "GET" }).handler(async ({ vendaId }: { vendaId: string }) => {
  const db = createServerSupabaseClient();
  
  const { data, error } = await db
    .from("vendas")
    .select("*, venda_itens(*)")
    .eq("id", vendaId)
    .single();
  
  if (error) {
    throw new Error("Pedido não encontrado");
  }
  
  return data;
});
