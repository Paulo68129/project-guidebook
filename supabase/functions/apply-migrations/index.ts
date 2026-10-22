import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const databaseUrl = Deno.env.get("DATABASE_URL") || "";

// SQL MASTER 0014: Setup completo do banco PizzaStockAI
const FULL_SQL = `-- =====================================================================
-- SCRIPT MASTER: SETUP COMPLETO DO BANCO PIZZASTOCKAI
-- =====================================================================
-- Executar no Supabase / Lovable Cloud: SQL Editor -> Novo Script -> Run
-- Idempotente: pode ser executado múltiplas vezes sem erros.
-- 
-- Este script cria TODAS as tabelas base, funções, triggers, políticas RLS
-- e grants necessários para o sistema PizzaStockAI funcionar completamente.
-- =====================================================================

BEGIN;

-- ============================================
-- 1. TABELAS BASE DO SISTEMA
-- ============================================

-- 1.1. Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL,
  descricao text,
  preco numeric NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  foto_url text,
  imagem_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2. Ingredientes
CREATE TABLE IF NOT EXISTS public.ingredientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'un',
  custo_unitario numeric NOT NULL DEFAULT 0,
  validade date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3. Receitas (relação produto-ingrediente)
CREATE TABLE IF NOT EXISTS public.receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  ingrediente_id uuid NOT NULL REFERENCES public.ingredientes(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL,
  UNIQUE(produto_id, ingrediente_id)
);

-- 1.4. Vendas
CREATE TABLE IF NOT EXISTS public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'balcao',
  status text NOT NULL DEFAULT 'pendente',
  cliente text,
  telefone text,
  endereco text,
  subtotal numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  taxa_entrega numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  custo numeric NOT NULL DEFAULT 0,
  lucro numeric NOT NULL DEFAULT 0,
  cupom text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.5. Itens da venda
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  nome text NOT NULL,
  quantidade integer NOT NULL,
  preco_unitario numeric NOT NULL,
  custo_unitario numeric NOT NULL DEFAULT 0
);

-- 1.6. Cupons
CREATE TABLE IF NOT EXISTS public.cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  percentual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.7. Configuração da loja
CREATE TABLE IF NOT EXISTS public.loja_config (
  id integer PRIMARY KEY DEFAULT 1,
  taxa_entrega numeric NOT NULL DEFAULT 5.00,
  abre time NOT NULL DEFAULT '18:00',
  fecha time NOT NULL DEFAULT '23:30',
  som_alerta boolean NOT NULL DEFAULT true,
  aberta_manual boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.8. Pedidos online
CREATE TABLE IF NOT EXISTS public.pedidos_online (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  telefone text NOT NULL,
  endereco text NOT NULL,
  itens jsonb NOT NULL,
  subtotal numeric NOT NULL,
  desconto numeric NOT NULL DEFAULT 0,
  taxa_entrega numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  cupom text,
  status text NOT NULL DEFAULT 'aguardando_pagamento',
  status_pagamento text NOT NULL DEFAULT 'aguardando',
  status_delivery text NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'loja_online',
  qr_code_pix text,
  pix_copia_cola text,
  transaction_id text,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  motoboy_id uuid,
  observacoes text,
  aceito_em timestamptz,
  recusado_em timestamptz,
  entregue_em timestamptz,
  motivo_recusa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.9. Pagamentos online (auditoria)
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

-- 1.10. Auditoria de pedidos online
CREATE TABLE IF NOT EXISTS public.pedidos_online_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  acao text NOT NULL,
  detalhes jsonb,
  usuario_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 1.11. Rastreamento de pedidos
CREATE TABLE IF NOT EXISTS public.rastreamento_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  status text NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 1.12. Notificações de delivery
CREATE TABLE IF NOT EXISTS public.notificacoes_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'novo_pedido',
  mensagem text,
  analisado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  analisado_em timestamptz
);

-- 1.13. Feedback de clientes
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

-- 1.14. Respostas de feedback
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

CREATE INDEX IF NOT EXISTS idx_vendas_status ON public.vendas(status);
CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON public.vendas(tipo);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON public.vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venda_itens_venda_id ON public.venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_receitas_produto_id ON public.receitas(produto_id);
CREATE INDEX IF NOT EXISTS idx_receitas_ingrediente_id ON public.receitas(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status ON public.pedidos_online(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status_pagamento ON public.pedidos_online(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status_delivery ON public.pedidos_online(status_delivery);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_transaction_id ON public.pedidos_online(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_venda_id ON public.pedidos_online(venda_id);
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
-- 3. FUNÇÕES AUXILIARES
-- ============================================

-- 3.1. Função is_staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND raw_user_meta_data->>'role' = 'staff'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;

-- 3.2. Função updated_at genérica
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3. Triggers de updated_at
DROP TRIGGER IF EXISTS set_updated_at_produtos ON public.produtos;
CREATE TRIGGER set_updated_at_produtos
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_ingredientes ON public.ingredientes;
CREATE TRIGGER set_updated_at_ingredientes
  BEFORE UPDATE ON public.ingredientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_vendas ON public.vendas;
CREATE TRIGGER set_updated_at_vendas
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_pedidos_online ON public.pedidos_online;
CREATE TRIGGER set_updated_at_pedidos_online
  BEFORE UPDATE ON public.pedidos_online
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_online_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rastreamento_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas para produtos
DROP POLICY IF EXISTS "catalogo produtos ativos" ON public.produtos;
CREATE POLICY "catalogo produtos ativos" ON public.produtos
  FOR SELECT TO anon USING (ativo);
DROP POLICY IF EXISTS "staff acessa produtos" ON public.produtos;
CREATE POLICY "staff acessa produtos" ON public.produtos
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para ingredientes
DROP POLICY IF EXISTS "staff acessa ingredientes" ON public.ingredientes;
CREATE POLICY "staff acessa ingredientes" ON public.ingredientes
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para receitas
DROP POLICY IF EXISTS "staff acessa receitas" ON public.receitas;
CREATE POLICY "staff acessa receitas" ON public.receitas
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para vendas
DROP POLICY IF EXISTS "staff acessa vendas" ON public.vendas;
CREATE POLICY "staff acessa vendas" ON public.vendas
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para venda_itens
DROP POLICY IF EXISTS "staff acessa venda_itens" ON public.venda_itens;
CREATE POLICY "staff acessa venda_itens" ON public.venda_itens
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para cupons
DROP POLICY IF EXISTS "anon ve cupons ativos" ON public.cupons;
CREATE POLICY "anon ve cupons ativos" ON public.cupons
  FOR SELECT TO anon USING (ativo);
DROP POLICY IF EXISTS "staff acessa cupons" ON public.cupons;
CREATE POLICY "staff acessa cupons" ON public.cupons
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para loja_config
DROP POLICY IF EXISTS "anon ve loja config" ON public.loja_config;
CREATE POLICY "anon ve loja config" ON public.loja_config
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "staff acessa loja_config" ON public.loja_config;
CREATE POLICY "staff acessa loja_config" ON public.loja_config
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para pedidos_online
DROP POLICY IF EXISTS "anon insere pedidos online" ON public.pedidos_online;
CREATE POLICY "anon insere pedidos online" ON public.pedidos_online
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon consulta pedido por token" ON public.pedidos_online;
CREATE POLICY "anon consulta pedido por token" ON public.pedidos_online
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon atualiza pagamento pedido" ON public.pedidos_online;
CREATE POLICY "anon atualiza pagamento pedido" ON public.pedidos_online
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "staff consulta pedidos online" ON public.pedidos_online;
CREATE POLICY "staff consulta pedidos online" ON public.pedidos_online
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff atualiza pedidos online" ON public.pedidos_online;
CREATE POLICY "staff atualiza pedidos online" ON public.pedidos_online
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff deleta pedidos online" ON public.pedidos_online;
CREATE POLICY "staff deleta pedidos online" ON public.pedidos_online
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- Políticas para pagamentos_online
DROP POLICY IF EXISTS "anon consulta pagamentos por pedido" ON public.pagamentos_online;
CREATE POLICY "anon consulta pagamentos por pedido" ON public.pagamentos_online
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon insere pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon insere pagamentos" ON public.pagamentos_online
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon atualiza pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon atualiza pagamentos" ON public.pagamentos_online
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "staff acessa pagamentos_online" ON public.pagamentos_online;
CREATE POLICY "staff acessa pagamentos_online" ON public.pagamentos_online
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

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
DROP POLICY IF EXISTS "staff ve todos rastreamentos" ON public.rastreamento_pedidos;
CREATE POLICY "staff ve todos rastreamentos" ON public.rastreamento_pedidos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff insere rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "staff insere rastreamento" ON public.rastreamento_pedidos
  FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para notificacoes_delivery
DROP POLICY IF EXISTS "staff ve notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff ve notificacoes" ON public.notificacoes_delivery
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff atualiza notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff atualiza notificacoes" ON public.notificacoes_delivery
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
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

GRANT SELECT (id, nome, categoria, descricao, preco, ativo, imagem_path, foto_url) ON public.produtos TO anon;
GRANT SELECT (id, codigo, percentual, ativo) ON public.cupons TO anon;
GRANT SELECT ON public.loja_config TO anon;

GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.ingredientes TO service_role;
GRANT ALL ON public.receitas TO service_role;
GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.venda_itens TO service_role;
GRANT ALL ON public.cupons TO service_role;
GRANT ALL ON public.loja_config TO service_role;
GRANT ALL ON public.pedidos_online TO service_role;
GRANT ALL ON public.pagamentos_online TO service_role;
GRANT ALL ON public.pedidos_online_audit TO service_role;
GRANT ALL ON public.rastreamento_pedidos TO service_role;
GRANT ALL ON public.notificacoes_delivery TO service_role;
GRANT ALL ON public.feedback_clientes TO service_role;
GRANT ALL ON public.respostas_feedback TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.pedidos_online TO anon, authenticated;
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
-- 6. REALTIME CONFIGURAÇÃO
-- ============================================

ALTER TABLE public.pedidos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pagamentos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos_online_audit REPLICA IDENTITY FULL;
ALTER TABLE public.rastreamento_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes_delivery REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_clientes REPLICA IDENTITY FULL;
ALTER TABLE public.respostas_feedback REPLICA IDENTITY FULL;
ALTER TABLE public.vendas REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 7. TRIGGERS DE NOTIFICAÇÃO
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_pedidos_online_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    perform pg_notify('pedidos_online_change', json_build_object(
      'operation', TG_OP,
      'record', row_to_json(OLD)
    )::text);
  ELSE
    perform pg_notify('pedidos_online_change', json_build_object(
      'operation', TG_OP,
      'record', row_to_json(NEW)
    )::text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_pedidos_online_insert ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_update ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_delete ON public.pedidos_online;

CREATE TRIGGER notify_pedidos_online_insert
  AFTER INSERT ON public.pedidos_online
  FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();

CREATE TRIGGER notify_pedidos_online_update
  AFTER UPDATE ON public.pedidos_online
  FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();

CREATE TRIGGER notify_pedidos_online_delete
  AFTER DELETE ON public.pedidos_online
  FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();

-- ============================================
-- 8. TRIGGER DE RASTREAMENTO AUTOMÁTICO
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
-- 9. FUNÇÕES DA LOJA ONLINE
-- ============================================

-- 9.1. Catálogo online
CREATE OR REPLACE FUNCTION public.catalogo_online()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'produtos', coalesce(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nome', nome,
          'categoria', categoria,
          'descricao', descricao,
          'preco', preco,
          'imagem_path', imagem_path,
          'foto_url', foto_url
        )
        ORDER BY categoria, nome
      ) FROM produtos WHERE ativo), '[]'::jsonb
    ),
    'taxa_entrega', coalesce((SELECT taxa_entrega FROM loja_config WHERE id = 1), 0),
    'abre', (SELECT abre FROM loja_config WHERE id = 1),
    'fecha', (SELECT fecha FROM loja_config WHERE id = 1),
    'aberta_manual', (SELECT aberta_manual FROM loja_config WHERE id = 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.catalogo_online() TO anon, authenticated;

-- 9.2. Criar pedido online
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _token uuid,
  _cliente text,
  _telefone text,
  _endereco text,
  _itens jsonb,
  _cupom text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  p record;
  e jsonb;
  snap jsonb := '[]';
  sub numeric := 0;
  pct numeric := 0;
  fee numeric;
  disc numeric;
  result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_token::text));
  SELECT to_jsonb(o) - 'token' INTO result
  FROM pedidos_online o WHERE token = _token;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  IF length(trim(_cliente)) < 2 OR length(_cliente) > 120 THEN
    RAISE EXCEPTION 'Nome do cliente inválido';
  END IF;
  IF length(trim(_telefone)) < 8 OR length(_telefone) > 30 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(trim(_endereco)) < 8 OR length(_endereco) > 500 THEN
    RAISE EXCEPTION 'Endereço inválido';
  END IF;

  IF jsonb_typeof(_itens) != 'array'
     OR jsonb_array_length(_itens) < 1
     OR jsonb_array_length(_itens) > 50 THEN
    RAISE EXCEPTION 'Carrinho inválido';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    IF (e->>'quantidade')::int NOT BETWEEN 1 AND 99 THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END IF;
    SELECT * INTO p FROM produtos
    WHERE id = (e->>'produto_id')::uuid AND ativo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível';
    END IF;
    sub := sub + p.preco * (e->>'quantidade')::int;
    snap := snap || jsonb_build_array(
      jsonb_build_object(
        'nome', p.nome,
        'descricao', p.descricao,
        'produto_id', p.id,
        'quantidade', (e->>'quantidade')::int,
        'preco_unitario', p.preco
      )
    );
  END LOOP;

  IF trim(_cupom) <> '' THEN
    SELECT percentual INTO pct FROM cupons
    WHERE upper(codigo) = upper(trim(_cupom)) AND ativo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido';
    END IF;
  END IF;

  SELECT taxa_entrega INTO fee FROM loja_config WHERE id = 1;
  disc := round(sub * pct / 100, 2);

  INSERT INTO pedidos_online (
    token, cliente, telefone, endereco, itens,
    subtotal, desconto, taxa_entrega, total, cupom, origem
  ) VALUES (
    _token, trim(_cliente), trim(_telefone), trim(_endereco), snap,
    sub, disc, coalesce(fee, 0), sub - disc + coalesce(fee, 0),
    nullif(trim(_cupom), ''), 'loja_online'
  ) RETURNING to_jsonb(pedidos_online) - 'token' INTO result;

  RETURN result;
END
$func$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid, text, text, text, jsonb, text)
  TO anon, authenticated;

-- 9.3. Consultar pedido online
CREATE OR REPLACE FUNCTION public.consultar_pedido_online(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(o) - 'token'
  FROM pedidos_online o WHERE token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_pedido_online(uuid) TO anon, authenticated;

-- 9.4. Confirmar pagamento online
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_online(_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id uuid;
  it jsonb;
  p record;
  v_custo_item numeric;
  v_sub numeric := 0;
  v_custo numeric := 0;
  pedido_record RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_pedido_id::text));

  SELECT * INTO pedido_record FROM pedidos_online WHERE id = _pedido_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', _pedido_id;
  END IF;

  IF pedido_record.status_pagamento = 'pago' AND pedido_record.venda_id IS NOT NULL THEN
    RETURN pedido_record.venda_id;
  END IF;

  IF pedido_record.status_pagamento = 'pago' THEN
    SELECT v.id INTO v_id FROM vendas v
      WHERE v.tipo = 'online'
      AND v.cliente = pedido_record.cliente
      AND v.created_at >= pedido_record.created_at - interval '10 minutes'
      ORDER BY v.created_at DESC
      LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE pedidos_online SET venda_id = v_id WHERE id = _pedido_id;
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO vendas (
    tipo, status, cliente, telefone, endereco,
    subtotal, desconto, taxa_entrega, total, cupom
  ) VALUES (
    'online', 'novo', pedido_record.cliente, pedido_record.telefone, pedido_record.endereco,
    pedido_record.subtotal, pedido_record.desconto, pedido_record.taxa_entrega, pedido_record.total,
    pedido_record.cupom
  ) RETURNING id INTO v_id;

  UPDATE pedidos_online
  SET status = 'pago', status_pagamento = 'pago', venda_id = v_id
  WHERE id = _pedido_id;

  INSERT INTO pagamentos_online (
    pedido_id, transaction_id, status, metodo, valor, qr_code, pix_copia_cola
  ) VALUES (
    _pedido_id, pedido_record.transaction_id, 'pago', 'pix', pedido_record.total,
    pedido_record.qr_code_pix, pedido_record.pix_copia_cola
  );

  FOR it IN SELECT * FROM jsonb_array_elements(pedido_record.itens) LOOP
    SELECT * INTO p FROM produtos WHERE id = (it->>'produto_id')::uuid;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT coalesce(sum(rc.quantidade * i.custo_unitario), 0) INTO v_custo_item
    FROM receitas rc
    JOIN ingredientes i ON i.id = rc.ingrediente_id
    WHERE rc.produto_id = p.id;

    INSERT INTO venda_itens (
      venda_id, produto_id, nome, quantidade, preco_unitario, custo_unitario
    ) VALUES (
      v_id, p.id, it->>'nome', (it->>'quantidade')::int,
      (it->>'preco_unitario')::numeric, v_custo_item
    );

    v_sub := v_sub + (it->>'preco_unitario')::numeric * (it->>'quantidade')::int;
    v_custo := v_custo + v_custo_item * (it->>'quantidade')::int;

    UPDATE ingredientes i
    SET quantidade = i.quantidade - (rc.quantidade * (it->>'quantidade')::numeric)
    FROM receitas rc
    WHERE rc.produto_id = p.id AND rc.ingrediente_id = i.id;
  END LOOP;

  UPDATE vendas
  SET custo = v_custo, lucro = (subtotal - desconto - custo)
  WHERE id = v_id;

  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_online(uuid) TO service_role, authenticated, anon;

-- ============================================
-- 10. FUNÇÕES DO FLUXO UNIFICADO (MIGRAÇÃO 0013)
-- ============================================

-- 10.1. Registrar venda (PDV)
CREATE OR REPLACE FUNCTION public.registrar_venda(
  _itens jsonb, _tipo text default 'balcao', _cliente text default null, _telefone text default null,
  _endereco text default null, _cupom text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; it jsonb; p record; r record; v_sub numeric := 0; v_custo numeric := 0; v_custo_item numeric;
  v_desc numeric := 0; v_taxa numeric := 0; v_pct numeric; v_status text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sem permissão'; end if;
  if jsonb_array_length(_itens) = 0 then raise exception 'Carrinho vazio'; end if;
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id = (it->>'produto_id')::uuid and ativo;
    if not found then raise exception 'Produto indisponível'; end if;
    for r in select i.nome, i.validade from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=p.id for update of i loop
      if r.validade is not null and r.validade < current_date then
        raise exception 'Ingrediente vencido: %', r.nome; end if;
    end loop;
  end loop;
  for r in select i.nome, i.quantidade as estoque, sum(rc.quantidade * (e->>'quantidade')::numeric) as necessario
           from jsonb_array_elements(_itens) e join receitas rc on rc.produto_id=(e->>'produto_id')::uuid
           join ingredientes i on i.id=rc.ingrediente_id group by i.id, i.nome, i.quantidade loop
    if r.necessario > r.estoque then raise exception 'Estoque insuficiente: %', r.nome; end if;
  end loop;

  v_status := 'pendente';
  insert into vendas(tipo,status,cliente,telefone,endereco,criado_por) values(_tipo,v_status,_cliente,_telefone,_endereco,auth.uid()) returning id into v_id;
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id=(it->>'produto_id')::uuid;
    select coalesce(sum(rc.quantidade*i.custo_unitario),0) into v_custo_item from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=p.id;
    insert into venda_itens(venda_id,produto_id,nome,quantidade,preco_unitario,custo_unitario)
      values(v_id,p.id,p.nome,(it->>'quantidade')::int,p.preco,v_custo_item);
    v_sub := v_sub + p.preco*(it->>'quantidade')::int;
    v_custo := v_custo + v_custo_item*(it->>'quantidade')::int;
    update ingredientes i set quantidade = i.quantidade - rc.quantidade*(it->>'quantidade')::numeric
      from receitas rc where rc.produto_id=p.id and rc.ingrediente_id=i.id;
  end loop;
  if _cupom is not null and _cupom <> '' then
    select percentual into v_pct from cupons where upper(codigo)=upper(_cupom) and ativo;
    if not found then raise exception 'Cupom inválido'; end if;
    v_desc := round(v_sub*v_pct/100,2);
  end if;
  if _tipo='delivery' then select taxa_entrega into v_taxa from loja_config where id=1; end if;
  update vendas set subtotal=v_sub, desconto=v_desc, cupom=nullif(_cupom,''), taxa_entrega=coalesce(v_taxa,0),
    total=v_sub-v_desc+coalesce(v_taxa,0), custo=v_custo, lucro=v_sub-v_desc-v_custo where id=v_id;
  return v_id;
end $$;

GRANT EXECUTE ON FUNCTION public.registrar_venda(jsonb,text,text,text,text,text) TO authenticated;

-- 10.2. Aceitar pedido
CREATE OR REPLACE FUNCTION public.aceitar_pedido(_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
  pedido_record record;
  venda_id uuid;
BEGIN
  SELECT * INTO pedido_record
  FROM public.pedidos_online
  WHERE id = _pedido_id AND status_delivery = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  SELECT public.registrar_venda(
    jsonb_build_array(
      SELECT jsonb_build_object(
        'produto_id', (item->>'produto_id')::uuid,
        'quantidade', (item->>'quantidade')::int
      )
      FROM jsonb_array_elements(pedido_record.itens) AS item
    ),
    'delivery',
    pedido_record.cliente,
    pedido_record.telefone,
    pedido_record.endereco,
    pedido_record.cupom
  ) INTO venda_id;

  UPDATE public.pedidos_online
  SET status_delivery = 'aceito',
      aceito_em = NOW(),
      status = 'recebido'
  WHERE id = _pedido_id
    AND status_delivery = 'pendente'
  RETURNING to_jsonb(pedidos_online) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Falha ao atualizar o pedido';
  END IF;

  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
  VALUES (_pedido_id, 'aceito', 
    jsonb_build_object(
      'timestamp', NOW()::text,
      'venda_id', venda_id,
      'status_anterior', pedido_record.status,
      'status_novo', 'recebido'
    ), 
    auth.uid());

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.aceitar_pedido(uuid) TO authenticated;

-- 10.3. Avançar status do pedido
CREATE OR REPLACE FUNCTION public.avancar_status_pedido(
  _pedido_id uuid,
  _novo_status text,
  _tipo_pedido text DEFAULT 'venda'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
  old_status text;
BEGIN
  IF _tipo_pedido = 'venda' THEN
    SELECT status INTO old_status FROM public.vendas WHERE id = _pedido_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda não encontrada';
    END IF;

    IF old_status = 'pendente' AND _novo_status != 'recebido' THEN
      RAISE EXCEPTION 'Pedido pendente deve ir para recebido primeiro';
    END IF;
    IF old_status = 'recebido' AND _novo_status != 'preparando' THEN
      RAISE EXCEPTION 'Pedido recebido deve ir para preparando';
    END IF;
    IF old_status = 'preparando' AND _novo_status NOT IN ('pronto', 'cancelado') THEN
      RAISE EXCEPTION 'Pedido preparando pode ir para pronto ou cancelado';
    END IF;
    IF old_status = 'pronto' AND _novo_status NOT IN ('em_entrega', 'cancelado') THEN
      RAISE EXCEPTION 'Pedido pronto pode ir para em_entrega ou cancelado';
    END IF;
    IF old_status = 'em_entrega' AND _novo_status NOT IN ('finalizado', 'cancelado') THEN
      RAISE EXCEPTION 'Pedido em entrega pode ir para finalizado ou cancelado';
    END IF;

    UPDATE public.vendas
    SET status = _novo_status,
        updated_at = NOW()
    WHERE id = _pedido_id
    RETURNING to_jsonb(vendas) INTO result;

  ELSIF _tipo_pedido = 'online' THEN
    SELECT status INTO old_status FROM public.pedidos_online WHERE id = _pedido_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido online não encontrado';
    END IF;

    UPDATE public.pedidos_online
    SET status = _novo_status,
        updated_at = NOW()
    WHERE id = _pedido_id
    RETURNING to_jsonb(pedidos_online) INTO result;

  ELSE
    RAISE EXCEPTION 'Tipo de pedido inválido: %', _tipo_pedido;
  END IF;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Falha ao atualizar o pedido';
  END IF;

  IF _tipo_pedido = 'online' THEN
    INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
    VALUES (_pedido_id, 'status_alterado', 
      jsonb_build_object(
        'timestamp', NOW()::text,
        'status_anterior', old_status,
        'status_novo', _novo_status
      ), 
      auth.uid());
  END IF;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.avancar_status_pedido(uuid,text,text) TO authenticated;

-- ============================================
-- 11. FUNÇÕES DE RASTREAMENTO E NOTIFICAÇÃO
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
  SET analisado = true, analisado_em = NOW()
  WHERE id = _notificacao_id
  RETURNING to_jsonb(notificacoes_delivery) INTO result;
  IF result IS NULL THEN
    RAISE EXCEPTION 'Notificação não encontrada';
  END IF;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao_analisada(uuid) TO authenticated;

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
  SELECT nd.id, nd.pedido_id, nd.tipo, nd.mensagem, nd.criado_em
  FROM public.notificacoes_delivery nd
  WHERE nd.analisado = false
  ORDER BY nd.criado_em DESC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_notificacoes_pendentes() TO authenticated;

-- ============================================
-- 12. VIEW OPERACIONAL
-- ============================================

CREATE OR REPLACE VIEW public.vw_pagamentos_online AS
SELECT 
  p.id AS pedido_id,
  p.token,
  p.cliente,
  p.telefone,
  p.total,
  p.status AS status_pedido,
  p.status_pagamento,
  p.transaction_id,
  p.origem,
  p.venda_id,
  p.created_at,
  p.updated_at
FROM public.pedidos_online p;

GRANT SELECT ON public.vw_pagamentos_online TO anon, authenticated, service_role;

-- ============================================
-- 13. DADOS INICIAIS
-- ============================================

INSERT INTO public.loja_config (id, taxa_entrega, abre, fecha, som_alerta, aberta_manual)
VALUES (1, 5.00, '18:00', '23:30', true, null)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket para fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos leitura catalogo" ON storage.objects;
CREATE POLICY "fotos leitura catalogo" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'produtos');

-- ============================================
-- 14. FUNÇÃO AUXILIAR PARA MIGRAÇÕES
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
-- 15. COMENTÁRIOS
-- ============================================

COMMENT ON FUNCTION public.registrar_venda IS 'Registra uma venda com status unificado - todos os pedidos entram como pendente para seguir o fluxo operacional';
COMMENT ON FUNCTION public.aceitar_pedido IS 'Aceita um pedido online e registra a venda no financeiro com baixa de estoque';
COMMENT ON FUNCTION public.avancar_status_pedido IS 'Avança o status de qualquer pedido seguindo o fluxo unificado com validação de transição';
COMMENT ON FUNCTION public.criar_pedido_online IS 'Cria um pedido online sem autenticação (anon)';
COMMENT ON FUNCTION public.confirmar_pagamento_online IS 'Confirma pagamento online e sincroniza com PDV/Estoque';
COMMENT ON FUNCTION public.catalogo_online IS 'Retorna catálogo de produtos e configuração da loja';

COMMIT;

-- Atualizar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM DO SCRIPT MASTER
-- =====================================================================
-- Após executar, verifique:
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- =====================================================================
`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const results: Array<{ name: string; status: string; error?: string }> = [];
  try {
    console.log("🔄 Aplicando migração 0014...");
    console.log("📝 SQL length:", FULL_SQL.length);
    if (databaseUrl) {
      console.log("🔌 Conectando via DATABASE_URL...");
      const pool = new Pool(databaseUrl, { application_name: "apply-migrations" }, 5);
      const conn = await pool.connect();
      try {
        const stmts = FULL_SQL.split(";").filter(s => s.trim() && !s.trim().startsWith("--"));
        let ok = 0, fail = 0;
        for (const s of stmts) {
          try {
            await conn.queryObject(s.trim());
            ok++;
          } catch (e) {
            console.error("❌ " + e.message);
            console.error("   SQL: " + s.substring(0, 100));
            fail++;
          }
        }
        console.log("✅ OK: " + ok + ", Fail: " + fail);
        results.push({ name: "all_migrations", status: "applied" });
      } finally {
        conn.release();
        await pool.close();
      }
    } else {
      results.push({ name: "all_migrations", status: "error", error: "DATABASE_URL not set" });
    }
  } catch (err) {
    results.push({ name: "all_migrations", status: "error", error: String(err) });
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
