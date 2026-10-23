-- Script para cadastrar administrador no Supabase
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/lstycewiltrbefrxicdx/sql

-- Passo 1: Encontra o ID do usuário pelo email
-- (Substitua se houver múltiplos registros)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Pega o ID do usuário mais recente com este email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'hankspqd6812925@gmail.com'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Crie o usuário primeiro via Auth.';
  END IF;

  RAISE NOTICE 'User ID encontrado: %', v_user_id;

  -- Passo 2: Insere ou atualiza o profile
  INSERT INTO public.profiles (id, email, nome)
  VALUES (v_user_id, 'hankspqd6812925@gmail.com', 'hankspqd6812925')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome;

  RAISE NOTICE 'Profile criado/atualizado.';

  -- Passo 3: Atribui role de admin (se não existir já)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Role de admin atribuído.';

  -- Passo 4: Confirma o email do usuário (para permitir login)
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'Email confirmado.';

  RAISE NOTICE '✅ Administrador cadastrado com sucesso!';
END $$;

-- Limpa registros duplicados de auth.users (mantém apenas o mais recente)
DELETE FROM auth.users
WHERE email = 'hankspqd6812925@gmail.com'
  AND id NOT IN (
    SELECT id FROM auth.users
    WHERE email = 'hankspqd6812925@gmail.com'
    ORDER BY created_at DESC
    LIMIT 1
  );
