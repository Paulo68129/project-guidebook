export type DbError = { message?: string; code?: string; details?: string | null; hint?: string | null };

const MIGRATION_HINT = "Rode a migração supabase/migrations/0002_pedidos_online_rastreamento.sql no banco (Lovable Cloud).";

function text(error: DbError | null | undefined) {
  return `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
}

export function isMissingFunction(error: DbError | null | undefined) {
  return !!error && (error.code === "PGRST202" || text(error).includes("could not find the function"));
}

export function isMissingColumn(error: DbError | null | undefined) {
  return (
    !!error &&
    (error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|could not find the .* column/.test(text(error)))
  );
}

export function isMissingTable(error: DbError | null | undefined) {
  return (
    !!error &&
    (error.code === "42P01" || error.code === "PGRST205" || /relation .* does not exist|could not find the table/.test(text(error)))
  );
}

export function isPermissionError(error: DbError | null | undefined) {
  return !!error && (error.code === "42501" || /permission denied|row-level security/.test(text(error)));
}

/** Erros de regra de negócio levantados pelas funções SQL (RAISE EXCEPTION) — não adianta tentar outro caminho. */
export function isBusinessError(error: DbError | null | undefined) {
  return !!error && ["P0001", "22P02", "23514", "23502"].includes(error.code ?? "");
}

export function friendlyDbError(error: DbError | null | undefined, fallback: string) {
  if (!error) return fallback;
  if (isMissingTable(error)) return `A tabela de pedidos online não existe no banco. ${MIGRATION_HINT}`;
  if (isPermissionError(error)) return `Sem permissão no banco para esta operação. ${MIGRATION_HINT}`;
  return error.message || fallback;
}

export { MIGRATION_HINT };
