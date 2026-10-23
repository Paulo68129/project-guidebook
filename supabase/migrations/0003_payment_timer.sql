-- ============================================
-- MIGRAÇÃO: Timer de Pagamento Online
-- ============================================
-- 1. Adiciona coluna expires_at (tempo limite para pagamento)
-- 2. Cria função expirar_pedido_online para cancelar pedido expirado
-- 3. Cria função verificar_pedidos_expirados para check-in do frontend
-- 4. Atualiza pedidos existentes com expires_at = created_at + 15 minutos
-- ============================================

-- ============================================
-- 1. Coluna expires_at em pedidos_online
-- ============================================

ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Define o tempo padrão de pagamento: 15 minutos a partir da criação
UPDATE public.pedidos_online
SET expires_at = created_at + interval '15 minutes'
WHERE expires_at IS NULL;

-- Trigger para definir expires_at automaticamente ao criar novo pedido
CREATE OR REPLACE FUNCTION public.set_payment_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payment_expires_at ON public.pedidos_online;
CREATE TRIGGER set_payment_expires_at
  BEFORE INSERT ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_expires_at();

-- ============================================
-- 2. Função para expirar um pedido específico
-- ============================================

CREATE OR REPLACE FUNCTION public.expirar_pedido_online(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE pedidos_online
  SET status = 'cancelado',
      status_pagamento = 'expirado'
  WHERE token = _token
    AND status = 'aguardando_pagamento'
    AND (expires_at <= NOW() OR NOW() > created_at + interval '15 minutes')
  RETURNING to_jsonb(pedidos_online) - 'token' INTO result;

  IF result IS NULL THEN
    -- Se não encontrou com a condição de tempo, tenta forçar o cancelamento
    UPDATE pedidos_online
    SET status = 'cancelado',
        status_pagamento = 'expirado'
    WHERE token = _token
      AND status = 'aguardando_pagamento'
    RETURNING to_jsonb(pedidos_online) - 'token' INTO result;
  END IF;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.expirar_pedido_online(uuid) TO anon, authenticated;

-- ============================================
-- 3. Função para verificar se pedido expirou (uso no frontend)
-- ============================================

CREATE OR REPLACE FUNCTION public.verificar_expiracao_pedido(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'token', _token,
    'expires_at', p.expires_at,
    'created_at', p.created_at,
    'status', p.status,
    'is_expired', (
      p.status = 'aguardando_pagamento'
      AND (p.expires_at <= NOW() OR NOW() > p.created_at + interval '15 minutes')
    ),
    'remaining_seconds', GREATEST(
      EXTRACT(EPOCH FROM (p.expires_at - NOW()))::int,
      0
    )
  )
  FROM pedidos_online p
  WHERE p.token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_expiracao_pedido(uuid) TO anon, authenticated;

-- ============================================
-- 4. Função para listar pedidos com tempo restante (uso no PDV)
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_pedidos_com_timer()
RETURNS TABLE(
  id uuid,
  token uuid,
  cliente text,
  telefone text,
  endereco text,
  itens jsonb,
  subtotal numeric,
  desconto numeric,
  taxa_entrega numeric,
  total numeric,
  cupom text,
  status text,
  status_pagamento text,
  created_at timestamptz,
  expires_at timestamptz,
  is_expired boolean,
  remaining_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.token,
    p.cliente,
    p.telefone,
    p.endereco,
    p.itens,
    p.subtotal,
    p.desconto,
    p.taxa_entrega,
    p.total,
    p.cupom,
    p.status,
    COALESCE(p.status_pagamento, 'aguardando'),
    p.created_at,
    p.expires_at,
    (p.status = 'aguardando_pagamento' AND (p.expires_at <= NOW() OR NOW() > p.created_at + interval '15 minutes')) AS is_expired,
    GREATEST(
      EXTRACT(EPOCH FROM (COALESCE(p.expires_at, p.created_at + interval '15 minutes') - NOW()))::int,
      0
    ) AS remaining_seconds
  FROM pedidos_online p
  WHERE p.status = 'aguardando_pagamento'
  ORDER BY p.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.listar_pedidos_com_timer() TO authenticated;

-- ============================================
-- 5. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
