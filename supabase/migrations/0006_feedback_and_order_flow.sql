-- ============================================
-- MIGRAÇÃO: Sistema de Avaliações e Feedback + Aceite/Recusa de Pedidos
-- ============================================
-- 1. Tabela de avaliações e feedbacks dos clientes
-- 2. Tabela de respostas da loja aos feedbacks
-- 3. Colunas para aceite/recusa de pedidos
-- 4. Funções para gerenciar avaliações
-- 5. Políticas RLS para segurança
-- ============================================

-- ============================================
-- 1. Adicionar colunas de aceite/recusa à tabela pedidos_online
-- ============================================

ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS status_delivery text DEFAULT 'pendente';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS motivo_recusa text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS aceito_em timestamptz;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS recusado_em timestamptz;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS entregue_em timestamptz;

-- Comentário das colunas
COMMENT ON COLUMN public.pedidos_online.status_delivery IS 'Status do pedido no delivery: pendente, aceito, recusado';
COMMENT ON COLUMN public.pedidos_online.motivo_recusa IS 'Motivo da recusa do pedido';

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status_delivery ON public.pedidos_online(status_delivery);

-- ============================================
-- 2. Função para aceitar pedido
-- ============================================

CREATE OR REPLACE FUNCTION public.aceitar_pedido(_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.pedidos_online
  SET status_delivery = 'aceito',
      aceito_em = NOW(),
      status = CASE 
        WHEN status = 'aguardando_pagamento' THEN 'pago'
        WHEN status = 'pago' THEN 'preparo'
        ELSE status
      END
  WHERE id = _pedido_id
    AND status_delivery = 'pendente'
  RETURNING to_jsonb(pedidos_online) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  -- Registra no audit log
  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
  VALUES (_pedido_id, 'aceito', jsonb_build_object('timestamp', NOW()::text), auth.uid());

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.aceitar_pedido(uuid) TO authenticated;

-- ============================================
-- 3. Função para recusar pedido
-- ============================================

CREATE OR REPLACE FUNCTION public.recusar_pedido(_pedido_id uuid, _motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.pedidos_online
  SET status_delivery = 'recusado',
      motivo_recusa = _motivo,
      recusado_em = NOW(),
      status = 'cancelado'
  WHERE id = _pedido_id
    AND status_delivery = 'pendente'
  RETURNING to_jsonb(pedidos_online) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  -- Registra no audit log
  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
  VALUES (_pedido_id, 'recusado', jsonb_build_object('motivo', _motivo, 'timestamp', NOW()::text), auth.uid());

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.recusar_pedido(uuid, text) TO authenticated;

-- ============================================
-- 4. Tabela de avaliações e feedbacks
-- ============================================

CREATE TABLE IF NOT EXISTS public.feedback_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id),
  cliente_nome text NOT NULL,
  cliente_email text,
  nota integer NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text,
  aprovado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_feedback_clientes_pedido_id ON public.feedback_clientes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_feedback_clientes_nota ON public.feedback_clientes(nota);
CREATE INDEX IF NOT EXISTS idx_feedback_clientes_aprovado ON public.feedback_clientes(aprovado);
CREATE INDEX IF NOT EXISTS idx_feedback_clientes_criado_em ON public.feedback_clientes(criado_em DESC);

-- Comentários
COMMENT ON TABLE public.feedback_clientes IS 'Avaliações e feedbacks dos clientes após entrega';
COMMENT ON COLUMN public.feedback_clientes.nota IS 'Nota de 1 a 5 estrelas';
COMMENT ON COLUMN public.feedback_clientes.aprovado IS 'Se o feedback foi aprovado pelo administrador para exibição pública';

-- Habilita RLS
ALTER TABLE public.feedback_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "anon cria feedback" ON public.feedback_clientes;
CREATE POLICY "anon cria feedback" ON public.feedback_clientes
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon ve feedbacks aprovados" ON public.feedback_clientes;
CREATE POLICY "anon ve feedbacks aprovados" ON public.feedback_clientes
  FOR SELECT TO anon USING (aprovado = true);

DROP POLICY IF EXISTS "staff ve todos feedbacks" ON public.feedback_clientes;
CREATE POLICY "staff ve todos feedbacks" ON public.feedback_clientes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff atualiza feedbacks" ON public.feedback_clientes;
CREATE POLICY "staff atualiza feedbacks" ON public.feedback_clientes
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- Grants
GRANT SELECT ON public.feedback_clientes TO authenticated;
GRANT INSERT ON public.feedback_clientes TO anon, authenticated;
GRANT UPDATE ON public.feedback_clientes TO authenticated;

-- ============================================
-- 5. Tabela de respostas da loja aos feedbacks
-- ============================================

CREATE TABLE IF NOT EXISTS public.respostas_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_clientes(id) ON DELETE CASCADE,
  resposta text NOT NULL,
  respondido_por uuid REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_respostas_feedback_feedback_id ON public.respostas_feedback(feedback_id);

-- Comentários
COMMENT ON TABLE public.respostas_feedback IS 'Respostas da loja aos feedbacks dos clientes';

-- Habilita RLS
ALTER TABLE public.respostas_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "anon ve respostas" ON public.respostas_feedback;
CREATE POLICY "anon ve respostas" ON public.respostas_feedback
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "staff cria respostas" ON public.respostas_feedback;
CREATE POLICY "staff cria respostas" ON public.respostas_feedback
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff ve todas respostas" ON public.respostas_feedback;
CREATE POLICY "staff ve todas respostas" ON public.respostas_feedback
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Grants
GRANT ALL ON public.respostas_feedback TO authenticated;

-- ============================================
-- 6. Função para criar feedback
-- ============================================

CREATE OR REPLACE FUNCTION public.criar_feedback(
  _pedido_id uuid,
  _cliente_nome text,
  _cliente_email text DEFAULT NULL,
  _nota integer,
  _comentario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  -- Verifica se o pedido existe e foi entregue
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_online 
    WHERE id = _pedido_id AND status = 'entregue'
  ) THEN
    RAISE EXCEPTION 'Apenas pedidos entregues podem ser avaliados';
  END IF;

  -- Verifica se o cliente já avaliou este pedido
  IF EXISTS (
    SELECT 1 FROM public.feedback_clientes 
    WHERE pedido_id = _pedido_id
  ) THEN
    RAISE EXCEPTION 'Este pedido já foi avaliado';
  END IF;

  -- Insere o feedback
  INSERT INTO public.feedback_clientes (
    pedido_id, cliente_nome, cliente_email, nota, comentario
  ) VALUES (
    _pedido_id, _cliente_nome, _cliente_email, _nota, _comentario
  ) RETURNING to_jsonb(feedback_clientes) INTO result;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.criar_feedback(uuid, text, text, integer, text) TO anon, authenticated;

-- ============================================
-- 7. Função para aprovar/ocultar feedback
-- ============================================

CREATE OR REPLACE FUNCTION public.modificar_feedback_aprovacao(_feedback_id uuid, _aprovado boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.feedback_clientes
  SET aprovado = _aprovado,
      atualizado_em = NOW()
  WHERE id = _feedback_id
  RETURNING to_jsonb(feedback_clientes) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Feedback não encontrado';
  END IF;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.modificar_feedback_aprovacao(uuid, boolean) TO authenticated;

-- ============================================
-- 8. Função para responder feedback
-- ============================================

CREATE OR REPLACE FUNCTION public.responder_feedback(_feedback_id uuid, _resposta text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  -- Verifica se já existe resposta
  IF EXISTS (SELECT 1 FROM public.respostas_feedback WHERE feedback_id = _feedback_id) THEN
    -- Atualiza a resposta existente
    UPDATE public.respostas_feedback
    SET resposta = _resposta,
        criado_em = NOW()
    WHERE feedback_id = _feedback_id
    RETURNING to_jsonb(respostas_feedback) INTO result;
  ELSE
    -- Cria nova resposta
    INSERT INTO public.respostas_feedback (feedback_id, resposta, respondido_por)
    VALUES (_feedback_id, _resposta, auth.uid())
    RETURNING to_jsonb(respostas_feedback) INTO result;
  END IF;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.responder_feedback(uuid, text) TO authenticated;

-- ============================================
-- 9. Função para listar feedbacks aprovados (público)
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_feedbacks_aprovados(
  _limite integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _nota_filtro integer DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  pedido_id uuid,
  cliente_nome text,
  nota integer,
  comentario text,
  resposta text,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.pedido_id,
    f.cliente_nome,
    f.nota,
    f.comentario,
    r.resposta,
    f.criado_em
  FROM public.feedback_clientes f
  LEFT JOIN public.respostas_feedback r ON r.feedback_id = f.id
  WHERE f.aprovado = true
    AND (_nota_filtro IS NULL OR f.nota = _nota_filtro)
  ORDER BY f.criado_em DESC
  LIMIT _limite
  OFFSET _offset;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feedbacks_aprovados(integer, integer, integer) TO anon, authenticated;

-- ============================================
-- 10. Função para estatísticas de feedback
-- ============================================

CREATE OR REPLACE FUNCTION public.estatisticas_feedback()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_feedbacks', (SELECT count(*) FROM public.feedback_clientes),
    'total_aprovados', (SELECT count(*) FROM public.feedback_clientes WHERE aprovado = true),
    'media_geral', COALESCE((SELECT round(avg(nota)::numeric, 1) FROM public.feedback_clientes WHERE aprovado = true), 0),
    'media_por_nota', (
      SELECT jsonb_object_agg(
        n::text,
        count(*)
      )
      FROM (
        SELECT nota FROM public.feedback_clientes WHERE aprovado = true
      ) sub
      GROUP BY n
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.estatisticas_feedback() TO anon, authenticated;

-- ============================================
-- 11. Função para listar todos feedbacks (admin)
-- ============================================

CREATE OR REPLACE FUNCTION public.listar_todos_feedbacks(
  _limite integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _nota_filtro integer DEFAULT NULL,
  _aprovado_filtro boolean DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  pedido_id uuid,
  cliente_nome text,
  cliente_email text,
  nota integer,
  comentario text,
  aprovado boolean,
  resposta text,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.pedido_id,
    f.cliente_nome,
    f.cliente_email,
    f.nota,
    f.comentario,
    f.aprovado,
    r.resposta,
    f.criado_em
  FROM public.feedback_clientes f
  LEFT JOIN public.respostas_feedback r ON r.feedback_id = f.id
  WHERE (_nota_filtro IS NULL OR f.nota = _nota_filtro)
    AND (_aprovado_filtro IS NULL OR f.aprovado = _aprovado_filtro)
  ORDER BY f.criado_em DESC
  LIMIT _limite
  OFFSET _offset;
$$;

GRANT EXECUTE ON FUNCTION public.listar_todos_feedbacks(integer, integer, integer, boolean) TO authenticated;

-- ============================================
-- 12. Habilitar Realtime para feedback_clientes
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_clientes;

-- ============================================
-- 13. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
