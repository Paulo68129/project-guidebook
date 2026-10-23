-- =====================================================================
-- FIX: Corrigir função is_staff para verificar user_roles
-- =====================================================================
-- Problema: is_staff verificava auth.users.raw_user_meta_data->>'role' = 'staff'
-- Solucao: is_staff agora verifica public.user_roles WHERE user_id = _user_id
-- Isso permite que usuarios com role em user_roles acessem os pedidos online
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;
