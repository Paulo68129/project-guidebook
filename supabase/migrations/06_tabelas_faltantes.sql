-- =====================================================================
-- SQL PARA CRIAR AS 6 TABELAS FALTANTES - PizzaStockAI
-- =====================================================================
-- Copie e cole este SQL no Supabase SQL Editor:
-- 1. Acesse https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. No menu lateral, clique em SQL Editor
-- 4. Clique em "New Query"
-- 5. Cole este SQL e clique em "Run"
--
-- Este script cria apenas as 6 tabelas que estão faltando:
--   - pagamentos_online
--   - pedidos_online_audit
--   - rastreamento_pedidos
--   - notificacoes_delivery
--   - feedback_clientes
--   - respostas_feedback
--
-- É idempotente: pode ser executado múltiplas vezes sem erros.
-- =====================================================================

-- ============================================
-- 1. TABELAS
-- ============================================

-- 1.1. Pagamentos online (auditoria de pagamentos)
CREATE TABLE IF NOT EXISTS public.pagamentos_online (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  transaction_id text,
  status text NOT NULL DEFAULT 'aguardando',
  metodo text NOT NULL DEFAULT 'pix',
  valor numeric NOT NULL DEFAULT 0,
  qr_code text,
  pix_copia_cola text,
  payload_webhook jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2. Auditoria de pedidos online
CREATE TABLE IF NOT EXISTS public.pedidos_online_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  acao text NOT NULL,
  detalhes jsonb,
  usuario_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 1.3. Rastreamento de pedidos
CREATE TABLE IF NOT EXISTS public.rastreamento_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  status text NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 1.4. Notificações de delivery
CREATE TABLE IF NOT EXISTS public.notificacoes_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'novo_pedido',
  mensagem text,
  analisado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  analisado_em timestamptz
);

-- 1.5. Feedback de clientes
CREATE TABLE IF NOT EXISTS public.feedback_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos_online(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  nota integer NOT NULL CHECK (nota BETWEEN 1 AND 5),
  mensagem text,
  aprovado boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.6. Respostas de feedback
CREATE TABLE IF NOT EXISTS public.respostas_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_clientes(id) ON DELETE CASCADE,
  resposta text NOT NULL,
  respondido_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pagamentos_online_pedido_id ON public.pagamentos_online(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_transaction_id ON public.pagamentos_online(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_status ON public.pagamentos_online(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_audit_pedido_id ON public.pedidos_online_audit(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rastreamento_pedido_id ON public.rastreamento_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rastreamento_criado_em ON public.rastreamento_pedidos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_pedido_id ON public.notificacoes_delivery(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_analisado ON public.notificacoes_delivery(analisado);
CREATE INDEX IF NOT EXISTS idx_notificacoes_criado_em ON public.notificacoes_delivery(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_pedido_id ON public.feedback_clientes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_feedback_nota ON public.feedback_clientes(nota);

-- ============================================
-- 3. TRIGGERS DE updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_pagamentos_online ON public.pagamentos_online;
CREATE TRIGGER set_updated_at_pagamentos_online 
  BEFORE UPDATE ON public.pagamentos_online 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_feedback_clientes ON public.feedback_clientes;
CREATE TRIGGER set_updated_at_feedback_clientes 
  BEFORE UPDATE ON public.feedback_clientes 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_respostas_feedback ON public.respostas_feedback;
CREATE TRIGGER set_updated_at_respostas_feedback 
  BEFORE UPDATE ON public.respostas_feedback 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.pagamentos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_online_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rastreamento_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas para pagamentos_online
DROP POLICY IF EXISTS "anon consulta pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon consulta pagamentos" ON public.pagamentos_online
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon insere pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon insere pagamentos" ON public.pagamentos_online
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon atualiza pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon atualiza pagamentos" ON public.pagamentos_online
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "staff acessa pagamentos" ON public.pagamentos_online;
CREATE POLICY "staff acessa pagamentos" ON public.pagamentos_online
  FOR ALL TO authenticated USING (true);

-- Políticas para pedidos_online_audit
DROP POLICY IF EXISTS "staff ve audit" ON public.pedidos_online_audit;
CREATE POLICY "staff ve audit" ON public.pedidos_online_audit
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff insere audit" ON public.pedidos_online_audit;
CREATE POLICY "staff insere audit" ON public.pedidos_online_audit
  FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para rastreamento_pedidos
DROP POLICY IF EXISTS "anon ve rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "anon ve rastreamento" ON public.rastreamento_pedidos
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "staff ve rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "staff ve rastreamento" ON public.rastreamento_pedidos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff insere rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "staff insere rastreamento" ON public.rastreamento_pedidos
  FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para notificacoes_delivery
DROP POLICY IF EXISTS "staff ve notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff ve notificacoes" ON public.notificacoes_delivery
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff atualiza notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff atualiza notificacoes" ON public.notificacoes_delivery
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "staff insere notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff insere notificacoes" ON public.notificacoes_delivery
  FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para feedback_clientes
DROP POLICY IF EXISTS "anon insere feedback" ON public.feedback_clientes;
CREATE POLICY "anon insere feedback" ON public.feedback_clientes
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon ve feedback aprovado" ON public.feedback_clientes;
CREATE POLICY "anon ve feedback aprovado" ON public.feedback_clientes
  FOR SELECT TO anon USING (aprovado);
DROP POLICY IF EXISTS "staff ve todos feedback" ON public.feedback_clientes;
CREATE POLICY "staff ve todos feedback" ON public.feedback_clientes
  FOR ALL TO authenticated USING (true);

-- Políticas para respostas_feedback
DROP POLICY IF EXISTS "anon ve respostas" ON public.respostas_feedback;
CREATE POLICY "anon ve respostas" ON public.respostas_feedback
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "staff gerencia respostas" ON public.respostas_feedback;
CREATE POLICY "staff gerencia respostas" ON public.respostas_feedback
  FOR ALL TO authenticated USING (true);

-- ============================================
-- 5. GRANTS
-- ============================================

GRANT ALL ON public.pagamentos_online TO service_role;
GRANT ALL ON public.pedidos_online_audit TO service_role;
GRANT ALL ON public.rastreamento_pedidos TO service_role;
GRANT ALL ON public.notificacoes_delivery TO service_role;
GRANT ALL ON public.feedback_clientes TO service_role;
GRANT ALL ON public.respostas_feedback TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.pagamentos_online TO anon, authenticated;
GRANT SELECT ON public.pedidos_online_audit TO authenticated;
GRANT SELECT ON public.rastreamento_pedidos TO anon, authenticated;
GRANT INSERT ON public.rastreamento_pedidos TO authenticated, service_role;
GRANT SELECT ON public.notificacoes_delivery TO authenticated;
GRANT INSERT ON public.notificacoes_delivery TO authenticated, service_role;
GRANT UPDATE ON public.notificacoes_delivery TO authenticated;
GRANT SELECT, INSERT ON public.feedback_clientes TO anon, authenticated;
GRANT SELECT ON public.respostas_feedback TO anon, authenticated;

-- ============================================
-- 6. REALTIME
-- ============================================

ALTER TABLE public.pagamentos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos_online_audit REPLICA IDENTITY FULL;
ALTER TABLE public.rastreamento_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes_delivery REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_clientes REPLICA IDENTITY FULL;
ALTER TABLE public.respostas_feedback REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_online;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online_audit;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rastreamento_pedidos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_delivery;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_clientes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.respostas_feedback;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 7. TRIGGER DE RASTREAMENTO AUTOMÁTICO
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_rastreamento_pedidos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
    VALUES (NEW.id, 'recebido', 'Pedido recebido na loja online');
    INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
    VALUES (NEW.id, 'novo_pedido', 'Novo pedido de ' || NEW.cliente);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
      VALUES (NEW.id, NEW.status, 'Status alterado de ' || OLD.status || ' para ' || NEW.status);
      IF NEW.status = 'pago' AND OLD.status = 'aguardando_pagamento' THEN
        INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
        VALUES (NEW.id, 'pagamento_confirmado', 'Pagamento confirmado para pedido de ' || NEW.cliente);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_rastreamento ON public.pedidos_online;
CREATE TRIGGER auto_rastreamento
  AFTER INSERT OR UPDATE ON public.pedidos_online
  FOR EACH ROW EXECUTE FUNCTION public.auto_rastreamento_pedidos();

-- ============================================
-- 8. FUNÇÕES DE FEEDBACK
-- ============================================

CREATE OR REPLACE FUNCTION public.criar_feedback(
  _pedido_id uuid,
  _cliente_nome text,
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
  INSERT INTO public.feedback_clientes (
    pedido_id, cliente_nome, nota, mensagem, aprovado
  ) VALUES (
    _pedido_id, _cliente_nome, _nota, _comentario, true
  ) RETURNING to_jsonb(feedback_clientes) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.criar_feedback(uuid, text, integer, text) TO anon, authenticated;

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
    'media_geral', COALESCE((SELECT round(avg(nota)::numeric, 1) FROM public.feedback_clientes WHERE aprovado = true), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.estatisticas_feedback() TO anon, authenticated;

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
  mensagem text,
  resposta text,
  created_at timestamptz
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
    f.mensagem,
    r.resposta,
    f.created_at
  FROM public.feedback_clientes f
  LEFT JOIN public.respostas_feedback r ON r.feedback_id = f.id
  WHERE f.aprovado = true
    AND (_nota_filtro IS NULL OR f.nota = _nota_filtro)
  ORDER BY f.created_at DESC
  LIMIT _limite
  OFFSET _offset;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feedbacks_aprovados(integer, integer, integer) TO anon, authenticated;

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
  nota integer,
  mensagem text,
  aprovado boolean,
  resposta text,
  created_at timestamptz
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
    f.mensagem,
    f.aprovado,
    r.resposta,
    f.created_at
  FROM public.feedback_clientes f
  LEFT JOIN public.respostas_feedback r ON r.feedback_id = f.id
  WHERE (_nota_filtro IS NULL OR f.nota = _nota_filtro)
    AND (_aprovado_filtro IS NULL OR f.aprovado = _aprovado_filtro)
  ORDER BY f.created_at DESC
  LIMIT _limite
  OFFSET _offset;
$$;

GRANT EXECUTE ON FUNCTION public.listar_todos_feedbacks(integer, integer, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.responder_feedback(_feedback_id uuid, _resposta text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO public.respostas_feedback (feedback_id, resposta, respondido_por)
  VALUES (_feedback_id, _resposta, auth.uid())
  RETURNING to_jsonb(respostas_feedback) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.responder_feedback(uuid, text) TO authenticated;

-- ============================================
-- 9. FUNÇÕES DE RASTREAMENTO
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
  SELECT rp.id, rp.pedido_id, rp.status, rp.descricao, rp.criado_em
  FROM public.rastreamento_pedidos rp
  WHERE rp.pedido_id = _pedido_id
  ORDER BY rp.criado_em ASC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_rastreamento(uuid) TO anon, authenticated;

-- ============================================
-- 10. FUNÇÃO DE MIGRAÇÃO (para /api/apply-migrations)
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

GRANT EXECUTE ON FUNCTION public.apply_migration_sql(text) TO anon, authenticated;

-- ============================================
-- 11. RELOAD DO SCHEMA
-- ============================================

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM DO SCRIPT
-- =====================================================================
-- Após executar, verifique se as tabelas foram criadas:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;
-- =====================================================================
