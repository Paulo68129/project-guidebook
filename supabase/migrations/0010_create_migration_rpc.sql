-- ============================================
-- FUNÇÃO: apply_migration_sql
-- ============================================
-- Permite executar SQL arbitrário via RPC do Supabase.
-- Usada pela Edge Function apply-migrations para aplicar migrações.
-- Esta função precisa ser criada ANTES de deployar a Edge Function.
-- ============================================

CREATE OR REPLACE FUNCTION public.apply_migration_sql(_sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  EXECUTE _sql;
  RETURN 'SQL executed successfully';
END;
$func$;

-- Grant para authenticated e anon (apenas para migrações iniciais)
-- Em produção, remova o grant do anon após as migrações
GRANT EXECUTE ON FUNCTION public.apply_migration_sql(text) TO anon, authenticated;
