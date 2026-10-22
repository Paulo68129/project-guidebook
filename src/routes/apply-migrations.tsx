import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { applyDatabaseMigrations } from "@/lib/apply-migrations.functions";

export const Route = createFileRoute("/apply-migrations")({
  component: ApplyMigrationsPage,
});

function ApplyMigrationsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    tables: string[];
    errors: string[];
  } | null>(null);

  // Auto-apply migrations on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto') === '1') {
      handleApply();
    }
  }, []);

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await applyDatabaseMigrations({ data: {} });
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
          Esta página aplica as migrações SQL consolidadas (0007, 0008, 0009) no banco de dados Supabase.
          Isso criará as tabelas faltantes, configurará o Realtime e atualizará as funções RPC.
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-3">O que será aplicado:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>6 tabelas: pagamentos_online, pedidos_online_audit, rastreamento_pedidos, notificacoes_delivery, feedback_clientes, respostas_feedback</li>
            <li>REPLICA IDENTITY FULL para Supabase Realtime</li>
            <li>Publicação do Realtime para todas as tabelas</li>
            <li>Triggers de rastreamento automático e notificações</li>
            <li>Funções RPC: criar_pedido_online (com descrição), aceitar/recusar pedido, feedback, etc.</li>
            <li>Row Level Security (RLS) e grants</li>
            <li>Colunas adicionais em pedidos_online</li>
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
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Tabelas verificadas ({result.tables.length}/6):</h3>
              <ul className="space-y-1">
                {result.tables.map((table) => (
                  <li key={table} className="text-sm text-green-700">✅ {table}</li>
                ))}
                {["pagamentos_online", "pedidos_online_audit", "rastreamento_pedidos", "notificacoes_delivery", "feedback_clientes", "respostas_feedback"]
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
                <strong>Próximos passos:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Verificar se os pedidos da Loja Online aparecem no Delivery em tempo real</li>
                  <li>Testar o fluxo completo: criar pedido → pagamento → aceite → entrega</li>
                  <li>Validar o sistema de avaliações e feedback</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
