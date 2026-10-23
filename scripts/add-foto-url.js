// Script para adicionar coluna foto_url à tabela produtos e popular com fotos padrão
// Executar com: node scripts/add-foto-url.js

const SUPABASE_URL = "https://c--0c0c1b02-c44b-413b-9a45-0ee456a97c15-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_I2ypnDcPT1b3LATkQ_SkBA_vgFLWf_U";

const FOTOS_PADRAO = {
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
  bebida: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  refrigerante: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  suco: "https://images.unsplash.com/photo-1600271886742-f049cd451bba",
  sobremesa: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  entrada: "https://images.unsplash.com/photo-1528735602780-2552fd1b1d59?w=400&h=300&fit=crop",
  combo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
};

async function addFotoUrlColumn() {
  console.log("Adicionando coluna foto_url à tabela produtos...\n");

  // Passo 1: Buscar todos os produtos
  console.log("1. Buscando produtos existentes...");
  const produtosRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*`, {
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
  console.log(`✓ Encontrados ${produtos.length} produtos\n`);

  // Passo 2: Tentar atualizar cada produto com foto_url para testar se a coluna existe
  console.log("2. Verificando se a coluna foto_url existe...");
  let colunaExiste = false;
  
  if (produtos.length > 0) {
    const testRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${produtos[0].id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ foto_url: null }),
    });

    if (testRes.ok || testRes.status === 200) {
      colunaExiste = true;
      console.log("✓ Coluna foto_url já existe\n");
    } else {
      console.log("✗ Coluna foto_url não existe no banco de dados");
      console.log("\nExecute este SQL no Supabase Dashboard > SQL Editor:\n");
      console.log("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;");
      console.log("\nDepois execute este script novamente para popular as fotos.\n");
    }
  }

  if (!colunaExiste) {
    console.log("Interrompendo... Adicione a coluna primeiro.");
    return;
  }

  // Passo 3: Popular fotos padrão
  console.log("3. Popular fotos padrão para produtos sem foto...\n");
  let atualizados = 0;

  for (const p of produtos) {
    const foto = FOTOS_PADRAO[p.categoria?.toLowerCase()];
    if (!foto) continue;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${p.id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ foto_url: foto }),
    });

    if (res.ok) {
      atualizados++;
      console.log(`  ✓ ${p.nome} (${p.categoria})`);
    }
  }

  console.log(`\n✓ ${atualizados} produtos atualizados com fotos padrão!`);
}

addFotoUrlColumn().catch(console.error);
