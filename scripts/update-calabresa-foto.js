// Script para adicionar coluna foto_url e atualizar a Pizza Calabresa
// Executar com: node scripts/update-calabresa-foto.js

const SUPABASE_URL = "https://c--0c0c1b02-c44b-413b-9a45-0ee456a97c15-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_I2ypnDcPT1b3LATkQ_SkBA_vgFLWf_U";

async function main() {
  console.log("=== Atualizando foto da Pizza Calabresa ===\n");

  // Passo 1: Adicionar coluna foto_url via SQL do Supabase
  console.log("1. Adicionando coluna foto_url à tabela produtos...");
  
  const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;"
    }),
  });

  if (sqlRes.ok) {
    console.log("✓ Coluna foto_url adicionada com sucesso\n");
  } else {
    console.log("Nota: API SQL pode não estar disponível. Tentando método alternativo...\n");
  }

  // Passo 2: Buscar o produto Pizza Calabresa
  console.log("2. Buscando produto Pizza Calabresa...");
  const produtosRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=id,nome,categoria`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!produtosRes.ok) {
    console.error("Erro ao buscar produtos:", await produtosRes.text());
    return;
  }

  const produtos = await produtosRes.json();
  const calabresa = produtos.find(p => p.nome.toLowerCase().includes('calabresa') && !p.nome.toLowerCase().includes('combo'));
  
  if (!calabresa) {
    console.error("Produto Pizza Calabresa não encontrado!");
    console.log("Produtos disponíveis:", produtos.map(p => p.nome).join(", "));
    return;
  }

  console.log(`✓ Encontrado: ${calabresa.nome} (ID: ${calabresa.id})\n`);

  // Passo 3: Atualizar com a foto específica
  console.log("3. Atualizando foto da Pizza Calabresa...");
  const fotoUrl = "https://images.unsplash.com/photo-1513104890138-7c749659a591";
  
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${calabresa.id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({ foto_url: fotoUrl }),
  });

  if (updateRes.ok) {
    const result = await updateRes.json();
    console.log("✓ Foto atualizada com sucesso!");
    console.log(`  URL: ${result[0]?.foto_url}\n`);
  } else {
    const error = await updateRes.text();
    if (error.includes('foto_url does not exist')) {
      console.error("✗ Erro: A coluna foto_url não existe no banco de dados.");
      console.log("\n=== INSTRUÇÕES MANUAIS ===");
      console.log("Execute este SQL no Supabase Dashboard > SQL Editor:");
      console.log("\nALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;");
      console.log(`\nDepois execute novamente este script.`);
    } else {
      console.error("✗ Erro ao atualizar:", error);
    }
    return;
  }

  // Passo 4: Verificar
  console.log("4. Verificando atualização...");
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${calabresa.id}&select=id,nome,foto_url`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (verifyRes.ok) {
    const result = await verifyRes.json();
    console.log("✓ Verificação concluída!");
    console.log(`  Produto: ${result[0]?.nome}`);
    console.log(`  Foto URL: ${result[0]?.foto_url}\n`);
  }

  console.log("=== Processo concluído! ===");
}

main().catch(console.error);
