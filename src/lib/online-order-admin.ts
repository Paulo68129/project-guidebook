import { supabase } from "@/integrations/supabase/client";
import {
  friendlyDbError,
  isBusinessError,
  isMissingColumn,
  isMissingFunction,
  MIGRATION_HINT,
  type DbError,
} from "./db-errors";
import { normalizeOrder, type OnlineOrder, type OrderStatus } from "./online-order";

type RpcResult = { data: unknown; error: DbError | null };
type UntypedRpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult> };

/** Funções criadas pela migração 0002 ainda não estão nos tipos gerados do Supabase. */
function rpcOpcional(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  return Promise.resolve((supabase as unknown as UntypedRpcClient).rpc(fn, args));
}

function normalizeList(data: unknown): OnlineOrder[] {
  let list = data;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  return (Array.isArray(list) ? list : [])
    .map((row) => normalizeOrder(row))
    .filter((p): p is OnlineOrder => p !== null);
}

/**
 * Lista pedidos online para a equipe. Tenta a função SQL dedicada (ignora problemas de RLS,
 * mas confere se o usuário é da equipe) e cai para a consulta direta na tabela.
 */
export async function listarPedidosOnline({ horas = 48, limite = 200 } = {}): Promise<OnlineOrder[]> {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString();

  const rpc = await rpcOpcional("listar_pedidos_online", { _desde: desde });
  if (!rpc.error) return normalizeList(rpc.data).slice(0, limite);
  if (!isMissingFunction(rpc.error)) console.warn("[pedidos-online] listar_pedidos_online falhou:", rpc.error.message);

  const { data, error } = await supabase
    .from("pedidos_online")
    .select("*")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(friendlyDbError(error, "Não foi possível carregar os pedidos online"));
  return normalizeList(data);
}

export type PedidoOnlinePatch = { status?: OrderStatus; motoboy_id?: string | null };

/** Atualiza status/motoboy. Função SQL primeiro; depois update direto com verificação de linhas afetadas. */
export async function atualizarPedidoOnline(id: string, patch: PedidoOnlinePatch): Promise<void> {
  const mudaMotoboy = "motoboy_id" in patch;
  const rpc = await rpcOpcional("atualizar_pedido_online", {
    _id: id,
    _status: patch.status ?? null,
    _motoboy_id: patch.motoboy_id ?? null,
    _limpar_motoboy: mudaMotoboy && !patch.motoboy_id,
  });
  if (!rpc.error) return;
  if (isBusinessError(rpc.error)) throw new Error(rpc.error.message ?? "Atualização recusada");
  if (!isMissingFunction(rpc.error)) console.warn("[pedidos-online] atualizar_pedido_online falhou:", rpc.error.message);

  const update: { status?: string; motoboy_id?: string | null } = {};
  if (patch.status) update.status = patch.status;
  if (mudaMotoboy) update.motoboy_id = patch.motoboy_id ?? null;

  const { data, error } = await supabase.from("pedidos_online").update(update).eq("id", id).select("id");
  if (error) {
    if (isMissingColumn(error)) throw new Error(`Atribuir motoboy a pedidos online exige a coluna motoboy_id. ${MIGRATION_HINT}`);
    throw new Error(friendlyDbError(error, "Não foi possível atualizar o pedido"));
  }
  if (!data || data.length === 0) {
    throw new Error(`O banco não permitiu atualizar o pedido (RLS). ${MIGRATION_HINT}`);
  }
}
