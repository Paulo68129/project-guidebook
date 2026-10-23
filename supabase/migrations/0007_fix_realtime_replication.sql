-- MIGRAÇÃO: Configurar replicação Realtime para todas as tabelas críticas
-- ============================================
-- O Supabase Realtime requer replica_identity FULL para enviar
-- os dados completos (old e new) nos eventos UPDATE/DELETE.
-- Sem isso, o payload pode estar vazio e o delivery não recebe
-- os novos pedidos automaticamente.
--
-- TABELAS COBERTAS:
-- - pedidos_online: sincronização entre Loja Online e Delivery
-- - pagamentos_online: auditoria de pagamentos PIX
-- - pedidos_online_audit: log de todas as ações nos pedidos
-- - rastreamento_pedidos: histórico de status para rastreamento do cliente
-- - notificacoes_delivery: notificações pendentes para o módulo de delivery
-- - feedback_clientes: avaliações dos clientes
-- - respostas_feedback: respostas da loja aos feedbacks

-- ============================================
-- 1. Configurar replica_identity FULL em todas as tabelas
-- ============================================

ALTER TABLE public.pedidos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pagamentos_online REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos_online_audit REPLICA IDENTITY FULL;
ALTER TABLE public.rastreamento_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes_delivery REPLICA IDENTITY FULL;
ALTER TABLE public.feedback_clientes REPLICA IDENTITY FULL;
ALTER TABLE public.respostas_feedback REPLICA IDENTITY FULL;

-- ============================================
-- 2. Garantir que todas as tabelas estão na publicação
-- ============================================

-- Remove e re-adiciona para garantir que a configuração está correta
BEGIN;
  -- Tenta remover se já estiver na publicação (ignora erro se não estiver)
  DO $$
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.pedidos_online;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.pagamentos_online;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.pedidos_online_audit;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.rastreamento_pedidos;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.notificacoes_delivery;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.feedback_clientes;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.respostas_feedback;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END $$;

  -- Re-adiciona todas as tabelas à publicação
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_online;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_online_audit;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rastreamento_pedidos;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_delivery;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_clientes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.respostas_feedback;
END;

-- ============================================
-- 3. Habilitar a coluna updated_at para tracking
-- ============================================

-- Garante que a função de updated_at existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para pedidos_online
DROP TRIGGER IF EXISTS set_updated_at_pedidos_online ON public.pedidos_online;
CREATE TRIGGER set_updated_at_pedidos_online
  BEFORE UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para feedback_clientes
DROP TRIGGER IF EXISTS set_updated_at_feedback_clientes ON public.feedback_clientes;
CREATE TRIGGER set_updated_at_feedback_clientes
  BEFORE UPDATE ON public.feedback_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para respostas_feedback
DROP TRIGGER IF EXISTS set_updated_at_respostas_feedback ON public.respostas_feedback;
CREATE TRIGGER set_updated_at_respostas_feedback
  BEFORE UPDATE ON public.respostas_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para rastreamento_pedidos
DROP TRIGGER IF EXISTS set_updated_at_rastreamento_pedidos ON public.rastreamento_pedidos;
CREATE TRIGGER set_updated_at_rastreamento_pedidos
  BEFORE UPDATE ON public.rastreamento_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para notificacoes_delivery
DROP TRIGGER IF EXISTS set_updated_at_notificacoes_delivery ON public.notificacoes_delivery;
CREATE TRIGGER set_updated_at_notificacoes_delivery
  BEFORE UPDATE ON public.notificacoes_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Garantir grants para Realtime
-- ============================================

-- O Realtime do Supabase usa o role 'authenticated' para receber eventos
-- Garante que authenticated pode selecionar de todas as tabelas
GRANT SELECT ON public.pedidos_online TO authenticated;
GRANT SELECT ON public.pagamentos_online TO authenticated;
GRANT SELECT ON public.pedidos_online_audit TO authenticated;
GRANT SELECT ON public.rastreamento_pedidos TO authenticated;
GRANT SELECT ON public.notificacoes_delivery TO authenticated;
GRANT SELECT ON public.feedback_clientes TO authenticated;
GRANT SELECT ON public.respostas_feedback TO authenticated;

-- ============================================
-- 5. Configurar triggers de webhook para eventos críticos
-- ============================================

-- Função para notificar mudanças em pedidos_online
CREATE OR REPLACE FUNCTION public.notify_pedidos_online_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Para INSERT, o novo registro é NEW
  -- Para UPDATE, o novo registro é NEW (com replica_identity FULL)
  -- Para DELETE, o registro antigo é OLD
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

-- Drop triggers existentes para evitar duplicação
DROP TRIGGER IF EXISTS notify_pedidos_online_insert ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_update ON public.pedidos_online;
DROP TRIGGER IF EXISTS notify_pedidos_online_delete ON public.pedidos_online;

-- Criar triggers para todos os eventos
CREATE TRIGGER notify_pedidos_online_insert
  AFTER INSERT ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pedidos_online_change();

CREATE TRIGGER notify_pedidos_online_update
  AFTER UPDATE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pedidos_online_change();

CREATE TRIGGER notify_pedidos_online_delete
  AFTER DELETE ON public.pedidos_online
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pedidos_online_change();

-- ============================================
-- 6. Verificar configuração
-- ============================================

-- Esta query pode ser usada para verificar as tabelas na publicação
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
