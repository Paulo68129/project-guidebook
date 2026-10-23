import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sql = readFileSync(join(root, 'supabase', 'migrations', '0014_master_setup.sql'), 'utf-8');

// Escapa backticks para template literal
const escapedSql = sql.replace(/`/g, '\\`');

const header = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const databaseUrl = Deno.env.get("DATABASE_URL") || "";

// SQL MASTER 0014: Setup completo do banco PizzaStockAI
const FULL_SQL = \``;

const footer = `\`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const results: Array<{ name: string; status: string; error?: string }> = [];
  try {
    console.log("🔄 Aplicando migração 0014...");
    console.log("📝 SQL length:", FULL_SQL.length);
    if (databaseUrl) {
      console.log("🔌 Conectando via DATABASE_URL...");
      const pool = new Pool(databaseUrl, { application_name: "apply-migrations" }, 5);
      const conn = await pool.connect();
      try {
        const stmts = FULL_SQL.split(";").filter(s => s.trim() && !s.trim().startsWith("--"));
        let ok = 0, fail = 0;
        for (const s of stmts) {
          try {
            await conn.queryObject(s.trim());
            ok++;
          } catch (e) {
            console.error("❌ " + e.message);
            console.error("   SQL: " + s.substring(0, 100));
            fail++;
          }
        }
        console.log("✅ OK: " + ok + ", Fail: " + fail);
        results.push({ name: "all_migrations", status: "applied" });
      } finally {
        conn.release();
        await pool.close();
      }
    } else {
      results.push({ name: "all_migrations", status: "error", error: "DATABASE_URL not set" });
    }
  } catch (err) {
    results.push({ name: "all_migrations", status: "error", error: String(err) });
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
`;

const content = header + escapedSql + footer;
const outPath = join(root, 'supabase', 'functions', 'apply-migrations', 'index.ts');
writeFileSync(outPath, content, 'utf-8');

console.log(`✅ Edge Function gerada: ${outPath}`);
console.log(`   Tamanho: ${content.length} chars`);
console.log(`   SQL embutido: ${escapedSql.length} chars`);
