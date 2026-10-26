// Client-side wrapper that calls the server-side /api/admin/save route.
// If the server fails (RLS blocked), falls back to localStorage.
// This ensures the user can always save data, even without a Service Role Key.

import {
  saveLocalProduct, deleteLocalProduct,
  saveLocalIngredient, darEntradaLocal, deleteLocalIngredient,
  saveLocalRecipes,
  saveLocalLojaConfig,
  saveLocalMotoboy, toggleLocalMotoboy,
  saveLocalCupom, toggleLocalCupom,
} from "@/lib/local-storage";

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

async function tryServerOrLocal<T = any>(
  action: string,
  params: Record<string, any>,
  localFallback: () => { id: string; error?: string }
): Promise<{ data: T | null; error: any }> {
  // Try server first
  const result = await adminCall<T>(action, params);
  if (!result.error) {
    return result;
  }
  // Fallback to local storage
  console.warn(`[rpc-direct] Server failed for ${action}, falling back to local storage`);
  const local = localFallback();
  if (local.error) {
    return { data: null, error: { message: `Falha ao salvar: ${local.error}` } };
  }
  return { data: { id: local.id } as unknown as T, error: null };
}

// --- Cardápio RPC wrappers ---

export async function upsertProduto(params: {
  _id: string | null;
  _nome: string;
  _categoria: string;
  _preco: number;
  _descricao: string | null;
  _foto_url: string | null;
  _ativo: boolean;
}) {
  return tryServerOrLocal("upsert_produto", params, () =>
    saveLocalProduct({
      id: params._id || undefined,
      nome: params._nome,
      categoria: params._categoria,
      preco: params._preco,
      descricao: params._descricao,
      foto_url: params._foto_url,
      ativo: params._ativo,
    })
  );
}

export async function deleteProduto(_id: string) {
  return tryServerOrLocal("delete_produto", { _id }, () => {
    const err = deleteLocalProduct(_id);
    return { id: _id, ...err };
  });
}

export async function deleteReceitasPorProduto(_produto_id: string) {
  return adminCall("delete_receitas_por_produto", { _produto_id });
}

export async function insertReceitas(params: {
  _produto_id: string;
  _ingrediente_ids: string[];
  _quantidades: number[];
}) {
  const result = await adminCall("insert_receitas", params);
  if (result.error) {
    console.warn("[rpc-direct] insertReceitas server failed, falling back to local");
    const linhas = params._ingrediente_ids.map((id, i) => ({
      ingrediente_id: id,
      quantidade: params._quantidades[i],
    }));
    const err = saveLocalRecipes(params._produto_id, linhas);
    if (err.error) return { data: null, error: err };
    return { data: { success: true }, error: null };
  }
  return result;
}

// --- Estoque wrappers ---

export async function upsertIngrediente(params: {
  _id: string | null;
  _nome: string;
  _unidade: string;
  _quantidade: number;
  _estoque_minimo: number;
  _custo_unitario: number;
  _validade: string | null;
}) {
  return tryServerOrLocal("upsert_ingrediente", params, () =>
    saveLocalIngredient({
      id: params._id || undefined,
      nome: params._nome,
      unidade: params._unidade,
      quantidade: params._quantidade,
      estoque_minimo: params._estoque_minimo,
      custo_unitario: params._custo_unitario,
      validade: params._validade,
    })
  );
}

export async function darEntradaIngrediente(_id: string, _quantidade: number) {
  const result = await adminCall("dar_entrada_ingrediente", { _id, _quantidade });
  if (result.error) {
    console.warn("[rpc-direct] darEntrada server failed, falling back to local");
    const err = darEntradaLocal(_id, _quantidade);
    if (err.error) return { data: null, error: err };
    return { data: { success: true }, error: null };
  }
  return result;
}

export async function deleteIngrediente(_id: string) {
  return tryServerOrLocal("delete_ingrediente", { _id }, () => {
    const err = deleteLocalIngredient(_id);
    return { id: _id, ...err };
  });
}

// --- Config wrappers ---

export async function updateLojaConfig(params: {
  _abre: string | null;
  _fecha: string | null;
  _taxa_entrega: number | null;
  _som_alerta: boolean | null;
}) {
  const result = await adminCall("update_loja_config", params);
  if (result.error) {
    console.warn("[rpc-direct] updateLojaConfig server failed, falling back to local");
    const err = saveLocalLojaConfig({
      abre: params._abre || undefined,
      fecha: params._fecha || undefined,
      taxa_entrega: params._taxa_entrega || undefined,
      som_alerta: params._som_alerta || undefined,
    });
    if (err.error) return { data: null, error: err };
    return { data: { success: true }, error: null };
  }
  return result;
}

export async function insertMotoboy(_nome: string, _telefone: string | null) {
  return tryServerOrLocal("insert_motoboy", { _nome, _telefone }, () =>
    saveLocalMotoboy(_nome, _telefone)
  );
}

export async function toggleMotoboyAtivo(_id: string) {
  const result = await adminCall("toggle_motoboy_ativo", { _id });
  if (result.error) {
    console.warn("[rpc-direct] toggleMotoboy server failed, falling back to local");
    const err = toggleLocalMotoboy(_id);
    if (err.error) return { data: null, error: err };
    return { data: { success: true }, error: null };
  }
  return result;
}

export async function insertCupom(_codigo: string, _percentual: number) {
  return tryServerOrLocal("insert_cupom", { _codigo, _percentual }, () =>
    saveLocalCupom(_codigo, _percentual)
  );
}

export async function toggleCupomAtivo(_id: string) {
  const result = await adminCall("toggle_cupom_ativo", { _id });
  if (result.error) {
    console.warn("[rpc-direct] toggleCupom server failed, falling back to local");
    const err = toggleLocalCupom(_id);
    if (err.error) return { data: null, error: err };
    return { data: { success: true }, error: null };
  }
  return result;
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
