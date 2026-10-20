-- ============================================
-- MIGRAÇÃO: Integração Completa Loja Online → Pagamentos PIX & PDV
-- ============================================
-- 1. Estende pedidos_online com colunas de pagamento e vínculo de venda
-- 2. Cria tabela pagamentos_online para auditoria e histórico de transações
-- 3. Cria view vw_pagamentos_online para acompanhamento
-- 4. Triggers para atualização automática de timestamps
-- 5. Função confirmar_pagamento_online (idempotente, baixa de estoque, vínculo PDV)
-- 6. Políticas RLS e Grants para anon, authenticated e service_role
-- ============================================

-- ============================================
-- 1. Estender pedidos_online
-- ============================================

ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'aguardando';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'loja_online';
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS qr_code_pix text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS pix_copia_cola text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos_online ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger para updated_at em pedidos_online
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
-- 2. Tabela pagamentos_online (Auditoria & Histórico)
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

-- Trigger para updated_at em pagamentos_online
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
-- 3. View vw_pagamentos_online
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
-- 4. RLS e Grants
-- ============================================

ALTER TABLE public.pedidos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_online ENABLE ROW LEVEL SECURITY;

-- Grants para anon, authenticated e service_role
GRANT SELECT, INSERT, UPDATE ON public.pedidos_online TO anon, authenticated;
GRANT ALL ON public.pedidos_online TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.pagamentos_online TO anon, authenticated;
GRANT ALL ON public.pagamentos_online TO service_role;

GRANT SELECT ON public.vw_pagamentos_online TO anon, authenticated, service_role;

GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.venda_itens TO service_role;
GRANT ALL ON public.ingredientes TO service_role;
GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.receitas TO service_role;

-- Políticas RLS em pedidos_online
DROP POLICY IF EXISTS "anon atualiza pagamento pedido" ON public.pedidos_online;
CREATE POLICY "anon atualiza pagamento pedido" ON public.pedidos_online
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Políticas RLS em pagamentos_online
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

-- ============================================
-- 5. Função confirmar_pagamento_online
-- ============================================

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
  -- Lock baseado no pedido ID para evitar concorrência/duplicação
  PERFORM pg_advisory_xact_lock(hashtext(_pedido_id::text));

  -- Busca o pedido online
  SELECT * INTO pedido_record FROM pedidos_online WHERE id = _pedido_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', _pedido_id;
  END IF;

  -- Se já foi processado e possui venda_id vinculada, retorna de forma idempotente
  IF pedido_record.status_pagamento = 'pago' AND pedido_record.venda_id IS NOT NULL THEN
    RETURN pedido_record.venda_id;
  END IF;

  -- Se já está marcado como pago, verifica se há venda recente correspondente
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

  -- Cria o registro em vendas com tipo='online' (aparece no PDV e Dashboard)
  INSERT INTO vendas (
    tipo, status, cliente, telefone, endereco,
    subtotal, desconto, taxa_entrega, total,
    cupom
  ) VALUES (
    'online', 'novo', pedido_record.cliente, pedido_record.telefone, pedido_record.endereco,
    pedido_record.subtotal, pedido_record.desconto, pedido_record.taxa_entrega, pedido_record.total,
    pedido_record.cupom
  ) RETURNING id INTO v_id;

  -- Atualiza status do pedido online vinculando à venda
  UPDATE pedidos_online
  SET status = 'pago', status_pagamento = 'pago', venda_id = v_id
  WHERE id = _pedido_id;

  -- Registra auditoria na tabela pagamentos_online
  INSERT INTO pagamentos_online (
    pedido_id, transaction_id, status, metodo, valor, qr_code, pix_copia_cola
  ) VALUES (
    _pedido_id, pedido_record.transaction_id, 'pago', 'pix', pedido_record.total,
    pedido_record.qr_code_pix, pedido_record.pix_copia_cola
  );

  -- Processa cada item do pedido online para venda_itens e baixa de estoque
  FOR it IN SELECT * FROM jsonb_array_elements(pedido_record.itens) LOOP
    SELECT * INTO p FROM produtos WHERE id = (it->>'produto_id')::uuid;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Calcula custo do item baseado na receita de ingredientes
    SELECT coalesce(sum(rc.quantidade * i.custo_unitario), 0) INTO v_custo_item
    FROM receitas rc
    JOIN ingredientes i ON i.id = rc.ingrediente_id
    WHERE rc.produto_id = p.id;

    -- Insere o item da venda
    INSERT INTO venda_itens (
      venda_id, produto_id, nome, quantidade, preco_unitario, custo_unitario
    ) VALUES (
      v_id, p.id, it->>'nome', (it->>'quantidade')::int,
      (it->>'preco_unitario')::numeric, v_custo_item
    );

    -- Acumula subtotal e custo
    v_sub := v_sub + (it->>'preco_unitario')::numeric * (it->>'quantidade')::int;
    v_custo := v_custo + v_custo_item * (it->>'quantidade')::int;

    -- Dá baixa automática no estoque dos ingredientes
    UPDATE ingredientes i
    SET quantidade = i.quantidade - (rc.quantidade * (it->>'quantidade')::numeric)
    FROM receitas rc
    WHERE rc.produto_id = p.id AND rc.ingrediente_id = i.id;
  END LOOP;

  -- Atualiza custo e lucro da venda
  UPDATE vendas
  SET custo = v_custo, lucro = (subtotal - desconto - custo)
  WHERE id = v_id;

  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_online(uuid) TO service_role, authenticated, anon;

-- ============================================
-- 6. Reload schema cache do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
