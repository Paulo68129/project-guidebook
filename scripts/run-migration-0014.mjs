// Script para aplicar migração 0014 diretamente no Supabase via pg driver
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê as variáveis de ambiente do .env
const envPath = join(dirname(__dirname), '.env');
const envContent = readFileSync(envPath, 'utf-8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=["']?([^"\\r\\n]+)["']?`));
  return match ? match[1] : null;
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_PUBLISHABLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY não encontrados no .env');
  process.exit(1);
}

// Extrai o host do URL do Supabase
const url = new URL(supabaseUrl);
const host = url.hostname;
const port = 5432;
// O database name no Supabase é geralmente 'postgres'
const database = 'postgres';
// Usa a key publishable como password (anon key)
const user = 'anon_key';
const password = supabaseKey;

console.log('🔌 Conectando ao Supabase...');
console.log(`   Host: ${host}`);
console.log(`   Database: ${database}`);

const client = new Client({
  host: host,
  port: port,
  database: database,
  user: user,
  password: password,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('✅ Conectado com sucesso!\n');

  // Lê o SQL da migração
  const sqlPath = join(dirname(__dirname), 'supabase', 'migrations', '0014_master_setup.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log('📋 Migração 0014_master_setup.sql carregada');
  console.log(`   Tamanho: ${sql.length} caracteres\n`);

  // Divide o SQL em statements individuais (separados por ;)
  // Mas precisa cuidar de ; dentro de funções PL/pgSQL
  const statements = splitSqlStatements(sql);

  console.log(`📊 Total de statements: ${statements.length}\n`);
  console.log('🚀 Executando migração...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;

    try {
      // Pula comentários puros
      if (stmt.replace(/\s/g, '').startsWith('--')) continue;

      await client.query(stmt);
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`   ✅ ${successCount} statements executados...`);
      }
    } catch (err) {
      errorCount++;
      const preview = stmt.substring(0, 100).replace(/\n/g, ' ');
      errors.push({ stmt: preview, error: err.message });
      console.error(`   ❌ Erro em: ${preview}...`);
      console.error(`      ${err.message}`);
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Detalhes dos erros:`);
    errors.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.stmt}`);
      console.log(`      → ${e.error}`);
    });
  }

  // Verifica tabelas criadas
  console.log('\n🔍 Verificando tabelas criadas...');
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  console.log(`\n📋 Tabelas no banco (${tablesResult.rows.length}):`);
  tablesResult.rows.forEach(row => {
    console.log(`   ✅ ${row.table_name}`);
  });

  // Verifica funções
  console.log('\n🔍 Verificando funções...');
  const functionsResult = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    ORDER BY routine_name
  `);

  console.log(`\n📋 Funções no banco (${functionsResult.rows.length}):`);
  functionsResult.rows.forEach(row => {
    console.log(`   ✅ ${row.routine_name}`);
  });

  if (errorCount === 0) {
    console.log('\n🎉 Migração aplicada com sucesso!');
  } else {
    console.log(`\n⚠️  Migração aplicada com ${errorCount} erro(s).`);
    console.log('    Alguns erros podem ser esperados (tabelas já existentes, etc.)');
  }

} catch (err) {
  console.error('❌ Erro fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await client.end();
}

// Divide SQL em statements, respeitando blocos PL/pgSQL
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inBlock = 0;
  let inComment = false;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle line comments
    if (char === '-' && nextChar === '-') {
      inComment = true;
      current += char;
      continue;
    }

    if (inComment) {
      if (char === '\n') {
        inComment = false;
        current += char;
      }
      continue;
    }

    // Handle block comments
    if (char === '/' && nextChar === '*') {
      inComment = true;
      current += char;
      i++; // skip *
      continue;
    }

    if (inComment && char === '*' && nextChar === '/') {
      inComment = false;
      current += char;
      i++; // skip /
      continue;
    }

    // Handle strings
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString && char === stringChar && nextChar === stringChar) {
      current += char + nextChar;
      i++; // skip escaped quote
      continue;
    }

    if (inString && char === stringChar) {
      inString = false;
      current += char;
      continue;
    }

    // Handle $$ blocks (PL/pgSQL)
    if (char === '$' && nextChar === '$') {
      inBlock++;
      current += char + nextChar;
      i++; // skip second $
      continue;
    }

    // Track $$ closing
    if (inBlock > 0 && char === '$' && nextChar === '$') {
      inBlock--;
      current += char + nextChar;
      i++;
      continue;
    }

    // Handle semicolons outside of blocks
    if (char === ';' && inBlock === 0 && !inString) {
      statements.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  // Add remaining content
  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}
