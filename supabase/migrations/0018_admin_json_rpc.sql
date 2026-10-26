-- Admin RPC functions with single JSON parameter to bypass PostgREST schema cache
-- Execute this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)

-- 1. UPSERT PRODUTO
CREATE OR REPLACE FUNCTION public.admin_upsert_produtos(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  v_id := NULLIF(payload->>'_id', '')::uuid;
  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.produtos WHERE id = v_id) THEN
    UPDATE public.produtos SET
      nome = payload->>'_nome',
      categoria = payload->>'_categoria',
      preco = (payload->>'_preco')::numeric,
      descricao = payload->>'_descricao',
      foto_url = payload->>'_foto_url',
      ativo = (payload->>'_ativo')::boolean,
      updated_at = now()
    WHERE id = v_id
    RETURNING to_jsonb(produtos) INTO v_result;
  ELSE
    INSERT INTO public.produtos (nome, categoria, preco, descricao, foto_url, ativo)
    VALUES (
      payload->>'_nome',
      payload->>'_categoria',
      (payload->>'_preco')::numeric,
      payload->>'_descricao',
      payload->>'_foto_url',
      (payload->>'_ativo')::boolean
    )
    RETURNING to_jsonb(produtos) INTO v_result;
  END IF;
  RETURN v_result;
END;
$func$;

-- 2. DELETE PRODUTO
CREATE OR REPLACE FUNCTION public.admin_delete_produto(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.produtos WHERE id = (payload->>'_id')::uuid;
  RETURN '{"success":true}'::jsonb;
END;
$func$;

-- 3. DELETE RECEITAS
CREATE OR REPLACE FUNCTION public.admin_delete_receitas(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.receitas WHERE produto_id = (payload->>'_produto_id')::uuid;
  RETURN '{"success":true}'::jsonb;
END;
$func$;

-- 4. INSERT RECEITAS
CREATE OR REPLACE FUNCTION public.admin_insert_receitas(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_produto_id uuid := (payload->>'_produto_id')::uuid;
  v_ing_ids uuid[];
  v_qtys numeric[];
  i integer;
BEGIN
  v_ing_ids := (SELECT array_agg(elem::uuid) FROM jsonb_array_text_elements(payload->'_ingrediente_ids') AS elem);
  v_qtys := (SELECT array_agg(elem::numeric) FROM jsonb_array_text_elements(payload->'_quantidades') AS elem);
  FOR i IN 1..array_length(v_ing_ids, 1) LOOP
    INSERT INTO public.receitas (produto_id, ingrediente_id, quantidade)
    VALUES (v_produto_id, v_ing_ids[i], v_qtys[i]);
  END LOOP;
  RETURN '{"success":true}'::jsonb;
END;
$func$;

-- 5. UPSERT INGREDIENTE
CREATE OR REPLACE FUNCTION public.admin_upsert_ingrediente(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_id uuid;
  v_result jsonb;
BEGIN
  v_id := NULLIF(payload->>'_id', '')::uuid;
  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.ingredientes WHERE id = v_id) THEN
    UPDATE public.ingredientes SET
      nome = payload->>'_nome',
      unidade = payload->>'_unidade',
      quantidade = (payload->>'_quantidade')::numeric,
      estoque_minimo = (payload->>'_estoque_minimo')::numeric,
      custo_unitario = (payload->>'_custo_unitario')::numeric,
      validade = NULLIF(payload->>'_validade', '')::date,
      updated_at = now()
    WHERE id = v_id
    RETURNING to_jsonb(ingredientes) INTO v_result;
  ELSE
    INSERT INTO public.ingredientes (nome, unidade, quantidade, estoque_minimo, custo_unitario, validade)
    VALUES (
      payload->>'_nome',
      payload->>'_unidade',
      (payload->>'_quantidade')::numeric,
      (payload->>'_estoque_minimo')::numeric,
      (payload->>'_custo_unitario')::numeric,
      NULLIF(payload->>'_validade', '')::date
    )
    RETURNING to_jsonb(ingredientes) INTO v_result;
  END IF;
  RETURN v_result;
END;
$func$;

-- 6. DAR ENTRADA INGREDIENTE
CREATE OR REPLACE FUNCTION public.admin_dar_entrada(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE public.ingredientes
  SET quantidade = quantidade + (payload->>'_quantidade')::numeric,
      updated_at = now()
  WHERE id = (payload->>'_id')::uuid
  RETURNING to_jsonb(ingredientes) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 7. DELETE INGREDIENTE
CREATE OR REPLACE FUNCTION public.admin_delete_ingrediente(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.ingredientes WHERE id = (payload->>'_id')::uuid;
  RETURN '{"success":true}'::jsonb;
END;
$func$;

-- 8. UPDATE LOJA CONFIG
CREATE OR REPLACE FUNCTION public.admin_update_loja(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
  v_updates text[] := ARRAY['updated_at = now()'];
BEGIN
  IF payload->>'_abre' IS NOT NULL AND payload->>'_abre' != '' THEN
    v_updates := array_append(v_updates, format('abre = %L::time', payload->>'_abre'));
  END IF;
  IF payload->>'_fecha' IS NOT NULL AND payload->>'_fecha' != '' THEN
    v_updates := array_append(v_updates, format('fecha = %L::time', payload->>'_fecha'));
  END IF;
  IF payload->>'_taxa_entrega' IS NOT NULL AND payload->>'_taxa_entrega' != '' THEN
    v_updates := array_append(v_updates, format('taxa_entrega = %L::numeric', payload->>'_taxa_entrega'));
  END IF;
  IF payload->>'_som_alerta' IS NOT NULL AND payload->>'_som_alerta' != '' THEN
    v_updates := array_append(v_updates, format('som_alerta = %L::boolean', payload->>'_som_alerta'));
  END IF;
  EXECUTE format('UPDATE public.loja_config SET %s WHERE id = 1 RETURNING to_jsonb(loja_config)', array_to_string(v_updates, ', ')) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 9. INSERT MOTOBOY
CREATE OR REPLACE FUNCTION public.admin_insert_motoboy(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.motoboys (nome, telefone)
  VALUES (payload->>'_nome', payload->>'_telefone')
  RETURNING to_jsonb(motoboys) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 10. TOGGLE MOTOBOY
CREATE OR REPLACE FUNCTION public.admin_toggle_motoboy(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE public.motoboys SET ativo = NOT ativo
  WHERE id = (payload->>'_id')::uuid
  RETURNING to_jsonb(motoboys) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 11. INSERT CUPOM
CREATE OR REPLACE FUNCTION public.admin_insert_cupom(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.cupons (codigo, percentual)
  VALUES (payload->>'_codigo', (payload->>'_percentual')::numeric)
  RETURNING to_jsonb(cupons) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 12. TOGGLE CUPOM
CREATE OR REPLACE FUNCTION public.admin_toggle_cupom(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE public.cupons SET ativo = NOT ativo
  WHERE id = (payload->>'_id')::uuid
  RETURNING to_jsonb(cupons) INTO v_result;
  RETURN v_result;
END;
$func$;

-- 13. LISTAR TODOS PRODUTOS
CREATE OR REPLACE FUNCTION public.admin_listar_produtos(payload jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(p)) INTO v_result FROM public.produtos p ORDER BY p.categoria, p.nome;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$func$;

-- 14. LISTAR TODOS INGREDIENTES
CREATE OR REPLACE FUNCTION public.admin_listar_ingredientes(payload jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(i)) INTO v_result FROM public.ingredientes i ORDER BY i.nome;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$func$;

-- 15. LISTAR RECEITAS POR PRODUTO
CREATE OR REPLACE FUNCTION public.admin_listar_receitas(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(r)) INTO v_result FROM public.receitas r WHERE r.produto_id = (payload->>'_produto_id')::uuid;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$func$;

-- 16. REGISTRAR VENDA
CREATE OR REPLACE FUNCTION public.admin_registrar_venda(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_venda_id uuid;
  v_total numeric := 0;
  v_lucro numeric := 0;
  v_itens jsonb;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade integer;
  v_preco numeric;
  v_custo numeric;
  v_result jsonb;
BEGIN
  v_itens := payload->'_itens';
  INSERT INTO public.vendas (status, metodo_pagamento, observacoes)
  VALUES ('concluido', COALESCE(payload->>'_metodo_pagamento', 'dinheiro'), payload->>'_observacoes')
  RETURNING id INTO v_venda_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_itens) LOOP
    v_produto_id := (v_item->'produto_id')::uuid;
    v_quantidade := (v_item->'quantidade')::integer;
    v_preco := (v_item->'preco')::numeric;
    SELECT COALESCE(SUM(ri.quantidade * ing.custo_unitario), 0) * v_quantidade
    INTO v_custo
    FROM public.receitas ri
    JOIN public.ingredientes ing ON ing.id = ri.ingrediente_id
    WHERE ri.produto_id = v_produto_id;
    v_total := v_total + (v_preco * v_quantidade);
    v_lucro := v_lucro + ((v_preco * v_quantidade) - v_custo);
    INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_venda_id, v_produto_id, v_quantidade, v_preco, v_preco * v_quantidade);
    UPDATE public.ingredientes
    SET quantidade = quantidade - (ri.quantidade * v_quantidade)
    FROM public.receitas ri
    WHERE ri.ingrediente_id = public.ingredientes.id AND ri.produto_id = v_produto_id;
  END LOOP;
  UPDATE public.vendas SET total = v_total, lucro = v_lucro
  WHERE id = v_venda_id
  RETURNING to_jsonb(vendas) INTO v_result;
  RETURN v_result;
END;
$func$;

-- GRANT EXECUTE to all admin functions
GRANT EXECUTE ON FUNCTION public.admin_upsert_produtos(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_produto(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_receitas(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_receitas(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ingrediente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dar_entrada(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_ingrediente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_loja(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_motoboy(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_motoboy(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_cupom(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_cupom(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_produtos(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_ingredientes(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_receitas(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_registrar_venda(jsonb) TO anon, authenticated;
