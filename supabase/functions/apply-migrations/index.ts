import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const databaseUrl = Deno.env.get("DATABASE_URL") || "";

// SQL consolidado: FULL_ONLINE_PAYMENTS_SETUP + 0007 + 0008 + 0009
const FULL_SQL = `
-- ============================================
-- FULL SETUP: Tabelas básicas + Realtime + Tracking + Descrição
-- ============================================

-- 1. TABELA DE PAGAMENTOS ONLINE (AUDITORIA)
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

CREATE INDEX IF NOT EXISTS idx_pagamentos_online_pedido_id ON public.pagamentos_online(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_transaction_id ON public.pagamentos_online(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_status ON public.pagamentos_online(status);

ALTER TABLE public.pagamentos_online ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon consulta pagamentos por pedido" ON public.pagamentos_online;
CREATE POLICY "anon consulta pagamentos por pedido" ON public.pagamentos_online FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon insere pagamentos" ON public.pagamentos_online;
CREATE POLICY "anon insere pagamentos" ON public.pagamentos_online FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon atualiza pagamentos" ON public.pagamentos_online FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "staff acessa pagamentos_online" ON public.pagamentos_online;
CREATE POLICY "staff acessa pagamentos_online" ON public.pagamentos_online FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.pagamentos_online TO anon, authenticated;
GRANT ALL ON public.pagamentos_online TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_pagamentos_online ON public.pagamentos_online;
CREATE TRIGGER set_updated_at_pagamentos_online
  BEFORE UPDATE ON public.pagamentos_online
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. TABELA PEDIDOS ONLINE AUDIT
CREATE TABLE IF NOT EXISTS public.pedidos_online_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  acao text NOT NULL,
  detalhes jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_online_audit_pedido_id ON public.pedidos_online_audit(pedido_id);

ALTER TABLE public.pedidos_online_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff ve audit" ON public.pedidos_online_audit;
CREATE POLICY "staff ve audit" ON public.pedidos_online_audit FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT ON public.pedidos_online_audit TO authenticated, service_role;

-- 3. TABELA DE RASTREAMENTO DE PEDIDOS
CREATE TABLE IF NOT EXISTS public.rastreamento_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  status text NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rastreamento_pedido_id ON public.rastreamento_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rastreamento_criado_em ON public.rastreamento_pedidos(criado_em DESC);

ALTER TABLE public.rastreamento_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon ve rastreamento" ON public.rastreamento_pedidos;
CREATE POLICY "anon ve rastreamento" ON public.rastreamento_pedidos FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "staff ve todos rastreamentos" ON public.rastreamento_pedidos;
CREATE POLICY "staff ve todos rastreamentos" ON public.rastreamento_pedidos FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.rastreamento_pedidos TO anon, authenticated;
GRANT INSERT ON public.rastreamento_pedidos TO authenticated, service_role;

-- 4. TABELA DE NOTIFICAÇÕES DE DELIVERY
CREATE TABLE IF NOT EXISTS public.notificacoes_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_online(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'novo_pedido',
  mensagem text,
  analisado boolean DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  analisado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_pedido_id ON public.notificacoes_delivery(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_analisado ON public.notificacoes_delivery(analisado);
CREATE INDEX IF NOT EXISTS idx_notificacoes_criado_em ON public.notificacoes_delivery(criado_em DESC);

ALTER TABLE public.notificacoes_delivery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff ve notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff ve notificacoes" ON public.notificacoes_delivery FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff atualiza notificacoes" ON public.notificacoes_delivery;
CREATE POLICY "staff atualiza notificacoes" ON public.notificacoes_delivery FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.notificacoes_delivery TO authenticated;
GRANT INSERT ON public.notificacoes_delivery TO authenticated, service_role;
GRANT UPDATE ON public.notificacoes_delivery TO authenticated;

-- 5. TABELA DE FEEDBACK DE CLIENTES
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

CREATE INDEX IF NOT EXISTS idx_feedback_pedido_id ON public.feedback_clientes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_feedback_nota ON public.feedback_clientes(nota);

ALTER TABLE public.feedback_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insere feedback" ON public.feedback_clientes;
CREATE POLICY "anon insere feedback" ON public.feedback_clientes FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon ve feedback aprovado" ON public.feedback_clientes;
CREATE POLICY "anon ve feedback aprovado" ON public.feedback_clientes FOR SELECT TO anon USING (aprovado);
DROP POLICY IF EXISTS "staff ve todos feedback" ON public.feedback_clientes;
CREATE POLICY "staff ve todos feedback" ON public.feedback_clientes FOR ALL TO authenticated USING (true);

GRANT SELECT, INSERT ON public.feedback_clientes TO anon, authenticated;
GRANT ALL ON public.feedback_clientes TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_feedback_clientes ON public.feedback_clientes;
CREATE TRIGGER set_updated_at_feedback_clientes
  BEFORE UPDATE ON public.feedback_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. TABELA DE RESPOSTAS DE FEEDBACK
CREATE TABLE IF NOT EXISTS public.respostas_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_clientes(id) ON DELETE CASCADE,
  resposta text NOT NULL,
  respondido_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.respostas_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon ve respostas" ON public.respostas_feedback;
CREATE POLICY "anon ve respostas" ON public.respostas_feedback FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "staff gerencia respostas" ON public.respostas_feedback;
CREATE POLICY "staff gerencia respostas" ON public.respostas_feedback FOR ALL TO authenticated USING (true);

GRANT SELECT ON public.respostas_feedback TO anon, authenticated;
GRANT ALL ON public.respostas_feedback TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_respostas_feedback ON public.respostas_feedback;
CREATE TRIGGER set_updated_at_respostas_feedback
  BEFORE UPDATE ON public.respostas_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- REALTIME: REPLICA IDENTITY FULL
-- ============================================
ALTER TABLE public.pedidos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pagamentos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos_online_audit REPLICA IDENTITY FULL;
ALTER TABLE public.rastreamento_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes_delivery REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_clientes REPLICA IDENTITY FULL;
ALTER TABLE public.respostas_feedback REPLICA IDENTITY FULL;

-- Adiciona tabelas à publicação do Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_online;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online_audit;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rastreamento_pedidos;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_delivery;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_clientes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.respostas_feedback;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grants para Realtime
GRANT SELECT ON public.pedidos_online TO authenticated;
GRANT SELECT ON public.pagamentos_online TO authenticated;
GRANT SELECT ON public.pedidos_online_audit TO authenticated;
GRANT SELECT ON public.rastreamento_pedidos TO authenticated;
GRANT SELECT ON public.notificacoes_delivery TO authenticated;
GRANT SELECT ON public.feedback_clientes TO authenticated;
GRANT SELECT ON public.respostas_feedback TO authenticated;

-- ============================================
-- TRIGGERS DE WEBHOOK
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_pedidos_online_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    perform pg_notify('pedidos_online_change', json_build_object('operation', TG_OP, 'record', row_to_json(OLD))::text);
  ELSE
    perform pg_notify('pedidos_online_change', json_build_object('operation', TG_OP, 'record', row_to_json(NEW))::text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_pedidos_online_insert ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_update ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_delete ON public.pedidos_online;

CREATE TRIGGER notify_pedidos_online_insert AFTER INSERT ON public.pedidos_online FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();
CREATE TRIGGER notify_pedidos_online_update AFTER UPDATE ON public.pedidos_online FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();
CREATE TRIGGER notify_pedidos_online_delete AFTER DELETE ON public.pedidos_online FOR EACH ROW EXECUTE FUNCTION public.notify_pedidos_online_change();

-- ============================================
-- TRIGGERS DE UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_pedidos_online ON public.pedidos_online;
CREATE TRIGGER set_updated_at_pedidos_online BEFORE UPDATE ON public.pedidos_online FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_rastreamento_pedidos ON public.rastreamento_pedidos;
CREATE TRIGGER set_updated_at_rastreamento_pedidos BEFORE UPDATE ON public.rastreamento_pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_notificacoes_delivery ON public.notificacoes_delivery;
CREATE TRIGGER set_updated_at_notificacoes_delivery BEFORE UPDATE ON public.notificacoes_delivery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TRIGGER AUTOMÁTICA DE RASTREAMENTO
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
CREATE TRIGGER auto_rastreamento AFTER INSERT OR UPDATE ON public.pedidos_online FOR EACH ROW EXECUTE FUNCTION public.auto_rastreamento_pedidos();

-- ============================================
-- FUNÇÕES RPC
-- ============================================

-- Adicionar rastreamento
CREATE OR REPLACE FUNCTION public.adicionar_rastreamento(_pedido_id uuid, _status text, _descricao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
  VALUES (_pedido_id, _status, _descricao)
  RETURNING to_jsonb(rastreamento_pedidos) INTO result;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.adicionar_rastreamento(uuid, text, text) TO anon, authenticated;

-- Listar rastreamento
CREATE OR REPLACE FUNCTION public.listar_rastreamento(_pedido_id uuid)
RETURNS TABLE(id uuid, pedido_id uuid, status text, descricao text, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rp.id, rp.pedido_id, rp.status, rp.descricao, rp.criado_em
  FROM public.rastreamento_pedidos rp WHERE rp.pedido_id = _pedido_id ORDER BY rp.criado_em ASC;
$$;
GRANT EXECUTE ON FUNCTION public.listar_rastreamento(uuid) TO anon, authenticated;

-- Criar notificação de delivery
CREATE OR REPLACE FUNCTION public.criar_notificacao_delivery(_pedido_id uuid, _tipo text, _mensagem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
  VALUES (_pedido_id, _tipo, _mensagem)
  RETURNING to_jsonb(notificacoes_delivery) INTO result;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.criar_notificacao_delivery(uuid, text, text) TO authenticated, service_role;

-- Marcar notificação como analisada
CREATE OR REPLACE FUNCTION public.marcar_notificacao_analisada(_notificacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  UPDATE public.notificacoes_delivery SET analisado = true, analisado_em = NOW()
  WHERE id = _notificacao_id RETURNING to_jsonb(notificacoes_delivery) INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Notificação não encontrada'; END IF;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.marcar_notificacao_analisada(uuid) TO authenticated;

-- Listar notificações pendentes
CREATE OR REPLACE FUNCTION public.listar_notificacoes_pendentes()
RETURNS TABLE(id uuid, pedido_id uuid, tipo text, mensagem text, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nd.id, nd.pedido_id, nd.tipo, nd.mensagem, nd.criado_em
  FROM public.notificacoes_delivery nd WHERE nd.analisado = false ORDER BY nd.criado_em DESC;
$$;
GRANT EXECUTE ON FUNCTION public.listar_notificacoes_pendentes() TO authenticated;

-- Criar pedido online (com descrição)
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _token uuid, _cliente text, _telefone text, _endereco text, _itens jsonb, _cupom text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  p record; e jsonb; snap jsonb := '[]'; sub numeric := 0; pct numeric := 0;
  fee numeric; disc numeric; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_token::text));
  SELECT to_jsonb(o) - 'token' INTO result FROM pedidos_online o WHERE token = _token;
  IF result IS NOT NULL THEN RETURN result; END IF;
  IF length(trim(_cliente)) < 2 OR length(_cliente) > 120 THEN RAISE EXCEPTION 'Nome do cliente inválido'; END IF;
  IF length(trim(_telefone)) < 8 OR length(_telefone) > 30 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF length(trim(_endereco)) < 8 OR length(_endereco) > 500 THEN RAISE EXCEPTION 'Endereço inválido'; END IF;
  IF jsonb_typeof(_itens) != 'array' OR jsonb_array_length(_itens) < 1 OR jsonb_array_length(_itens) > 50 THEN
    RAISE EXCEPTION 'Carrinho inválido'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    IF (e->>'quantidade')::int NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO p FROM produtos WHERE id = (e->>'produto_id')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    sub := sub + p.preco * (e->>'quantidade')::int;
    snap := snap || jsonb_build_array(jsonb_build_object(
      'nome', p.nome, 'descricao', p.descricao, 'produto_id', p.id,
      'quantidade', (e->>'quantidade')::int, 'preco_unitario', p.preco
    ));
  END LOOP;
  IF trim(_cupom) <> '' THEN
    SELECT percentual INTO pct FROM cupons WHERE upper(codigo) = upper(trim(_cupom)) AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido'; END IF;
  END IF;
  SELECT taxa_entrega INTO fee FROM loja_config WHERE id = 1;
  disc := round(sub * pct / 100, 2);
  INSERT INTO pedidos_online (token, cliente, telefone, endereco, itens, subtotal, desconto, taxa_entrega, total, cupom)
  VALUES (_token, trim(_cliente), trim(_telefone), trim(_endereco), snap, sub, disc, coalesce(fee, 0),
    sub - disc + coalesce(fee, 0), nullif(trim(_cupom), ''))
  RETURNING to_jsonb(pedidos_online) - 'token' INTO result;
  RETURN result;
END
$func$;
GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid, text, text, text, jsonb, text) TO anon, authenticated;

-- Consultar pedido online
CREATE OR REPLACE FUNCTION public.consultar_pedido_online(_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(o) - 'token' FROM pedidos_online o WHERE token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.consultar_pedido_online(uuid) TO anon, authenticated;

-- Aceitar pedido
CREATE OR REPLACE FUNCTION public.aceitar_pedido(_pedido_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  UPDATE pedidos_online SET status = 'aceito', aceito_em = now()
  WHERE id = _pedido_id RETURNING to_jsonb(pedidos_online) - 'token' INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.aceitar_pedido(uuid) TO authenticated;

-- Recusar pedido
CREATE OR REPLACE FUNCTION public.recusar_pedido(_pedido_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  UPDATE pedidos_online SET status = 'cancelado', motivo_recusa = _motivo, recusado_em = now()
  WHERE id = _pedido_id RETURNING to_jsonb(pedidos_online) - 'token' INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.recusar_pedido(uuid, text) TO authenticated;

-- Expirar pedido
CREATE OR REPLACE FUNCTION public.expirar_pedido_online(_pedido_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb;
BEGIN
  UPDATE pedidos_online SET status = 'expirado', status_pagamento = 'expirado'
  WHERE id = _pedido_id RETURNING to_jsonb(pedidos_online) - 'token' INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.expirar_pedido_online(uuid) TO authenticated, service_role;

-- Limpar pedidos expirados
CREATE OR REPLACE FUNCTION public.limpar_pedidos_expirados()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  count integer;
BEGIN
  WITH expirados AS (
    DELETE FROM pedidos_online
    WHERE status = 'aguardando_pagamento'
      AND created_at < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT count(*) INTO count FROM expirados;
  RETURN count;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.limpar_pedidos_expirados() TO authenticated, anon, service_role;

-- Criar feedback
CREATE OR REPLACE FUNCTION public.criar_feedback(_pedido_id uuid, _cliente_nome text, _nota integer, _mensagem text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE result jsonb; pedido_record RECORD;
BEGIN
  SELECT * INTO pedido_record FROM pedidos_online WHERE id = _pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF pedido_record.status NOT IN ('entregue', 'pago', 'aceito') THEN
    RAISE EXCEPTION 'Apenas pedidos entregues podem ser avaliados';
  END IF;
  IF _nota < 1 OR _nota > 5 THEN RAISE EXCEPTION 'Nota deve ser entre 1 e 5'; END IF;
  INSERT INTO feedback_clientes (pedido_id, cliente_nome, nota, mensagem)
  VALUES (_pedido_id, _cliente_nome, _nota, _mensagem)
  RETURNING to_jsonb(feedback_clientes) INTO result;
  RETURN result;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.criar_feedback(uuid, text, integer, text) TO anon, authenticated;

-- Função auxiliar para migrações futuras
CREATE OR REPLACE FUNCTION public.apply_migration_sql(_sql text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  EXECUTE _sql;
  RETURN 'SQL executed successfully';
END;
$func$;
GRANT EXECUTE ON FUNCTION public.apply_migration_sql(text) TO anon, authenticated;

-- Colunas adicionais em pedidos_online
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS status_delivery text DEFAULT 'pendente';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS motivo_recusa text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS aceito_em timestamptz;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS recusado_em timestamptz;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS observacoes text;

-- VIEW operacional
CREATE OR REPLACE VIEW public.vw_pagamentos_online AS
SELECT p.id AS pedido_id, p.token, p.cliente, p.telefone, p.total,
  p.status AS status_pedido, p.status_pagamento, p.transaction_id, p.origem,
  p.venda_id, p.created_at, p.updated_at
FROM public.pedidos_online p;

GRANT SELECT ON public.vw_pagamentos_online TO anon, authenticated, service_role;

-- Configuração da loja
INSERT INTO public.loja_config (id, taxa_entrega, abre, fecha, som_alerta, aberta_manual)
VALUES (1, 5.00, '18:00', '23:30', true, null)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos leitura catalogo" ON storage.objects;
CREATE POLICY "fotos leitura catalogo" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'produtos');

-- Reload schema
NOTIFY pgrst, 'reload schema';
`;

serve(async (req: Request) => {
  // CORS
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
    console.log("🔄 Iniciando aplicação de migrações...");
    console.log("📝 SQL length:", FULL_SQL.length);

    // Tenta conectar via DATABASE_URL primeiro
    if (databaseUrl) {
      console.log("🔌 Conectando via DATABASE_URL...");
      const pool = new Pool(databaseUrl, { application_name: "apply-migrations" }, 5);
      const conn = await pool.connect();
      
      try {
        await conn.queryObject(FULL_SQL);
        console.log("✅ Migrações aplicadas com sucesso via DATABASE_URL!");
        results.push({ name: "all_migrations", status: "applied" });
      } finally {
        conn.release();
        await pool.close();
      }
    } else {
      // Fallback: tenta via Supabase client com service_role
      console.log("⚠️ DATABASE_URL não encontrada, tentando via Supabase client...");
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Tenta criar a função apply_migration_sql primeiro
      const { error: rpcError } = await supabase.rpc("apply_migration_sql", {
        _sql: "SELECT 1"
      });
      
      if (rpcError) {
        console.error("❌ apply_migration_sql não disponível:", rpcError.message);
        results.push({ name: "all_migrations", status: "error", error: "apply_migration_sql RPC não disponível. Execute o SQL manualmente no Supabase Dashboard." });
      } else {
        // Executa o SQL completo
        const { data, error } = await supabase.rpc("apply_migration_sql", {
          _sql: FULL_SQL
        });
        
        if (error) {
          console.error("❌ Erro ao aplicar migrações:", error.message);
          results.push({ name: "all_migrations", status: "error", error: error.message });
        } else {
          console.log("✅ Migrações aplicadas via RPC!");
          results.push({ name: "all_migrations", status: "applied" });
        }
      }
    }
  } catch (err: any) {
    console.error("❌ Erro inesperado:", err.message);
    results.push({ name: "all_migrations", status: "error", error: err.message });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
