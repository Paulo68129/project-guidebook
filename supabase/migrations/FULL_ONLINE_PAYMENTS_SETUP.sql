-- =====================================================================
-- SCRIPT CONSOLIDADO: SETUP COMPLETO DA LOJA ONLINE + PAGAMENTOS PIX (ENVIARE) + PDV
-- =====================================================================
-- Executar no Supabase / Lovable Cloud: SQL Editor -> Novo Script -> Run
-- Idempotente: pode ser executado múltiplas vezes sem erros.
-- =====================================================================

BEGIN;

-- ============================================
-- 1. TABELA DE PEDIDOS ONLINE
-- ============================================
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
  motoboy_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Colunas de pagamento e vínculo
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'aguardando';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'loja_online';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS qr_code_pix text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS pix_copia_cola text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Colunas em produtos para catálogo online
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_path text;

-- Função genérica de atualização de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_pedidos_online ON public.pedidos_online;
CREATE TRIGGER set_updated_at_pedidos_online
  BEFORE UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices em pedidos_online
CREATE INDEX IF NOT EXISTS idx_pedidos_online_transaction_id ON public.pedidos_online(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status_pagamento ON public.pedidos_online(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_status ON public.pedidos_online(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_online_venda_id ON public.pedidos_online(venda_id);

-- ============================================
-- 2. TABELA DE PAGAMENTOS ONLINE (AUDITORIA / LOGS)
-- ============================================
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

DROP TRIGGER IF EXISTS set_updated_at_pagamentos_online ON public.pagamentos_online;
CREATE TRIGGER set_updated_at_pagamentos_online
  BEFORE UPDATE ON public.pagamentos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices em pagamentos_online
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_pedido_id ON public.pagamentos_online(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_transaction_id ON public.pagamentos_online(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_online_status ON public.pagamentos_online(status);

-- ============================================
-- 3. VIEW OPERACIONAL
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

-- ============================================
-- 4. CONFIGURAÇÃO DA LOJA E STORAGE
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
-- 5. SEGURANÇA, RLS E GRANTS
-- ============================================
ALTER TABLE public.pedidos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_online ENABLE ROW LEVEL SECURITY;

-- Concessões
GRANT SELECT, INSERT, UPDATE ON public.pedidos_online TO anon, authenticated;
GRANT ALL ON public.pedidos_online TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.pagamentos_online TO anon, authenticated;
GRANT ALL ON public.pagamentos_online TO service_role;

GRANT SELECT ON public.vw_pagamentos_online TO anon, authenticated, service_role;

GRANT SELECT (id, nome, categoria, descricao, preco, ativo, imagem_path, foto_url) ON public.produtos TO anon;
GRANT SELECT (id, codigo, percentual, ativo) ON public.cupons TO anon;
GRANT SELECT ON public.loja_config TO anon;

GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.venda_itens TO service_role;
GRANT ALL ON public.ingredientes TO service_role;
GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.receitas TO service_role;
GRANT ALL ON public.cupons TO service_role;
GRANT ALL ON public.loja_config TO service_role;

-- Políticas de RLS
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

DROP POLICY IF EXISTS "catalogo produtos ativos" ON public.produtos;
CREATE POLICY "catalogo produtos ativos" ON public.produtos
  FOR SELECT TO anon USING (ativo);

DROP POLICY IF EXISTS "anon ve cupons ativos" ON public.cupons;
CREATE POLICY "anon ve cupons ativos" ON public.cupons
  FOR SELECT TO anon USING (ativo);

DROP POLICY IF EXISTS "anon ve loja config" ON public.loja_config;
CREATE POLICY "anon ve loja config" ON public.loja_config
  FOR SELECT TO anon USING (true);

-- ============================================
-- 6. FUNÇÕES SQL DA LOJA ONLINE
-- ============================================

-- Catálogo de Produtos
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

-- Criação de Pedido Online
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
    subtotal, desconto, taxa_entrega, total, cupom
  ) VALUES (
    _token, trim(_cliente), trim(_telefone), trim(_endereco), snap,
    sub, disc, coalesce(fee, 0), sub - disc + coalesce(fee, 0),
    nullif(trim(_cupom), '')
  ) RETURNING to_jsonb(pedidos_online) - 'token' INTO result;

  RETURN result;
END
$func$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid, text, text, text, jsonb, text) TO anon, authenticated;

-- Consulta de Pedido Online
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

-- Confirmação de Pagamento Online e Sincronização PDV/Estoque
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

  -- Cria venda para o PDV / Relatórios
  INSERT INTO vendas (
    tipo, status, cliente, telefone, endereco,
    subtotal, desconto, taxa_entrega, total,
    cupom
  ) VALUES (
    'online', 'novo', pedido_record.cliente, pedido_record.telefone, pedido_record.endereco,
    pedido_record.subtotal, pedido_record.desconto, pedido_record.taxa_entrega, pedido_record.total,
    pedido_record.cupom
  ) RETURNING id INTO v_id;

  -- Atualiza o pedido online
  UPDATE pedidos_online
  SET status = 'pago', status_pagamento = 'pago', venda_id = v_id
  WHERE id = _pedido_id;

  -- Registra auditoria
  INSERT INTO pagamentos_online (
    pedido_id, transaction_id, status, metodo, valor, qr_code, pix_copia_cola
  ) VALUES (
    _pedido_id, pedido_record.transaction_id, 'pago', 'pix', pedido_record.total,
    pedido_record.qr_code_pix, pedido_record.pix_copia_cola
  );

  -- Processa itens e dá baixa automática em estoque
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

COMMIT;

-- Atualizar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
