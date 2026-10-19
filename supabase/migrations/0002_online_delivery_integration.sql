-- Migration: Integração pedidos online com delivery
-- Adiciona motoboy_id e políticas de UPDATE para o painel de delivery

-- ============================================
-- 1. Coluna motoboy_id em pedidos_online
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pedidos_online' AND column_name='motoboy_id'
  ) THEN
    ALTER TABLE public.pedidos_online ADD COLUMN motoboy_id uuid;
  END IF;
END $$;

-- ============================================
-- 2. Política: staff pode atualizar pedidos online
-- ============================================
DROP POLICY IF EXISTS "staff atualiza pedidos online" ON public.pedidos_online;
CREATE POLICY "staff atualiza pedidos online" ON public.pedidos_online
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- ============================================
-- 3. Grant UPDATE para authenticated staff
-- ============================================
GRANT UPDATE ON public.pedidos_online TO authenticated;

-- ============================================
-- 4. Reload schema cache do PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';
