import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { applyDatabaseMigrations } from "@/lib/apply-migrations.functions";

export const Route = createFileRoute("/apply-migrations")({
  validateSearch: () => ({} as { auto?: string }),
  loader: async ({ search }: any) => {
    // Auto-apply migrations when ?auto=1 is present
    if ((search as any)?.auto === '1') {
      return await applyDatabaseMigrations({ data: undefined as any });
    }
    return undefined;
  },
  component: ApplyMigrationsPage,
});

function ApplyMigrationsPage() {
  const loaderData = Route.useLoaderData();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    tables: string[];
    errors: string[];
  } | null>(loaderData as any);

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await applyDatabaseMigrations({ data: undefined as any });
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        tables: [],
        errors: [err?.message || String(err)],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Aplicar Migrações do Banco de Dados</h1>
        <p className="text-gray-600 mb-6">
          Esta página aplica a migração 0014_master_setup.sql no banco de dados Supabase.
          Isso criará/atualizará todas as 14 tabelas, funções RPC, triggers, políticas RLS e configuração Realtime.
          O script é idempotente — pode ser executado múltiplas vezes sem erros.
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-3">O que será aplicado (Migração 0014 Master):</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li><strong>14 tabelas:</strong> produtos, ingredientes, receitas, vendas, venda_itens, cupons, loja_config, pedidos_online, pagamentos_online, pedidos_online_audit, rastreamento_pedidos, notificacoes_delivery, feedback_clientes, respostas_feedback</li>
            <li>Índices de performance para todas as tabelas</li>
            <li>Funções auxiliares: is_staff, update_updated_at_column</li>
            <li>Triggers de updated_at automáticas</li>
            <li>Row Level Security (RLS) com políticas completas</li>
            <li>Grants para anon, authenticated e service_role</li>
            <li>REPLICA IDENTITY FULL para Supabase Realtime</li>
            <li>Publicação do Realtime para 8 tabelas</li>
            <li>Triggers de notificação pg_notify</li>
            <li>Trigger de rastreamento automático (auto_rastreamento)</li>
            <li>Funções RPC: catalogo_online, criar_pedido_online, consultar_pedido_online, confirmar_pagamento_online, registrar_venda, aceitar_pedido, avancar_status_pedido, adicionar_rastreamento, listar_rastreamento, criar_notificacao_delivery, marcar_notificacao_analisada, listar_notificacoes_pendentes</li>
            <li>View: vw_pagamentos_online</li>
            <li>Dados iniciais: loja_config, storage bucket</li>
          </ul>
        </div>

        <button
          onClick={handleApply}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "⏳ Aplicando migrações..." : "🚀 Aplicar Migrações"}
        </button>

        {result && (
          <div className={`mt-6 p-6 rounded-lg shadow ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <h2 className={`font-bold text-lg mb-3 ${result.success ? "text-green-800" : "text-red-800"}`}>
              {result.success ? "✅ Migrações Aplicadas com Sucesso!" : "❌ Erro nas Migrações"}
            </h2>

            <div className="mb-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Tabelas verificadas ({result.tables.length}/14):</h3>
              <ul className="space-y-1">
                {result.tables.map((table) => (
                  <li key={table} className="text-sm text-green-700">✅ {table}</li>
                ))}
                {["produtos", "ingredientes", "receitas", "vendas", "venda_itens", "cupons", "loja_config",
                  "pedidos_online", "pagamentos_online", "pedidos_online_audit", "rastreamento_pedidos",
                  "notificacoes_delivery", "feedback_clientes", "respostas_feedback"]
                  .filter((t) => !result.tables.includes(t))
                  .map((table) => (
                    <li key={table} className="text-sm text-red-700">❌ {table}</li>
                  ))}
              </ul>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-2">Erros ({result.errors.length}):</h3>
                <div className="bg-white rounded p-3 text-xs font-mono text-red-600 max-h-60 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="mb-1">{err}</div>
                  ))}
                </div>
              </div>
            )}

            {result.success && (
              <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
                <strong>✅ Sistema configurado! Próximos passos:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Acesse <strong>/loja</strong> para testar a Loja Online</li>
                  <li>Acesse <strong>/delivery</strong> para ver os pedidos em tempo real</li>
                  <li>Acesse <strong>/pdv</strong> para registrar vendas de balcão</li>
                  <li>Teste o fluxo: criar pedido → confirmar pagamento → aceitar → preparar → entregar</li>
                  <li>Valide o rastreamento em <strong>/rastrear</strong> com o token do pedido</li>
                  <li>Confirme que o som de campainha toca ao receber novos pedidos</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
