import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Server-side Supabase client — uses direct fetch with service role key to bypass RLS
async function supabaseOp(table: string, op: "insert" | "update" | "delete" | "select", data?: any, filters?: { column: string; value: any }): Promise<any> {
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials');

  const baseUrl = `${SUPABASE_URL}/rest/v1`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  if (op === "select") {
    let url = `${baseUrl}/${table}?select=*`;
    if (filters) url += `&${filters.column}=eq.${filters.value}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SELECT ${table}: ${res.status} ${text}`);
    }
    return await res.json();
  }

  if (op === "insert") {
    const items = Array.isArray(data) ? data : [data];
    const res = await fetch(`${baseUrl}/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(items),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`INSERT ${table}: ${res.status} ${text}`);
    }
    return await res.json();
  }

  if (op === "update" && filters) {
    const res = await fetch(`${baseUrl}/${table}?${filters.column}=eq.${filters.value}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UPDATE ${table}: ${res.status} ${text}`);
    }
    return await res.json();
  }

  if (op === "delete" && filters) {
    const res = await fetch(`${baseUrl}/${table}?${filters.column}=eq.${filters.value}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DELETE ${table}: ${res.status} ${text}`);
    }
    return { success: true };
  }

  throw new Error(`Unknown operation: ${op}`);
}

// Direct handler for /api/admin/save — uses PostgreSQL direct connection, bypassing PostgREST and RLS
async function handleAdminSave(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await request.json();
    const { action, params } = body as { action: string; params: Record<string, any> };
    console.log("[admin/save] Action:", action);

    let data: any = null;

    switch (action) {
      case "upsert_produto": {
        const produto: Record<string, any> = {
          nome: params._nome,
          categoria: params._categoria,
          preco: Number(params._preco),
          ativo: params._ativo === true || params._ativo === "true",
        };
        if (params._descricao) produto.descricao = params._descricao;
        if (params._foto_url) produto.foto_url = params._foto_url;
        if (params._id && params._id !== "") {
          data = await supabaseOp("produtos", "update", produto, { column: "id", value: params._id });
        } else {
          data = await supabaseOp("produtos", "insert", produto);
        }
        break;
      }
      case "delete_produto": {
        data = await supabaseOp("produtos", "delete", undefined, { column: "id", value: params._id });
        break;
      }
      case "delete_receitas_por_produto": {
        data = await supabaseOp("receitas", "delete", undefined, { column: "produto_id", value: params._produto_id });
        break;
      }
      case "insert_receitas": {
        const { _produto_id, _ingrediente_ids, _quantidades } = params;
        const items = [];
        for (let i = 0; i < _ingrediente_ids.length; i++) {
          items.push({
            produto_id: _produto_id,
            ingrediente_id: _ingrediente_ids[i],
            quantidade: Number(_quantidades[i]),
          });
        }
        data = await supabaseOp("receitas", "insert", items);
        break;
      }
      case "upsert_ingrediente": {
        const ingrediente: Record<string, any> = {
          nome: params._nome,
          unidade: params._unidade,
          quantidade: Number(params._quantidade),
          estoque_minimo: Number(params._estoque_minimo),
          custo_unitario: Number(params._custo_unitario),
        };
        if (params._validade && params._validade !== "") {
          ingrediente.validade = params._validade;
        }
        if (params._id && params._id !== "") {
          data = await supabaseOp("ingredientes", "update", ingrediente, { column: "id", value: params._id });
        } else {
          data = await supabaseOp("ingredientes", "insert", ingrediente);
        }
        break;
      }
      case "dar_entrada_ingrediente": {
        const current = await supabaseOp("ingredientes", "select", undefined, { column: "id", value: params._id });
        if (current && current.length > 0) {
          const ing = current[0];
          const updated = { ...ing, quantidade: Number(ing.quantidade) + Number(params._quantidade) };
          data = await supabaseOp("ingredientes", "update", updated, { column: "id", value: params._id });
        }
        break;
      }
      case "delete_ingrediente": {
        data = await supabaseOp("ingredientes", "delete", undefined, { column: "id", value: params._id });
        break;
      }
      case "update_loja_config": {
        const loja: Record<string, any> = {};
        if (params._abre) loja.abre = params._abre;
        if (params._fecha) loja.fecha = params._fecha;
        if (params._taxa_entrega != null) loja.taxa_entrega = Number(params._taxa_entrega);
        if (params._som_alerta != null) loja.som_alerta = params._som_alerta === true || params._som_alerta === "true";
        data = await supabaseOp("loja_config", "update", loja, { column: "id", value: 1 });
        break;
      }
      case "insert_motoboy": {
        data = await supabaseOp("motoboys", "insert", { nome: params._nome, telefone: params._telefone || null });
        break;
      }
      case "toggle_motoboy_ativo": {
        const current = await supabaseOp("motoboys", "select", undefined, { column: "id", value: params._id });
        if (current && current.length > 0) {
          const mb = current[0];
          data = await supabaseOp("motoboys", "update", { ...mb, ativo: !mb.ativo }, { column: "id", value: params._id });
        }
        break;
      }
      case "insert_cupom": {
        data = await supabaseOp("cupons", "insert", { codigo: params._codigo, percentual: Number(params._percentual) });
        break;
      }
      case "toggle_cupom_ativo": {
        const current = await supabaseOp("cupons", "select", undefined, { column: "id", value: params._id });
        if (current && current.length > 0) {
          const cp = current[0];
          data = await supabaseOp("cupons", "update", { ...cp, ativo: !cp.ativo }, { column: "id", value: params._id });
        }
        break;
      }
      case "listar_todos_produtos": {
        data = await supabaseOp("produtos", "select");
        break;
      }
      case "listar_todos_ingredientes": {
        data = await supabaseOp("ingredientes", "select");
        break;
      }
      case "listar_receitas_por_produto": {
        data = await supabaseOp("receitas", "select", undefined, { column: "produto_id", value: params._produto_id });
        break;
      }
      default:
        return new Response(JSON.stringify({ error: { message: `Ação desconhecida: ${action}` }, data: null }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ error: null, data }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[admin/save] Error:", err.message || err);
    return new Response(JSON.stringify({ error: { message: err.message || "Internal server error" }, data: null }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Intercept /api/admin/save requests — handle directly, bypassing TanStack Router
      const url = new URL(request.url);
      if (url.pathname === "/api/admin/save" && request.method === "POST") {
        return await handleAdminSave(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
