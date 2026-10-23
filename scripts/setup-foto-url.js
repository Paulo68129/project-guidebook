// Script completo: adiciona coluna foto_url e popula todas as fotos
// Executar com: node scripts/setup-foto-url.js

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

async function main() {
  console.log("=== Setup completo da coluna foto_url ===\n");

  // Passo 1: Tentar adicionar coluna via API SQL
  console.log("1. Tentando adicionar coluna foto_url via API SQL...");
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
    console.log("✓ Coluna foto_url adicionada via API SQL\n");
  } else {
    console.log("⚠ API SQL não disponível (precisa de role editor/admin)");
    console.log("   Tentando método alternativo via PATCH...\n");
  }

  // Passo 2: Buscar todos os produtos
  console.log("2. Buscando produtos existentes...");
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
  console.log(`✓ Encontrados ${produtos.length} produtos:`);
  produtos.forEach(p => console.log(`  - ${p.nome} (${p.categoria})`));
  console.log();

  // Passo 3: Tentar atualizar cada produto com foto_url
  console.log("3. Atualizando produtos com fotos padrão...\n");
  let sucesso = 0;
  let falha = 0;
  let colunaNaoExiste = false;

  for (const p of produtos) {
    const cat = p.categoria?.toLowerCase();
    const foto = cat ? FOTOS_PADRAO[cat] : FOTOS_PADRAO.pizza;
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
      sucesso++;
      console.log(`  ✓ ${p.nome} → ${foto}`);
    } else {
      const errText = await res.text();
      if (errText.includes('foto_url') && (errText.includes('does not exist') || errText.includes('invalid input'))) {
        if (!colunaNaoExiste) {
          colunaNaoExiste = true;
          console.log("  ✗ Coluna foto_url não existe no banco de dados!");
          console.log("\n  === AÇÃO NECESSÁRIA ===");
          console.log("  Execute este SQL no Supabase Dashboard > SQL Editor:");
          console.log("\n  ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;");
          console.log("\n  Depois execute novamente: node scripts/setup-foto-url.js");
        }
      } else {
        falha++;
        console.log(`  ✗ ${p.nome}: ${errText.substring(0, 100)}`);
      }
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  Sucesso: ${sucesso}`);
  console.log(`  Falhas: ${falha}`);

  if (colunaNaoExiste) {
    console.log("\n⚠ A coluna foto_url precisa ser criada primeiro via SQL.");
    return;
  }

  // Passo 4: Verificar resultados
  if (sucesso > 0) {
    console.log("\n4. Verificando fotos salvas...");
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=id,nome,foto_url`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (verifyRes.ok) {
      const results = await verifyRes.json();
      results.forEach(p => {
        const status = p.foto_url ? "✓" : "✗";
        console.log(`  ${status} ${p.nome}: ${p.foto_url || "sem foto"}`);
      });
    }
  }

  console.log("\n=== Processo concluído! ===");
}

main().catch(console.error);
