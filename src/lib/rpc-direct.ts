// Client-side wrapper that calls the server-side /api/admin/save route.
// Server uses supabaseAdmin with Service Role Key to write directly to the database.

async function adminCall<T = any>(action: string, params: Record<string, any>): Promise<{ data: T | null; error: any }> {
  try {
    const res = await fetch("/api/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, params }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: { message: `${res.status}: ${text}` } };
    }
    const json = await res.json();
    return json as { data: T | null; error: any };
  } catch (err: any) {
    return { data: null, error: { message: err.message || "Network error" } };
  }
}

// --- Cardápio ---

export async function upsertProduto(params: {
  _id: string | null;
  _nome: string;
  _categoria: string;
  _preco: number;
  _descricao: string | null;
  _foto_url: string | null;
  _ativo: boolean;
}) {
  return adminCall("upsert_produto", params);
}

export async function deleteProduto(_id: string) {
  return adminCall("delete_produto", { _id });
}

export async function deleteReceitasPorProduto(_produto_id: string) {
  return adminCall("delete_receitas_por_produto", { _produto_id });
}

export async function insertReceitas(params: {
  _produto_id: string;
  _ingrediente_ids: string[];
  _quantidades: number[];
}) {
  return adminCall("insert_receitas", params);
}

// --- Estoque ---

export async function upsertIngrediente(params: {
  _id: string | null;
  _nome: string;
  _unidade: string;
  _quantidade: number;
  _estoque_minimo: number;
  _custo_unitario: number;
  _validade: string | null;
}) {
  return adminCall("upsert_ingrediente", params);
}

export async function darEntradaIngrediente(_id: string, _quantidade: number) {
  return adminCall("dar_entrada_ingrediente", { _id, _quantidade });
}

export async function deleteIngrediente(_id: string) {
  return adminCall("delete_ingrediente", { _id });
}

// --- Config ---

export async function updateLojaConfig(params: {
  _abre: string | null;
  _fecha: string | null;
  _taxa_entrega: number | null;
  _som_alerta: boolean | null;
}) {
  return adminCall("update_loja_config", params);
}

export async function insertMotoboy(_nome: string, _telefone: string | null) {
  return adminCall("insert_motoboy", { _nome, _telefone });
}

export async function toggleMotoboyAtivo(_id: string) {
  return adminCall("toggle_motoboy_ativo", { _id });
}

export async function insertCupom(_codigo: string, _percentual: number) {
  return adminCall("insert_cupom", { _codigo, _percentual });
}

export async function toggleCupomAtivo(_id: string) {
  return adminCall("toggle_cupom_ativo", { _id });
}

// --- Read wrappers ---

export async function listarTodosProdutos() {
  return adminCall("listar_todos_produtos", {});
}

export async function listarTodosIngredientes() {
  return adminCall("listar_todos_ingredientes", {});
}

export async function listarReceitasPorProduto(_produto_id: string) {
  return adminCall("listar_receitas_por_produto", { _produto_id });
}

// --- PDV ---

export async function registrarVenda(params: {
  _itens: Array<{ produto_id: string; quantidade: number }>;
  _metodo_pagamento?: string;
  _observacoes?: string;
}) {
  return adminCall("registrar_venda", params);
}
