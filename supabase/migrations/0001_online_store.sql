-- ============================================
-- MIGRAÇÃO COMPLETA: Loja Online + Delivery
-- ============================================
-- Executar no Lovable Cloud: Cloud → Database → SQL Editor → Run
-- Cria tabela, funções SQL, políticas RLS e grants para a loja online funcionar
-- sem autenticação (anon) e integrada com o painel de delivery.
-- ============================================

-- ============================================
-- 1. Tabela de pedidos online
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

ALTER TABLE public.pedidos_online ENABLE ROW LEVEL SECURITY;

-- Grants da tabela
GRANT SELECT ON public.pedidos_online TO authenticated;
GRANT INSERT ON public.pedidos_online TO anon;
GRANT UPDATE ON public.pedidos_online TO authenticated;
GRANT ALL ON public.pedidos_online TO service_role;

-- Políticas RLS: clientes anônimos
DROP POLICY IF EXISTS "anon insere pedidos online" ON public.pedidos_online;
CREATE POLICY "anon insere pedidos online" ON public.pedidos_online
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon consulta pedido por token" ON public.pedidos_online;
CREATE POLICY "anon consulta pedido por token" ON public.pedidos_online
  FOR SELECT TO anon USING (true);

-- Políticas RLS: staff autenticado
DROP POLICY IF EXISTS "staff consulta pedidos online" ON public.pedidos_online;
CREATE POLICY "staff consulta pedidos online" ON public.pedidos_online
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff atualiza pedidos online" ON public.pedidos_online;
CREATE POLICY "staff atualiza pedidos online" ON public.pedidos_online
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- ============================================
-- 2. Colunas em produtos (se não existirem)
-- ============================================
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_path text;

-- ============================================
-- 3. Políticas e grants para catálogo público
-- ============================================
DROP POLICY IF EXISTS "catalogo produtos ativos" ON public.produtos;
CREATE POLICY "catalogo produtos ativos" ON public.produtos
  FOR SELECT TO anon USING (ativo);

GRANT SELECT (id, nome, categoria, descricao, preco, ativo, imagem_path, foto_url) ON public.produtos TO anon;

-- Storage bucket para fotos dos produtos
DROP POLICY IF EXISTS "fotos leitura catalogo" ON storage.objects;
CREATE POLICY "fotos leitura catalogo" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'produtos');

-- ============================================
-- 4. Função catálogo online (produtos + config)
-- ============================================
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

-- ============================================
-- 5. Função criar pedido online (sem autenticação)
-- ============================================
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
  -- Evita duplicação com o mesmo token
  PERFORM pg_advisory_xact_lock(hashtext(_token::text));
  SELECT to_jsonb(o) - 'token' INTO result
  FROM pedidos_online o WHERE token = _token;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Validação dos dados do cliente
  IF length(trim(_cliente)) < 2 OR length(_cliente) > 120 THEN
    RAISE EXCEPTION 'Nome do cliente inválido';
  END IF;
  IF length(trim(_telefone)) < 8 OR length(_telefone) > 30 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(trim(_endereco)) < 8 OR length(_endereco) > 500 THEN
    RAISE EXCEPTION 'Endereço inválido';
  END IF;

  -- Validação do carrinho
  IF jsonb_typeof(_itens) != 'array'
     OR jsonb_array_length(_itens) < 1
     OR jsonb_array_length(_itens) > 50 THEN
    RAISE EXCEPTION 'Carrinho inválido';
  END IF;

  -- Valida cada item e calcula subtotal
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

  -- Valida cupom (se informado)
  IF trim(_cupom) <> '' THEN
    SELECT percentual INTO pct FROM cupons
    WHERE upper(codigo) = upper(trim(_cupom)) AND ativo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido';
    END IF;
  END IF;

  -- Busca taxa de entrega
  SELECT taxa_entrega INTO fee FROM loja_config WHERE id = 1;

  -- Calcula desconto e total
  disc := round(sub * pct / 100, 2);

  -- Insere o pedido
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

GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid, text, text, text, jsonb, text)
  TO anon, authenticated;

-- ============================================
-- 6. Função consultar pedido online (sem autenticação)
-- ============================================
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

-- ============================================
-- 7. Grants para cupons e loja_config
-- ============================================
DROP POLICY IF EXISTS "anon ve cupons ativos" ON public.cupons;
CREATE POLICY "anon ve cupons ativos" ON public.cupons
  FOR SELECT TO anon USING (ativo);

GRANT SELECT (id, codigo, percentual, ativo) ON public.cupons TO anon;

DROP POLICY IF EXISTS "anon ve loja config" ON public.loja_config;
CREATE POLICY "anon ve loja config" ON public.loja_config
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.loja_config TO anon;

-- ============================================
-- 8. Grants para service_role
-- ============================================
GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.venda_itens TO service_role;
GRANT ALL ON public.ingredientes TO service_role;
GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.receitas TO service_role;
GRANT ALL ON public.cupons TO service_role;
GRANT ALL ON public.loja_config TO service_role;

-- ============================================
-- 9. Reload schema cache do PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';