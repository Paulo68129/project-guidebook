import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";

type EnvCheckResult = {
  envVars: Record<string, { configured: boolean; safeValue?: string }>;
  database: {
    connected: boolean;
    tables: string[];
    errors: string[];
  };
  ready: boolean;
};

export const Route = createFileRoute("/check-env")({
  component: CheckEnvPage,
});

function CheckEnvPage() {
  const [result, setResult] = useState<EnvCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check-env");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Erro ao verificar ambiente");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Diagnóstico do Ambiente</h1>
            <p className="text-gray-600">
              Verifica se as variáveis de ambiente e o banco de dados estão configurados corretamente.
            </p>
          </div>
          <button
            onClick={check}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Verificar
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {loading && !result && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2">Verificando ambiente...</span>
          </div>
        )}

        {result && (
          <>
            {/* Status Geral */}
            <div className={`mb-6 p-4 rounded-lg border ${
              result.ready 
                ? "bg-green-50 border-green-200" 
                : "bg-yellow-50 border-yellow-200"
            }`}>
              <div className="flex items-center gap-3">
                {result.ready ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                )}
                <div>
                  <h2 className="font-semibold">
                    {result.ready 
                      ? "✅ Sistema pronto para produção!" 
                      : "⚠️ Configuração incompleta"
                    }
                  </h2>
                  <p className="text-sm text-gray-700">
                    {result.ready 
                      ? "Todas as variáveis de ambiente estão configuradas e o banco de dados está operacional."
                      : "Configure as variáveis de ambiente na Vercel para completar a instalação."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Variáveis de Ambiente */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-semibold mb-4">Variáveis de Ambiente</h2>
              <div className="space-y-3">
                {Object.entries(result.envVars).map(([name, info]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <code className="text-sm font-mono">{name}</code>
                      {info.safeValue && (
                        <span className="ml-2 text-xs text-gray-500">{info.safeValue}</span>
                      )}
                    </div>
                    {info.configured ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Banco de Dados */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-semibold mb-4">
                Banco de Dados ({result.database.tables.length}/14 tabelas)
              </h2>
              
              {result.database.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Conexão estabelecida</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {["produtos", "ingredientes", "receitas", "vendas", "venda_itens", "cupons", "loja_config",
                      "pedidos_online", "pagamentos_online", "pedidos_online_audit", "rastreamento_pedidos",
                      "notificacoes_delivery", "feedback_clientes", "respostas_feedback"].map(table => {
                      const exists = result.database.tables.includes(table);
                      return (
                        <div key={table} className={`flex items-center gap-2 p-2 rounded text-sm ${
                          exists ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                        }`}>
                          {exists ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span>{table}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Não foi possível conectar ao banco de dados</span>
                </div>
              )}

              {result.database.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded text-sm text-red-800">
                  <strong>Erros:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {result.database.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Instruções */}
            {!result.ready && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="font-semibold mb-4">📋 Instruções para Configurar</h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded">
                    <h3 className="font-medium mb-2">Passo 1: Obter as chaves do Supabase</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">supabase.com/dashboard</a></li>
                      <li>Selecione seu projeto: <code>lstycewiltrbefrxicdx</code></li>
                      <li>Vá para <strong>Settings → API</strong></li>
                      <li>Copie os valores das chaves</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-purple-50 rounded">
                    <h3 className="font-medium mb-2">Passo 2: Configurar na Vercel</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Acesse <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">vercel.com</a></li>
                      <li>Selecione o projeto <strong>PizzaStockAI</strong></li>
                      <li>Vá para <strong>Settings → Environment Variables</strong></li>
                      <li>Adicione as variáveis:</li>
                    </ol>
                    <div className="mt-2 space-y-2">
                      {[
                        { name: "SUPABASE_URL", desc: "Project URL do Supabase" },
                        { name: "SUPABASE_SERVICE_ROLE_KEY", desc: "Chave service_role (ESSENCIAL)" },
                        { name: "SUPABASE_PUBLISHABLE_KEY", desc: "Chave anon public" },
                      ].map(({ name, desc }) => (
                        <div key={name} className="p-2 bg-white rounded border">
                          <code className="text-sm font-mono">{name}</code>
                          <p className="text-xs text-gray-600">{desc}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      ⚠️ Após adicionar as variáveis, realize um novo deploy na Vercel para carregar as alterações.
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded">
                    <h3 className="font-medium mb-2">Passo 3: Aplicar Migrações</h3>
                    <p className="text-sm mb-2">
                      Após o deploy completar, acesse esta página para aplicar as migrações:
                    </p>
                    <a
                      href="/apply-migrations?auto=1"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Aplicar Migrações
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Próximos Passos */}
            {result.ready && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="font-semibold mb-4">✅ Sistema Configurado! Próximos Passos:</h2>
                <div className="space-y-2">
                  {[
                    { path: "/loja", label: "Testar Loja Online" },
                    { path: "/delivery", label: "Verificar Delivery" },
                    { path: "/pdv", label: "Registrar Vendas de Balcão" },
                    { path: "/rastrear", label: "Validar Rastreamento" },
                  ].map(({ path, label }) => (
                    <a
                      key={path}
                      href={path}
                      className="flex items-center gap-2 p-3 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <span>{label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
