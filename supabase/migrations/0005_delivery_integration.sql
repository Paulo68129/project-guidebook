-- ============================================
-- MIGRAÇÃO: Integração Completa Loja Online → Delivery
-- ============================================
-- 1. Tabela de audit log para rastrear todas as ações
-- 2. Função de limpeza automática de dados expirados
-- 3. Job agendado para verificar pedidos pendentes a cada minuto
-- 4. Configuração de Realtime para pedidos_online
-- 5. Função para notificar novo pedido no delivery
-- ============================================

-- ============================================
-- 1. Tabela de audit log para pedidos online
-- ============================================

CREATE TABLE IF NOT EXISTS public.pedidos_online_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  acao text NOT NULL, -- 'recebido', 'confirmado', 'cancelado', 'expirado', 'atualizado'
  detalhes jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_pedidos_online_audit_pedido_id ON public.pedidos_online_audit(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_audit_created_at ON public.pedidos_online_audit(created_at DESC);

-- Grants
GRANT SELECT ON public.pedidos_online_audit TO authenticated;
GRANT INSERT ON public.pedidos_online_audit TO authenticated, anon;

-- ============================================
-- 2. Função para registrar audit log
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_audit_pedido(
  _pedido_id uuid,
  _acao text,
  _detalhes jsonb DEFAULT NULL,
  _usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
  VALUES (_pedido_id, _acao, _detalhes, _usuario_id);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.registrar_audit_pedido(uuid, text, jsonb, uuid) TO anon, authenticated;

-- ============================================
-- 3. Trigger para registrar audit log automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION public.audit_pedidos_online_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
    VALUES (NEW.id, 'recebido', jsonb_build_object('status', NEW.status, 'total', NEW.total), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
      VALUES (NEW.id, 'atualizado', jsonb_build_object('de', OLD.status, 'para', NEW.status), auth.uid());
    END IF;
    IF NEW.status = 'cancelado' AND NEW.status_pagamento = 'expirado' THEN
      INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
      VALUES (NEW.id, 'expirado', jsonb_build_object('motivo', 'tempo_esgotado'), NULL);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_pedidos_online ON public.pedidos_online;
CREATE TRIGGER audit_pedidos_online
  AFTER INSERT OR UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_pedidos_online_changes();

-- ============================================
-- 4. Função de limpeza automática de dados expirados
-- ============================================

CREATE OR REPLACE FUNCTION public.limpar_pedidos_expirados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  count INTEGER;
  result jsonb;
BEGIN
  -- Expira pedidos que estão aguardando pagamento e passaram de 5 minutos
  UPDATE public.pedidos_online
  SET status = 'cancelado',
      status_pagamento = 'expirado'
  WHERE status = 'aguardando_pagamento'
    AND (expires_at <= NOW() OR NOW() > created_at + interval '5 minutes')
  RETURNING id INTO count;

  -- Registra no audit log os pedidos expirados
  INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes)
  SELECT id, 'expirado', jsonb_build_object('motivo', 'limpeza_automatica')
  FROM public.pedidos_online
  WHERE status = 'cancelado'
    AND status_pagamento = 'expirado'
    AND id NOT IN (
      SELECT pedido_id FROM pedidos_online_audit 
      WHERE acao = 'expirado' 
      AND created_at > NOW() - interval '1 minute'
    );

  result := jsonb_build_object(
    'expirados', count,
    'timestamp', NOW()::text
  );

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.limpar_pedidos_expirados() TO authenticated;

-- ============================================
-- 5. Função para confirmar pagamento e iniciar delivery
-- ============================================

CREATE OR REPLACE FUNCTION public.confirmar_pagamento_pedido(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE pedidos_online
  SET status = 'pago',
      status_pagamento = 'confirmado'
  WHERE token = _token
    AND status = 'aguardando_pagamento'
  RETURNING to_jsonb(pedidos_online) - 'token' INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  -- Registra no audit log
  INSERT INTO pedidos_online_audit (pedido_id, acao, detalhes)
  VALUES (
    (result->>'id')::uuid,
    'confirmado',
    jsonb_build_object('metodo', 'pix', 'timestamp', NOW()::text)
  );

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_pedido(uuid) TO anon, authenticated;

-- ============================================
-- 6. Habilitar Realtime para pedidos_online
-- ============================================

-- Habilita replication para Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online;

-- ============================================
-- 7. Função para listar pedidos recentes com status de novo
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_pedidos_delivery()
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
  motoboy_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  is_new boolean,
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
    p.motoboy_id,
    p.created_at,
    p.expires_at,
    -- Considera "novo" se foi criado nos últimos 3 minutos e está aguardando_pagamento ou pago
    (p.created_at > NOW() - interval '3 minutes' AND p.status IN ('aguardando_pagamento', 'pago')) AS is_new,
    -- Verifica se expirou
    (p.status = 'aguardando_pagamento' AND (p.expires_at <= NOW() OR NOW() > p.created_at + interval '5 minutes')) AS is_expired,
    -- Segundos restantes para pagamento
    GREATEST(
      EXTRACT(EPOCH FROM (COALESCE(p.expires_at, p.created_at + interval '5 minutes') - NOW()))::int,
      0
    ) AS remaining_seconds
  FROM pedidos_online p
  WHERE p.status NOT IN ('entregue', 'cancelado')
     OR p.created_at > NOW() - interval '48 hours'
  ORDER BY p.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.listar_pedidos_delivery() TO authenticated;

-- ============================================
-- 8. Job agendado para limpeza automática (pg_cron)
-- ============================================

-- Nota: pg_cron precisa estar habilitado no Supabase
-- Se não estiver disponível, o frontend fará a limpeza via polling

DO $$
BEGIN
  -- Tenta criar o job se pg_cron estiver disponível
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      SELECT cron.schedule(
        'limpar-pedidos-expirados',
        '* * * * *',  -- A cada minuto
        $$ SELECT public.limpar_pedidos_expirados() $$
      );
    EXCEPTION WHEN OTHERS THEN
      -- Se já existe o job, apenas atualiza
      BEGIN
        SELECT cron.schedule(
          'limpar-pedidos-expirados',
          '* * * * *',
          $$ SELECT public.limpar_pedidos_expirados() $$
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;
END
$$;

-- ============================================
-- 9. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
