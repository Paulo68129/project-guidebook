-- 0013 - Unificar fluxo de pedidos para todos os módulos
-- ============================================
-- Objetivo: Criar um fluxo único e padronizado para todos os tipos de pedidos
-- (Loja Online, Balcão, Delivery) com 6 etapas operacionais.
--
-- Fluxo unificado:
-- Pendente → Recebido → Preparando → Pronto → Saiu/Retirada → Entregue/Finalizado
--
-- Status unificados:
-- pendente: Pedido criado, aguardando ser aceito
-- recebido: Pedido aceito e entrou na fila de produção
-- preparando: Pedido está sendo preparado
-- pronto: Pedido está pronto para entrega/retirada
-- em_entrega: Pedido saiu para entrega (ou pronto para retirada no balcão)
-- finalizado: Pedido entregue ou finalizado
-- cancelado: Pedido cancelado
-- ============================================

-- ============================================
-- 1. Atualizar função registrar_venda para usar status unificado
-- ============================================
-- Agora todas as vendas de delivery e balcão entram com status 'pendente'
-- para seguir o mesmo fluxo operacional

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

  -- Status unificado: delivery e balcão entram como 'pendente' para seguir o fluxo operacional
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

-- ============================================
-- 2. Migrar status existentes para o novo padrão
-- ============================================
-- Atualiza os status das vendas existentes para o novo padrão

-- Vendas de delivery com status 'novo' → 'pendente'
UPDATE vendas SET status = 'pendente' WHERE tipo = 'delivery' AND status = 'novo';

-- Vendas de delivery com status 'preparo' → 'preparando'
UPDATE vendas SET status = 'preparando' WHERE tipo = 'delivery' AND status = 'preparo';

-- Vendas de delivery com status 'saiu' → 'em_entrega'
UPDATE vendas SET status = 'em_entrega' WHERE tipo = 'delivery' AND status = 'saiu';

-- Vendas de delivery com status 'entregue' → 'finalizado'
UPDATE vendas SET status = 'finalizado' WHERE tipo = 'delivery' AND status = 'entregue';

-- Vendas de balcão com status 'concluido' → 'finalizado'
UPDATE vendas SET status = 'finalizado' WHERE tipo = 'balcao' AND status = 'concluido';

-- ============================================
-- 3. Atualizar função aceitar_pedido para usar status unificado
-- ============================================
-- Quando o operador aceita o pedido, vai direto para 'recebido'

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
  -- Verifica se o pedido existe e está pendente
  SELECT * INTO pedido_record
  FROM public.pedidos_online
  WHERE id = _pedido_id AND status_delivery = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;

  -- Registra a venda no financeiro e dá baixa no estoque
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

  -- Atualiza o pedido para status 'recebido'
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

  -- Registra no audit log
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

-- ============================================
-- 4. Adicionar coluna origem aos pedidos_online (se não existir)
-- ============================================
-- Identifica a origem do pedido: loja_online, pdv, delivery

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pedidos_online' AND column_name = 'origem') THEN
    ALTER TABLE public.pedidos_online ADD COLUMN origem text DEFAULT 'loja_online';
  END IF;
END $$;

-- ============================================
-- 5. Atualizar pedidos_online existentes para o novo padrão
-- ============================================

-- Pedidos aguardando_pagamento → pendente
UPDATE pedidos_online SET status = 'pendente' WHERE status = 'aguardando_pagamento';

-- Pedidos com status 'pago' ou 'novo' → pendente (se ainda não aceitos)
UPDATE pedidos_online SET status = 'pendente' WHERE status IN ('pago', 'novo') AND status_delivery = 'pendente';

-- Pedidos em preparo → preparando
UPDATE pedidos_online SET status = 'preparando' WHERE status = 'preparo';

-- Pedidos saiu → em_entrega
UPDATE pedidos_online SET status = 'em_entrega' WHERE status = 'saiu';

-- Pedidos entregues → finalizado
UPDATE pedidos_online SET status = 'finalizado' WHERE status = 'entregue';

-- ============================================
-- 6. Criar função para avançar status de qualquer pedido
-- ============================================
-- Função unificada para avançar o status de qualquer tipo de pedido

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
    -- Para vendas (PDV)
    SELECT status INTO old_status FROM public.vendas WHERE id = _pedido_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda não encontrada';
    END IF;

    -- Valida transição de status
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
    -- Para pedidos online
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

  -- Registra no audit log (se tabela existir)
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
-- 7. Adicionar comentários para documentação
-- ============================================

COMMENT ON FUNCTION public.registrar_venda IS 'Registra uma venda com status unificado - todos os pedidos entram como pendente para seguir o fluxo operacional';
COMMENT ON FUNCTION public.aceitar_pedido IS 'Aceita um pedido online e registra a venda no financeiro com baixa de estoque';
COMMENT ON FUNCTION public.avancar_status_pedido IS 'Avança o status de qualquer pedido seguindo o fluxo unificado com validação de transição';
