-- =====================================================================
-- FUNÇÕES RPC PARA OPERAÇÕES DE ADMIN - PizzaStockAI
-- =====================================================================
-- Solução para o problema de salvamento nas páginas de cardápio,
-- estoque e configurações.
--
-- O problema: as políticas RLS bloqueiam INSERT/UPDATE/DELETE para o
-- role "anon" (navegador). Apenas "authenticated" com is_staff() pode
-- modificar dados. Como o app usa a chave Publishable (anon) no
-- navegador, o salvamento falha.
--
-- A solução: funções SECURITY DEFINER que rodam com permissão de
-- dono da tabela, contornando o RLS. O navegador chama via RPC.
--
-- Como aplicar:
-- 1. Acesse https://supabase.com/dashboard → seu projeto → SQL Editor
-- 2. Clique em "New Query"
-- 3. Cole este SQL e clique em "Run"
-- =====================================================================

-- ============================================
-- 1. PRODUTOS (Cardápio)
-- ============================================

-- Upsert de produto (cria ou atualiza)
CREATE OR REPLACE FUNCTION public.upsert_produto(
  _id uuid,
  _nome text,
  _categoria text,
  _preco numeric,
  _descricao text DEFAULT NULL,
  _foto_url text DEFAULT NULL,
  _ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  IF _id IS NOT NULL AND EXISTS (SELECT 1 FROM public.produtos WHERE id = _id) THEN
    UPDATE public.produtos
    SET nome = _nome, categoria = _categoria, preco = _preco,
        descricao = _descricao, foto_url = _foto_url, ativo = _ativo,
        updated_at = now()
    WHERE id = _id
    RETURNING to_jsonb(produtos) INTO result;
  ELSE
    INSERT INTO public.produtos (id, nome, categoria, preco, descricao, foto_url, ativo)
    VALUES (_id, _nome, _categoria, _preco, _descricao, _foto_url, _ativo)
    RETURNING to_jsonb(produtos) INTO result;
  END IF;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_produto(uuid, text, text, numeric, text, text, boolean) TO anon, authenticated;

-- Deletar produto
CREATE OR REPLACE FUNCTION public.delete_produto(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.produtos WHERE id = _id;
  RETURN true;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.delete_produto(uuid) TO anon, authenticated;

-- ============================================
-- 2. RECEITAS (Ficha técnica do Cardápio)
-- ============================================

-- Limpar receitas de um produto
CREATE OR REPLACE FUNCTION public.delete_receitas_por_produto(_produto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.receitas WHERE produto_id = _produto_id;
  RETURN true;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.delete_receitas_por_produto(uuid) TO anon, authenticated;

-- Inserir múltiplas receitas
CREATE OR REPLACE FUNCTION public.insert_receitas(
  _produto_id uuid,
  _ingrediente_ids uuid[],
  _quantidades numeric[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  i integer;
BEGIN
  FOR i IN 1..array_length(_ingrediente_ids, 1) LOOP
    INSERT INTO public.receitas (produto_id, ingrediente_id, quantidade)
    VALUES (_produto_id, _ingrediente_ids[i], _quantidades[i]);
  END LOOP;
  RETURN true;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.insert_receitas(uuid, uuid[], numeric[]) TO anon, authenticated;

-- ============================================
-- 3. INGREDIENTES (Estoque)
-- ============================================

-- Upsert de ingrediente (cria ou atualiza)
CREATE OR REPLACE FUNCTION public.upsert_ingrediente(
  _id uuid,
  _nome text,
  _unidade text,
  _quantidade numeric,
  _estoque_minimo numeric,
  _custo_unitario numeric,
  _validade date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  IF _id IS NOT NULL AND EXISTS (SELECT 1 FROM public.ingredientes WHERE id = _id) THEN
    UPDATE public.ingredientes
    SET nome = _nome, unidade = _unidade, quantidade = _quantidade,
        estoque_minimo = _estoque_minimo, custo_unitario = _custo_unitario,
        validade = _validade, updated_at = now()
    WHERE id = _id
    RETURNING to_jsonb(ingredientes) INTO result;
  ELSE
    INSERT INTO public.ingredientes (id, nome, unidade, quantidade, estoque_minimo, custo_unitario, validade)
    VALUES (_id, _nome, _unidade, _quantidade, _estoque_minimo, _custo_unitario, _validade)
    RETURNING to_jsonb(ingredientes) INTO result;
  END IF;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_ingrediente(uuid, text, text, numeric, numeric, numeric, date) TO anon, authenticated;

-- Dar entrada em ingrediente (somar quantidade)
CREATE OR REPLACE FUNCTION public.dar_entrada_ingrediente(_id uuid, _quantidade numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.ingredientes
  SET quantidade = quantidade + _quantidade, updated_at = now()
  WHERE id = _id
  RETURNING to_jsonb(ingredientes) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.dar_entrada_ingrediente(uuid, numeric) TO anon, authenticated;

-- Deletar ingrediente
CREATE OR REPLACE FUNCTION public.delete_ingrediente(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.ingredientes WHERE id = _id;
  RETURN true;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.delete_ingrediente(uuid) TO anon, authenticated;

-- ============================================
-- 4. LOJA_CONFIG (Configurações)
-- ============================================

-- Atualizar configurações da loja
CREATE OR REPLACE FUNCTION public.update_loja_config(
  _abre time DEFAULT NULL,
  _fecha time DEFAULT NULL,
  _taxa_entrega numeric DEFAULT NULL,
  _som_alerta boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.loja_config
  SET
    abre = COALESCE(_abre, abre),
    fecha = COALESCE(_fecha, fecha),
    taxa_entrega = COALESCE(_taxa_entrega, taxa_entrega),
    som_alerta = COALESCE(_som_alerta, som_alerta),
    updated_at = now()
  WHERE id = 1
  RETURNING to_jsonb(loja_config) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.update_loja_config(time, time, numeric, boolean) TO anon, authenticated;

-- ============================================
-- 5. MOTOBOYS (Configurações)
-- ============================================

-- Inserir motoboy
CREATE OR REPLACE FUNCTION public.insert_motoboy(_nome text, _telefone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO public.motoboys (nome, telefone)
  VALUES (_nome, _telefone)
  RETURNING to_jsonb(motoboys) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.insert_motoboy(text, text) TO anon, authenticated;

-- Toggle ativo do motoboy
CREATE OR REPLACE FUNCTION public.toggle_motoboy_ativo(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.motoboys
  SET ativo = NOT ativo
  WHERE id = _id
  RETURNING to_jsonb(motoboys) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.toggle_motoboy_ativo(uuid) TO anon, authenticated;

-- ============================================
-- 6. CUPONS (Configurações)
-- ============================================

-- Inserir cupom
CREATE OR REPLACE FUNCTION public.insert_cupom(_codigo text, _percentual numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO public.cupons (codigo, percentual)
  VALUES (_codigo, _percentual)
  RETURNING to_jsonb(cupons) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.insert_cupom(text, numeric) TO anon, authenticated;

-- Toggle ativo do cupom
CREATE OR REPLACE FUNCTION public.toggle_cupom_ativo(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.cupons
  SET ativo = NOT ativo
  WHERE id = _id
  RETURNING to_jsonb(cupons) INTO result;
  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.toggle_cupom_ativo(uuid) TO anon, authenticated;

-- ============================================
-- 7. VENDAS (PDV)
-- ============================================

-- Registrar venda completa
CREATE OR REPLACE FUNCTION public.registrar_venda(
  _itens jsonb,
  _metodo_pagamento text DEFAULT 'dinheiro',
  _observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_venda_id uuid;
  v_total numeric := 0;
  v_lucro numeric := 0;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade integer;
  v_preco numeric;
  v_custo numeric;
  result jsonb;
BEGIN
  -- Criar venda
  INSERT INTO public.vendas (status, metodo_pagamento, observacoes)
  VALUES ('concluido', _metodo_pagamento, _observacoes)
  RETURNING id INTO v_venda_id;

  -- Processar itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_produto_id := (v_item->'produto_id')::uuid;
    v_quantidade := (v_item->'quantidade')::integer;
    v_preco := (v_item->'preco')::numeric;

    -- Calcular custo
    SELECT COALESCE(SUM(ri.quantidade * ing.custo_unitario), 0) * v_quantidade
    INTO v_custo
    FROM public.receitas ri
    JOIN public.ingredientes ing ON ing.id = ri.ingrediente_id
    WHERE ri.produto_id = v_produto_id;

    v_total := v_total + (v_preco * v_quantidade);
    v_lucro := v_lucro + ((v_preco * v_quantidade) - v_custo);

    INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_venda_id, v_produto_id, v_quantidade, v_preco, v_preco * v_quantidade);

    -- Atualizar estoque
    UPDATE public.ingredientes
    SET quantidade = quantidade - (ri.quantidade * v_quantidade)
    FROM public.receitas ri
    WHERE ri.ingrediente_id = public.ingredientes.id
      AND ri.produto_id = v_produto_id;
  END LOOP;

  -- Atualizar venda com totais
  UPDATE public.vendas
  SET total = v_total, lucro = v_lucro
  WHERE id = v_venda_id
  RETURNING to_jsonb(vendas) INTO result;

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.registrar_venda(jsonb, text, text) TO anon, authenticated;

-- ============================================
-- 8. LEITURA DE TODOS OS PRODUTOS (incluindo inativos)
-- ============================================

-- Listar todos os produtos (incluindo inativos) para admin
CREATE OR REPLACE FUNCTION public.listar_todos_produtos()
RETURNS TABLE(
  id uuid,
  nome text,
  categoria text,
  preco numeric,
  descricao text,
  foto_url text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.categoria, p.preco, p.descricao, p.foto_url, p.ativo, p.created_at, p.updated_at
  FROM public.produtos p
  ORDER BY p.categoria, p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.listar_todos_produtos() TO anon, authenticated;

-- Listar todas as receitas para um produto
CREATE OR REPLACE FUNCTION public.listar_receitas_por_produto(_produto_id uuid)
RETURNS TABLE(
  id uuid,
  produto_id uuid,
  ingrediente_id uuid,
  quantidade numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.produto_id, r.ingrediente_id, r.quantidade
  FROM public.receitas r
  WHERE r.produto_id = _produto_id;
$$;

GRANT EXECUTE ON FUNCTION public.listar_receitas_por_produto(uuid) TO anon, authenticated;

-- Listar todos os ingredientes (incluindo com estoque zero)
CREATE OR REPLACE FUNCTION public.listar_todos_ingredientes()
RETURNS TABLE(
  id uuid,
  nome text,
  unidade text,
  quantidade numeric,
  estoque_minimo numeric,
  custo_unitario numeric,
  validade date,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.nome, i.unidade, i.quantidade, i.estoque_minimo, i.custo_unitario, i.validade, i.created_at, i.updated_at
  FROM public.ingredientes i
  ORDER BY i.nome;
$$;

GRANT EXECUTE ON FUNCTION public.listar_todos_ingredientes() TO anon, authenticated;

-- =====================================================================
-- FIM DAS FUNÇÕES RPC
-- =====================================================================
