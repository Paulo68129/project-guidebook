// Script para adicionar foto_url usando approach alternativo
// Tenta usar o service role key via environment ou cria via edge function
// Executar com: node scripts/add-column-foto-url.js

const SUPABASE_URL = "https://c--0c0c1b02-c44b-413b-9a45-0ee456a97c15-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_I2ypnDcPT1b3LATkQ_SkBA_vgFLWf_U";

const FOTOS_PADRAO = {
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
  bebida: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  combo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
};

async function main() {
  console.log("=== Tentando adicionar coluna foto_url ===\n");

  // Tentativa 1: Usar o endpoint de storage para verificar acesso
  console.log("1. Verificando acesso ao banco...");
  
  // Tentativa 2: Tentar criar via insert com coluna dinâmica
  console.log("2. Buscando produtos...");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    console.error("Erro:", await res.text());
    return;
  }

  const produtos = await res.json();
  console.log(`✓ ${produtos.length} produtos encontrados\n`);

  // Verificar se algum já tem foto_url
  const comFoto = produtos.filter(p => p.foto_url !== undefined);
  console.log(`Produtos com foto_url: ${comFoto.length} de ${produtos.length}\n`);

  if (comFoto.length === 0) {
    console.log("=== A coluna foto_url NÃO existe no banco de dados ===\n");
    console.log("Para adicionar, execute este SQL no Supabase Dashboard:\n");
    console.log("  1. Acesse: https://supabase.com/dashboard/project/.../sql");
    console.log("  2. Cole e execute:\n");
    console.log("     ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;\n");
    console.log("  3. Depois execute: node scripts/setup-foto-url.js\n");
    console.log("=== OU ===");
    console.log("Use a chave de service_role no ambiente:\n");
    console.log("  SUPABASE_SERVICE_KEY=sua_chave node scripts/setup-foto-url.js\n");
    return;
  }

  // Se a coluna existe, popular fotos
  console.log("3. Coluna existe! Popular fotos...\n");
  let atualizados = 0;

  for (const p of produtos) {
    const cat = p.categoria?.toLowerCase();
    const foto = cat ? FOTOS_PADRAO[cat] : FOTOS_PADRAO.pizza;
    
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${p.id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ foto_url: foto }),
    });

    if (updateRes.ok) {
      atualizados++;
      console.log(`  ✓ ${p.nome}`);
    } else {
      console.log(`  ✗ ${p.nome}: ${await updateRes.text()}`);
    }
  }

  console.log(`\n✓ ${atualizados} produtos atualizados!`);

  // Verificar
  console.log("\n4. Verificando...");
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=nome,foto_url`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (verifyRes.ok) {
    const results = await verifyRes.json();
    results.forEach(p => {
      console.log(`  ${p.foto_url ? '✓' : '✗'} ${p.nome}: ${p.foto_url || 'sem foto'}`);
    });
  }
}

main().catch(console.error);
