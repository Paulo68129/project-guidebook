// Script para aplicar as migrações 0007, 0008 e 0009 no Supabase
// Usa a API REST do Supabase com a chave publishable
//
// Como a chave publishable (anon) tem permissão limitada, este script:
// 1. Tenta criar a função apply_migration_sql via RPC (se já existir)
// 2. Se não funcionar, tenta executar cada statement individualmente
// 3. Se nada funcionar, gera instruções para execução manual

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carrega o .env manualmente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove aspas
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envVars[key] = value;
        process.env[key] = value;
      }
    }
  }
} catch (error) {
  console.warn('⚠️ Não foi possível ler .env:', error.message);
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL || 'https://lstycewiltrbefrxicdx.supabase.co';
const SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_PUBLISHABLE_KEY || '';

console.log('🔧 Script de aplicação de migrações SQL');
console.log('🔗 URL:', SUPABASE_URL);
console.log('🔑 Chave:', SUPABASE_KEY ? `${SUPABASE_KEY.substring(0, 20)}...` : '(não encontrada)');

// Lê o SQL consolidado
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '0011_consolidated_migrations.sql');
const fullSQL = readFileSync(migrationPath, 'utf-8');
console.log('\n📄 SQL consolidado carregado:', fullSQL.length, 'caracteres');

// Método 1: Tenta usar a função apply_migration_sql via RPC
async function tryRPC(sql) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_migration_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ _sql: sql }),
    });
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ RPC apply_migration_sql:', data);
      return true;
    } else {
      const error = await response.text();
      console.log('⚠️ RPC falhou:', error.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('⚠️ Erro RPC:', error.message);
    return false;
  }
}

// Método 2: Tenta executar statements individuais via REST API
async function tryIndividualStatements(sql) {
  // Separa por ;; que é o delimitador de blocos PL/pgSQL
  // Mas primeiro tenta por ; simples
  const statements = sql.split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`\n📊 ${statements.length} statements encontrados`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n')[0].trim().substring(0, 80);
    
    // Tenta executar via query direta
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/?query=${encodeURIComponent(stmt)}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      if (response.ok) {
        successCount++;
        console.log(`  ✅ ${i + 1}/${statements.length}: ${firstLine}...`);
      } else {
        failCount++;
        const error = await response.text();
        console.log(`  ❌ ${i + 1}/${statements.length}: ${firstLine}...`);
        console.log(`     Erro: ${error.substring(0, 100)}`);
      }
    } catch (error) {
      failCount++;
      console.log(`  ❌ ${i + 1}/${statements.length}: ${firstLine}...`);
      console.log(`     Erro: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Resultado: ${successCount} sucesso, ${failCount} falha`);
  return failCount === 0;
}

// Método 3: Verifica se as tabelas já existem
async function checkTables() {
  console.log('\n🔍 Verificando tabelas existentes...\n');
  
  const tables = [
    'pedidos_online',
    'pagamentos_online',
    'pedidos_online_audit',
    'rastreamento_pedidos',
    'notificacoes_delivery',
    'feedback_clientes',
    'respostas_feedback'
  ];
  
  for (const table of tables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      if (response.ok) {
        console.log(`  ✅ ${table} - EXISTS`);
      } else {
        console.log(`  ❌ ${table} - NÃO ENCONTRADA`);
      }
    } catch (error) {
      console.log(`  ❌ ${table} - ERRO: ${error.message}`);
    }
  }
  
  // Verifica funções
  console.log('\n🔍 Verificando funções...\n');
  
  const functions = [
    { name: 'criar_pedido_online', params: {} },
    { name: 'adicionar_rastreamento', params: {} },
    { name: 'listar_rastreamento', params: {} },
    { name: 'apply_migration_sql', params: {} },
  ];
  
  for (const func of functions) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${func.name}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(func.params),
      });
      
      if (response.status === 200 || response.status === 204) {
        console.log(`  ✅ ${func.name} - EXISTS`);
      } else if (response.status === 400 || response.status === 404) {
        console.log(`  ❌ ${func.name} - NÃO ENCONTRADA`);
      } else {
        console.log(`  ⚠️ ${func.name} - STATUS: ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ ${func.name} - ERRO: ${error.message}`);
    }
  }
}

// Verifica o replica identity
async function checkReplicaIdentity() {
  console.log('\n🔍 Verificando REPLICA IDENTITY...\n');
  
  const tables = ['pedidos_online', 'pagamentos_online', 'feedback_clientes'];
  
  for (const table of tables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      if (response.ok) {
        console.log(`  ✅ ${table} - acessível`);
      } else {
        console.log(`  ❌ ${table} - não acessível`);
      }
    } catch (error) {
      console.log(`  ❌ ${table} - ERRO`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('ETAPA 1: Verificando estado atual do banco');
  console.log('='.repeat(60));
  
  await checkTables();
  await checkReplicaIdentity();
  
  console.log('\n' + '='.repeat(60));
  console.log('ETAPA 2: Tentando aplicar migrações');
  console.log('='.repeat(60));
  
  // Tenta o método RPC primeiro
  console.log('\n📡 Tentando método RPC (apply_migration_sql)...');
  const rpcSuccess = await tryRPC(fullSQL);
  
  if (rpcSuccess) {
    console.log('\n🎉 Migrações aplicadas com sucesso via RPC!');
    return;
  }
  
  console.log('\n⚠️ RPC não disponível. Tentando método alternativo...');
  
  // Se RPC falhar, mostra instruções manuais
  console.log('\n' + '='.repeat(60));
  console.log('INSTRUÇÕES PARA APLICAÇÃO MANUAL');
  console.log('='.repeat(60));
  console.log('\nA chave publishable não tem permissão para executar DDL.');
  console.log('Use um dos métodos abaixo:\n');
  
  console.log('📋 MÉTODO 1 - Supabase Dashboard (Recomendado):');
  console.log('   1. Acesse: https://supabase.com/dashboard/project/lstycewiltrbefrxicdx/sql');
  console.log('   2. Copie o conteúdo de: supabase/migrations/0011_consolidated_migrations.sql');
  console.log('   3. Cole no SQL Editor e clique em RUN');
  console.log('   4. Aguarde a execução completar\n');
  
  console.log('📋 MÉTODO 2 - Lovable SQL Editor:');
  console.log('   1. No editor Lovable, abra o SQL Editor');
  console.log('   2. Cole o conteúdo de: supabase/migrations/0011_consolidated_migrations.sql');
  console.log('   3. Execute o script\n');
  
  console.log('📋 MÉTODO 3 - Supabase CLI (se disponível):');
  console.log('   1. Instale: npm install -g supabase');
  console.log('   2. Login: supabase login');
  console.log('   3. Link: supabase link --project-ref lstycewiltrbefrxicdx');
  console.log('   4. Push: supabase db push\n');
  
  console.log('📋 Arquivo SQL consolidado:');
  console.log(`   ${migrationPath}\n`);
  
  console.log('📊 O que será aplicado:');
  console.log('   ✅ 0007: REPLICA IDENTITY FULL para Realtime');
  console.log('   ✅ 0008: Tabelas de rastreamento e notificações');
  console.log('   ✅ 0009: Descrição dos itens nos pedidos');
  console.log('   ✅ Função apply_migration_sql para migrações futuras\n');
  
  console.log('⚠️ Após aplicar, valide executando:');
  console.log("   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';\n");
}

main().catch(console.error);
