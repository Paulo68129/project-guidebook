// Script para criar um usuário administrador no Supabase
// Executar com: node scripts/create-admin.js

const SUPABASE_URL = "https://c--0c0c1b02-c44b-413b-9a45-0ee456a97c15-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_I2ypnDcPT1b3LATkQ_SkBA_vgFLWf_U";

const email = "hankspqd6812925@gmail.com";
const password = "094067Pqd";

async function createAdminUser() {
  console.log("Criando usuário administrador...");
  console.log(`Email: ${email}`);

  // Step 1: Sign up the user via Auth API
  console.log("\n1. Registrando usuário no Supabase Auth...");
  
  const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  });

  const signUpData = await signUpRes.json();
  console.log("Resposta do sign-up:", JSON.stringify(signUpData, null, 2));

  let userId;

  // O Supabase retorna o usuário diretamente no sign-up, mesmo se já existir
  if (signUpData.user?.id) {
    userId = signUpData.user.id;
    console.log("✓ Usuário encontrado/criado!");
    console.log(`  User ID: ${userId}`);
  } else if (signUpData.id) {
    // Em alguns casos, o ID vem diretamente na resposta
    userId = signUpData.id;
    console.log("✓ Usuário encontrado/criado!");
    console.log(`  User ID: ${userId}`);
  } else {
    console.error("✗ Erro ao criar usuário:", signUpData);
    return;
  }

  // Step 2: Admin confirm the user's email via Auth API
  console.log("\n2. Confirmando email do usuário...");
  
  const confirmRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
    },
    body: JSON.stringify({
      email_confirm: true,
    }),
  });

  const confirmData = await confirmRes.json();
  console.log("Resposta da confirmação:", JSON.stringify(confirmData, null, 2));

  if (confirmRes.ok) {
    console.log("✓ Email confirmado!");
  } else {
    console.log("⚠ Não foi possível confirmar automaticamente:", confirmData);
  }

  // Step 3: Sign in to get the access token
  console.log("\n3. Fazendo login para obter token...");
  
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  });

  const signInData = await signInRes.json();
  console.log("Resposta do sign-in:", JSON.stringify(signInData, null, 2));

  if (!signInData.access_token) {
    console.error("✗ Não foi possível fazer login. O email pode precisar de confirmação manual.");
    console.log("\n📧 Instruções:");
    console.log("   1. Verifique o email de confirmação enviado para:", email);
    console.log("   2. Clique no link de confirmação");
    console.log("   3. Faça login no sistema");
    console.log("   4. O profile e role serão criados automaticamente");
    return;
  }

  const accessToken = signInData.access_token;
  console.log("✓ Login realizado com sucesso!");

  // Step 4: Insert profile with auth token
  console.log("\n4. Criando profile do usuário...");
  
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${accessToken}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      id: userId,
      email: email,
      nome: email.split("@")[0],
    }),
  });

  const profileData = await profileRes.json();
  console.log("Resposta do profile:", JSON.stringify(profileData, null, 2));

  if (profileRes.ok) {
    console.log("✓ Profile criado com sucesso!");
  } else {
    console.log("⚠ Profile pode já existir:", profileData);
  }

  // Step 5: Insert admin role with auth token
  console.log("\n5. Atribuindo role de administrador...");
  
  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${accessToken}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      role: "admin",
    }),
  });

  const roleData = await roleRes.json();
  console.log("Resposta do role:", JSON.stringify(roleData, null, 2));

  if (roleRes.ok) {
    console.log("✓ Role de administrador atribuído com sucesso!");
  } else {
    console.log("⚠ Role pode já existir:", roleData);
  }

  console.log("\n✅ Processo concluído! O usuário foi cadastrado como administrador.");
}

createAdminUser().catch(console.error);
