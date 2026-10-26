import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/check-env")({
  loader: async () => {
    const result = {
      envVars: {} as Record<string, { configured: boolean; safeValue?: string }>,
      database: {
        connected: false,
        tables: [] as string[],
        errors: [] as string[],
      },
      ready: false,
    };

    // Check environment variables
    const varsToCheck = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    for (const varName of varsToCheck) {
      const value = process.env[varName] as string | undefined;
      result.envVars[varName] = {
        configured: !!value,
        safeValue: value ? `*** (${value.length} chars)` : undefined,
      } as { configured: boolean; safeValue?: string };
    }

    // Check database connection
    try {
      const tablesToCheck = [
        'produtos', 'ingredientes', 'receitas', 'vendas', 'venda_itens',
        'cupons', 'loja_config', 'pedidos_online', 'pagamentos_online',
        'pedidos_online_audit', 'rastreamento_pedidos', 'notificacoes_delivery',
        'feedback_clientes', 'respostas_feedback'
      ];

      for (const table of tablesToCheck) {
        try {
          const { error } = await (supabaseAdmin as any).from(table).select('*').limit(1);
          if (!error) {
            result.database.tables.push(table);
          } else {
            result.database.errors.push(`${table}: ${error.message}`);
          }
        } catch (err: any) {
          result.database.errors.push(`${table}: ${err?.message || String(err)}`);
        }
      }

      result.database.connected = result.database.tables.length > 0;
    } catch (err: any) {
      result.database.errors.push(`Connection error: ${err?.message || String(err)}`);
    }

    // Check if system is ready
    const hasServiceRole = !!(process.env['SUPABASE_SERVICE_ROLE_KEY'] as string | undefined);
    const hasUrl = !!(process.env['SUPABASE_URL'] as string | undefined);
    const hasTables = result.database.tables.length >= 14;

    result.ready = hasServiceRole && hasUrl && hasTables;

    return result;
  },
});
