-- ============================================
-- MIGRAÇÃO 0008: Tabelas de Rastreamento e Notificações
-- ============================================
-- 1. Tabela de rastreamento de pedidos (histórico de status)
-- 2. Tabela de notificações de delivery
-- 3. Funções para gerenciar rastreamento e notificações
-- 4. Configuração de Realtime para novas tabelas
-- 5. Triggers automáticas para rastreamento
-- ============================================

-- ============================================
-- 1. Tabela de rastreamento de pedidos
-- ============================================
-- Armazena o histórico completo de mudanças de status de cada pedido
-- para permitir rastreamento detalhado pelo cliente

CREATE TABLE IF NOT EXISTS public.rastreamento_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  status text NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_rastreamento_pedido_id ON public.rastreamento_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rastreamento_criado_em ON public.rastreamento_pedidos(criado_em DESC);

-- Comentários
COMMENT ON TABLE public.rastreamento_pedidos IS 'Histórico de rastreamento de pedidos online';
COMMENT ON COLUMN public.rastreamento_pedidos.status IS 'Status do pedido: recebido, aguardando_pagamento, pago, aceito, preparo, saiu, entregue, cancelado, expirado';

-- Habilita RLS
ALTER TABLE public.rastreamento_pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "anon ve rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "anon ve rastreamento" ON public.rastreamento_pedidos
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "staff ve todos rastreamentos" ON public.rastreamento_pedidos;
CREATE POLICY "staff ve todos rastreamentos" ON public.rastreamento_pedidos
  FOR SELECT TO authenticated USING (true);

-- Grants
GRANT SELECT ON public.rastreamento_pedidos TO anon, authenticated;
GRANT INSERT ON public.rastreamento_pedidos TO authenticated, service_role;

-- ============================================
-- 2. Tabela de notificações de delivery
-- ============================================
-- Armazena notificações pendentes para o módulo de delivery

CREATE TABLE IF NOT EXISTS public.notificacoes_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'novo_pedido', -- 'novo_pedido', 'pagamento_confirmado', 'pedido_expirado'
  mensagem text,
  analisado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  analisado_em timestamptz
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_notificacoes_pedido_id ON public.notificacoes_delivery(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_analisado ON public.notificacoes_delivery(analisado);
CREATE INDEX IF NOT EXISTS idx_notificacoes_criado_em ON public.notificacoes_delivery(criado_em DESC);

-- Comentários
COMMENT ON TABLE public.notificacoes_delivery IS 'Notificações para o módulo de delivery';
COMMENT ON COLUMN public.notificacoes_delivery.analisado IS 'Se a notificação foi analisada pelo operador';

-- Habilita RLS
ALTER TABLE public.notificacoes_delivery ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "staff ve notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff ve notificacoes" ON public.notificacoes_delivery
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff atualiza notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff atualiza notificacoes" ON public.notificacoes_delivery
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- Grants
GRANT SELECT ON public.notificacoes_delivery TO authenticated;
GRANT INSERT ON public.notificacoes_delivery TO authenticated, service_role;
GRANT UPDATE ON public.notificacoes_delivery TO authenticated;

-- ============================================
-- 3. Função para adicionar evento de rastreamento
-- ============================================

CREATE OR REPLACE FUNCTION public.adicionar_rastreamento(
  _pedido_id uuid,
  _status text,
  _descricao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
  VALUES (_pedido_id, _status, _descricao)
  RETURNING to_jsonb(rastreamento_pedidos) INTO result;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.adicionar_rastreamento(uuid, text, text) TO anon, authenticated;

-- ============================================
-- 4. Função para listar rastreamento de um pedido
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_rastreamento(_pedido_id uuid)
RETURNS TABLE(
  id uuid,
  pedido_id uuid,
  status text,
  descricao text,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rp.id,
    rp.pedido_id,
    rp.status,
    rp.descricao,
    rp.criado_em
  FROM public.rastreamento_pedidos rp
  WHERE rp.pedido_id = _pedido_id
  ORDER BY rp.criado_em ASC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_rastreamento(uuid) TO anon, authenticated;

-- ============================================
-- 5. Função para criar notificação de delivery
-- ============================================

CREATE OR REPLACE FUNCTION public.criar_notificacao_delivery(
  _pedido_id uuid,
  _tipo text,
  _mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
  VALUES (_pedido_id, _tipo, _mensagem)
  RETURNING to_jsonb(notificacoes_delivery) INTO result;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.criar_notificacao_delivery(uuid, text, text) TO authenticated, service_role;

-- ============================================
-- 6. Função para marcar notificação como analisada
-- ============================================

CREATE OR REPLACE FUNCTION public.marcar_notificacao_analisada(_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.notificacoes_delivery
  SET analisado = true,
      analisado_em = NOW()
  WHERE id = _notificacao_id
  RETURNING to_jsonb(notificacoes_delivery) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Notificação não encontrada';
  END IF;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao_analisada(uuid) TO authenticated;

-- ============================================
-- 7. Função para listar notificações pendentes
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_notificacoes_pendentes()
RETURNS TABLE(
  id uuid,
  pedido_id uuid,
  tipo text,
  mensagem text,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    nd.id,
    nd.pedido_id,
    nd.tipo,
    nd.mensagem,
    nd.criado_em
  FROM public.notificacoes_delivery nd
  WHERE nd.analisado = false
  ORDER BY nd.criado_em DESC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_notificacoes_pendentes() TO authenticated;

-- ============================================
-- 8. Trigger automática para rastreamento
-- ============================================
-- Quando um pedido é criado ou atualizado, registra automaticamente no rastreamento

CREATE OR REPLACE FUNCTION public.auto_rastreamento_pedidos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Registra o recebimento do pedido
    INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
    VALUES (NEW.id, 'recebido', 'Pedido recebido na loja online');
    
    -- Cria notificação de novo pedido
    INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
    VALUES (NEW.id, 'novo_pedido', 'Novo pedido de ' || NEW.cliente);
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Registra mudanças de status
    IF OLD.status != NEW.status THEN
      INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
      VALUES (NEW.id, NEW.status, 'Status alterado de ' || OLD.status || ' para ' || NEW.status);
      
      -- Se o pagamento foi confirmado, cria notificação
      IF NEW.status = 'pago' AND OLD.status = 'aguardando_pagamento' THEN
        INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
        VALUES (NEW.id, 'pagamento_confirmado', 'Pagamento confirmado para pedido de ' || NEW.cliente);
      END IF;
    END IF;
    
    -- Se o pedido foi expirado, cria notificação
    IF NEW.status = 'cancelado' AND NEW.status_pagamento = 'expirado' AND (OLD.status != NEW.status OR OLD.status_pagamento != NEW.status_pagamento) THEN
      INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
      VALUES (NEW.id, 'expirado', 'Tempo de pagamento expirado');
      
      INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
      VALUES (NEW.id, 'pedido_expirado', 'Pedido de ' || NEW.cliente || ' expirado');
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_rastreamento ON public.pedidos_online;
CREATE TRIGGER auto_rastreamento
  AFTER INSERT OR UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_rastreamento_pedidos();

-- ============================================
-- 9. Configurar Realtime para novas tabelas
-- ============================================

ALTER TABLE public.rastreamento_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes_delivery REPLICA IDENTITY FULL;

-- Adiciona tabelas à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rastreamento_pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_delivery;

-- ============================================
-- 10. Grants para authenticated
-- ============================================

GRANT SELECT ON public.rastreamento_pedidos TO authenticated;
GRANT SELECT ON public.notificacoes_delivery TO authenticated;

-- ============================================
-- 11. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
