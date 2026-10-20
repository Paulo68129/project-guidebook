-- ============================================
-- MIGRAÇÃO: Timer de Pagamento reduzido para 5 minutos
-- ============================================
-- 1. Atualiza o tempo de expiração de 15 para 5 minutos
-- 2. Atualiza a trigger para usar 5 minutos
-- 3. Atualiza as funções RPC para usar 5 minutos
-- 4. Expira automaticamente pedidos antigos
-- ============================================

-- ============================================
-- 1. Atualiza pedidos existentes com expires_at = created_at + 5 minutos
-- ============================================

UPDATE public.pedidos_online
SET expires_at = created_at + interval '5 minutes'
WHERE expires_at IS NULL
   OR expires_at > created_at + interval '5 minutes';

-- ============================================
-- 2. Atualiza a trigger para definir expires_at automaticamente com 5 minutos
-- ============================================

CREATE OR REPLACE FUNCTION public.set_payment_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + interval '5 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Atualiza a função expirar_pedido_online para usar 5 minutos
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
    AND (expires_at <= NOW() OR NOW() > created_at + interval '5 minutes')
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
-- 4. Atualiza a função verificar_expiracao_pedido para usar 5 minutos
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
      AND (p.expires_at <= NOW() OR NOW() > p.created_at + interval '5 minutes')
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
-- 5. Atualiza a função listar_pedidos_com_timer para usar 5 minutos
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
    (p.status = 'aguardando_pagamento' AND (p.expires_at <= NOW() OR NOW() > p.created_at + interval '5 minutes')) AS is_expired,
    GREATEST(
      EXTRACT(EPOCH FROM (COALESCE(p.expires_at, p.created_at + interval '5 minutes') - NOW()))::int,
      0
    ) AS remaining_seconds
  FROM pedidos_online p
  WHERE p.status = 'aguardando_pagamento'
  ORDER BY p.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.listar_pedidos_com_timer() TO authenticated;

-- ============================================
-- 6. Expira automaticamente pedidos antigos que ainda estão aguardando pagamento
-- ============================================

UPDATE public.pedidos_online
SET status = 'cancelado',
    status_pagamento = 'expirado'
WHERE status = 'aguardando_pagamento'
  AND (expires_at <= NOW() OR NOW() > created_at + interval '5 minutes');

-- ============================================
-- 7. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
