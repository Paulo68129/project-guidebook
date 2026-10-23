-- =====================================================================
-- MIGRATION 0016: INTEGRAÇÃO COMPLETA LOJA ONLINE → DELIVERY
-- =====================================================================
-- Funcionalidades:
-- 1. Recebimento automático de pedidos via Supabase Realtime
-- 2. Alerta sonoro (já implementado no frontend)
-- 3. Identificação visual de novo pedido (badge NOVO PEDIDO)
-- 4. Expiração automática de pedidos não confirmados (5 minutos)
-- 5. Limpeza automática de dados temporários
-- 6. Sincronização em tempo real (Realtime já configurado)
-- 7. Funções SQL, triggers e job automático
-- =====================================================================

BEGIN;

-- ============================================
-- 1. ADICIONA COLUNA expires_at (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pedidos_online'
      AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.pedidos_online ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Atualiza expires_at para pedidos existentes sem valor
UPDATE public.pedidos_online
SET expires_at = created_at + interval '5 minutes'
WHERE expires_at IS NULL
  AND status IN ('aguardando_pagamento', 'pendente', 'novo');

-- ============================================
-- 2. FUNÇÃO: expirar_pedido_online
-- Expira um pedido individual pelo token
-- Altera status para "cancelado", status_pagamento para "expirado"
-- Limpa dados temporários de rastreamento
-- ============================================

CREATE OR REPLACE FUNCTION public.expirar_pedido_online(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pedido RECORD;
  v_result jsonb;
BEGIN
  -- Busca o pedido pelo token
  SELECT * INTO v_pedido
  FROM public.pedidos_online
  WHERE token = _token;

  -- Verifica se o pedido existe
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado');
  END IF;

  -- Verifica se já está expirado ou cancelado
  IF v_pedido.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido já está cancelado');
  END IF;

  -- Verifica se o tempo de expiração passou
  IF v_pedido.expires_at IS NOT NULL AND now() < v_pedido.expires_at THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido ainda não expirou');
  END IF;

  -- Verifica se o pedido já foi aceito ou está em produção
  IF v_pedido.status IN ('recebido', 'preparando', 'pronto', 'em_entrega', 'finalizado') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido já está em produção');
  END IF;

  -- Expira o pedido
  UPDATE public.pedidos_online
  SET
    status = 'cancelado',
    status_pagamento = 'expirado',
    status_delivery = 'expirado',
    updated_at = now(),
    motivo_recusa = 'Tempo de pagamento expirado (5 minutos)'
  WHERE token = _token;

  -- Registra no rastreamento
  INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
  VALUES (v_pedido.id, 'expirado', 'Tempo de pagamento expirado automaticamente');

  -- Registra notificação
  INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
  VALUES (v_pedido.id, 'pedido_expirado', 'Pedido de ' || v_pedido.cliente || ' expirado por falta de pagamento em 5 minutos');

  -- Registra auditoria
  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes)
  VALUES (v_pedido.id, 'expirado', jsonb_build_object(
    'motivo', 'Tempo de pagamento expirado',
    'status_anterior', v_pedido.status,
    'expirado_em', now()
  ));

  -- Limpa dados temporários de rastreamento
  -- Mantém apenas registros históricos para auditoria
  DELETE FROM public.rastreamento_pedidos
  WHERE pedido_id = v_pedido.id
    AND status IN ('novo', 'aguardando_pagamento')
    AND criado_em < now() - interval '24 hours';

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Pedido expirado com sucesso',
    'pedido_id', v_pedido.id,
    'cliente', v_pedido.cliente
  );

  RETURN v_result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.expirar_pedido_online(uuid) TO anon, authenticated;

-- ============================================
-- 3. FUNÇÃO: limpar_pedidos_expirados
-- Verifica e expira todos os pedidos pendentes que passaram do tempo limite
-- Também limpa dados temporários antigos
-- ============================================

CREATE OR REPLACE FUNCTION public.limpar_pedidos_expirados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_expirados INTEGER := 0;
  v_rastreamento_limpos INTEGER := 0;
  v_notificacoes_limpos INTEGER := 0;
  v_pedido RECORD;
BEGIN
  -- Expira pedidos pendentes que passaram do tempo limite
  FOR v_pedido IN
    SELECT * FROM public.pedidos_online
    WHERE status IN ('aguardando_pagamento', 'pendente', 'novo')
      AND status_delivery NOT IN ('aceito', 'em_preparo', 'pronto', 'saiu', 'entregue')
      AND (
        expires_at IS NOT NULL AND now() >= expires_at
        OR (expires_at IS NULL AND created_at < now() - interval '5 minutes')
      )
  LOOP
    -- Expira o pedido
    UPDATE public.pedidos_online
    SET
      status = 'cancelado',
      status_pagamento = 'expirado',
      status_delivery = 'expirado',
      updated_at = now(),
      motivo_recusa = 'Tempo de pagamento expirado (5 minutos)'
    WHERE id = v_pedido.id;

    -- Registra no rastreamento
    INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
    VALUES (v_pedido.id, 'expirado', 'Tempo de pagamento expirado automaticamente');

    -- Registra notificação
    INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
    VALUES (v_pedido.id, 'pedido_expirado', 'Pedido de ' || v_pedido.cliente || ' expirado por falta de pagamento');

    -- Registra auditoria
    INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes)
    VALUES (v_pedido.id, 'expirado_automatico', jsonb_build_object(
      'motivo', 'Tempo de pagamento expirado',
      'status_anterior', v_pedido.status,
      'expirado_em', now()
    ));

    v_expirados := v_expirados + 1;
  END LOOP;

  -- Limpa dados temporários de rastreamento antigos (mais de 24h)
  DELETE FROM public.rastreamento_pedidos
  WHERE criado_em < now() - interval '24 hours'
    AND status IN ('novo', 'aguardando_pagamento');
  GET DIAGNOSTICS v_rastreamento_limpos = ROW_COUNT;

  -- Limpa notificações antigas analisadas (mais de 7 dias)
  DELETE FROM public.notificacoes_delivery
  WHERE analisado = true AND criado_em < now() - interval '7 days';
  GET DIAGNOSTICS v_notificacoes_limpos = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'pedidos_expirados', v_expirados,
    'rastreamento_limpos', v_rastreamento_limpos,
    'notificacoes_limpos', v_notificacoes_limpos,
    'executado_em', now()
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.limpar_pedidos_expirados() TO authenticated;

-- ============================================
-- 4. TRIGGER: auto_expira_pedido_on_insert
-- Define expires_at automaticamente ao criar um novo pedido
-- ============================================

CREATE OR REPLACE FUNCTION public.set_expires_at_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Define expires_at = created_at + 5 minutos para novos pedidos
  IF NEW.status IN ('aguardando_pagamento', 'pendente', 'novo') THEN
    NEW.expires_at := NEW.created_at + interval '5 minutes';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS set_expires_at_trigger ON public.pedidos_online;
CREATE TRIGGER set_expires_at_trigger
  BEFORE INSERT ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expires_at_on_insert();

-- ============================================
-- 5. TRIGGER: auditoria de mudanças de status
-- Registra automaticamente toda mudança de status no audit log
-- ============================================

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Registra mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
    VALUES (
      NEW.id,
      'status_mudanca',
      jsonb_build_object(
        'status_anterior', OLD.status,
        'status_novo', NEW.status,
        'mudanca_em', now()
      ),
      auth.uid()
    );
  END IF;

  -- Registra mudança de status_delivery
  IF OLD.status_delivery IS DISTINCT FROM NEW.status_delivery THEN
    INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes, usuario_id)
    VALUES (
      NEW.id,
      'status_delivery_mudanca',
      jsonb_build_object(
        'status_anterior', OLD.status_delivery,
        'status_novo', NEW.status_delivery,
        'mudanca_em', now()
      ),
      auth.uid()
    );
  END IF;

  -- Registra rastreamento para status importantes
  IF NEW.status IN ('recebido', 'preparando', 'pronto', 'em_entrega', 'finalizado', 'cancelado') THEN
    INSERT INTO public.rastreamento_pedidos (pedido_id, status, descricao)
    VALUES (
      NEW.id,
      NEW.status,
      CASE NEW.status
        WHEN 'recebido' THEN 'Pedido aceito e enviado para produção'
        WHEN 'preparando' THEN 'Pedido em preparo na cozinha'
        WHEN 'pronto' THEN 'Pedido pronto para entrega'
        WHEN 'em_entrega' THEN 'Pedido saiu para entrega'
        WHEN 'finalizado' THEN 'Pedido entregue com sucesso'
        WHEN 'cancelado' THEN 'Pedido cancelado'
        ELSE 'Status alterado para ' || NEW.status
      END
    );
  END IF;

  -- Registra notificação para novo pedido
  IF TG_OP = 'INSERT' AND NEW.status IN ('aguardando_pagamento', 'pendente', 'novo') THEN
    INSERT INTO public.notificacoes_delivery (pedido_id, tipo, mensagem)
    VALUES (
      NEW.id,
      'novo_pedido',
      'Novo pedido de ' || NEW.cliente || ' - ' || NEW.telefone
    );
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS log_status_change_trigger ON public.pedidos_online;
CREATE TRIGGER log_status_change_trigger
  AFTER INSERT OR UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

-- ============================================
-- 6. FUNÇÃO: limpar_dados_temporarios_pedido
-- Limpa todos os dados temporários de um pedido específico
-- Usado quando um pedido é expirado ou cancelado
-- ============================================

CREATE OR REPLACE FUNCTION public.limpar_dados_temporarios_pedido(_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- Limpa rastreamento temporário (mantém histórico de auditoria)
  DELETE FROM public.rastreamento_pedidos
  WHERE pedido_id = _pedido_id
    AND status IN ('novo', 'aguardando_pagamento');

  -- Limpa notificações não analisadas do pedido
  UPDATE public.notificacoes_delivery
  SET analisado = true, analisado_em = now()
  WHERE pedido_id = _pedido_id AND analisado = false;

  -- Registra auditoria da limpeza
  INSERT INTO public.pedidos_online_audit (pedido_id, acao, detalhes)
  VALUES (_pedido_id, 'dados_temporarios_limpos', jsonb_build_object(
    'limpo_em', now(),
    'motivo', 'Limpeza automática após expiração'
  ));
END;
$func$;

GRANT EXECUTE ON FUNCTION public.limpar_dados_temporarios_pedido(uuid) TO authenticated;

-- ============================================
-- 7. PG_CRON: Job automático a cada minuto
-- Verifica e expira pedidos pendentes automaticamente
-- Funciona mesmo sem operadores logados
-- ============================================

DO $$
BEGIN
  -- Verifica se pg_cron está disponível
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove job existente (se houver)
    BEGIN
      DELETE FROM cron.job WHERE jobname = 'limpar-pedidos-expirados';
    EXCEPTION WHEN OTHERS THEN
      -- Ignora erro se não houver permissão
    END;

    -- Cria job agendado para rodar a cada minuto
    BEGIN
      PERFORM cron.schedule(
        'limpar-pedidos-expirados',
        '* * * * *',  -- A cada minuto
        $$ SELECT public.limpar_pedidos_expirados() $$
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Não foi possível agendar job pg_cron: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'pg_cron não está disponível. A expiração automática funcionará via polling do frontend.';
  END IF;
END $$;

-- ============================================
-- 8. ÍNDICES para performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pedidos_online_expires_at
  ON public.pedidos_online(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_online_status_pending
  ON public.pedidos_online(status, created_at DESC)
  WHERE status IN ('aguardando_pagamento', 'pendente', 'novo');

CREATE INDEX IF NOT EXISTS idx_rastreamento_pedido_status
  ON public.rastreamento_pedidos(pedido_id, status);

CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_analisadas
  ON public.notificacoes_delivery(analisado, criado_em)
  WHERE analisado = false;

-- ============================================
-- 9. POLÍTICAS RLS para novas funções
-- ============================================

-- Permite que anon expire pedidos (para o cliente expirar seu próprio pedido)
DROP POLICY IF EXISTS "anon pode expirar pedido" ON public.pedidos_online;
CREATE POLICY "anon pode expirar pedido" ON public.pedidos_online
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 10. CONFIGURAÇÃO: habilitar som de alerta
-- ============================================

-- Garante que o som de alerta está habilitado por padrão
INSERT INTO public.loja_config (id, taxa_entrega, abre, fecha, som_alerta, aberta_manual)
VALUES (1, 5.00, '18:00', '23:30', true, null)
ON CONFLICT (id) DO UPDATE
  SET som_alerta = TRUE;

COMMIT;
