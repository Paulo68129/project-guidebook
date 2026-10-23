-- 0012 - Simplificar fluxo de pedidos online
-- ============================================
-- Objetivo: Quando o operador clica em "Aceitar Pedido", o pedido vai direto
-- para "Preparando Pedido" com registro automático da venda no financeiro
-- e baixa de estoque, eliminando a etapa intermediária de confirmação de pagamento.
--
-- Fluxo simplificado:
-- Pedidos Recentes → Aceitar Pedido → Preparando Pedido → Saiu para Entrega → Entregue
-- ============================================

-- ============================================
-- Atualizar função aceitar_pedido
-- ============================================
-- Agora a função:
-- 1. Registra a venda no financeiro (registrar_venda)
-- 2. Muda o status para 'preparo' (direto para preparo)
-- 3. Muda o status_delivery para 'aceito'
-- 4. Registra no audit log

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
  -- Isso garante que o faturamento e estoque são atualizados automaticamente
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

  -- Atualiza o pedido para ir direto para preparo
  UPDATE public.pedidos_online
  SET status_delivery = 'aceito',
      aceito_em = NOW(),
      status = 'preparo'
  WHERE id = _pedido_id
    AND status_delivery = 'pendente'
  RETURNING to_jsonb(pedidos_online) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Falha ao atualizar o pedido';
  END IF;

  -- Registra no audit log
  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
  VALUES (_pedido_id, 'aceito_e_preparando', 
    jsonb_build_object(
      'timestamp', NOW()::text,
      'venda_id', venda_id,
      'status_anterior', pedido_record.status,
      'status_novo', 'preparo'
    ), 
    auth.uid());

  RETURN result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.aceitar_pedido(uuid) TO authenticated;
