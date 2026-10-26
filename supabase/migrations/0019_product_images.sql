-- ============================================
-- MIGRAÇÃO: Sistema de Imagens de Produtos
-- ============================================
-- Adiciona colunas para imagens e configura o bucket de storage
-- ============================================

-- 1. Garantir que as colunas de imagem existem
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_path text;

-- 2. Criar índice para busca por imagem_path
CREATE INDEX IF NOT EXISTS idx_produtos_imagem_path ON public.produtos(imagem_path) WHERE imagem_path IS NOT NULL;

-- 3. Configurar bucket de storage para produtos
INSERT INTO storage.buckets (id, name, public, avif_autodetection, allowed_mime_types, file_size_limit)
VALUES ('produtos', 'produtos', true, false, '{"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}', 5242880)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- 4. Políticas RLS para o bucket produtos
DROP POLICY IF EXISTS "produtos read public" ON storage.objects;
CREATE POLICY "produtos read public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "produtos insert authenticated" ON storage.objects;
CREATE POLICY "produtos insert authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos');

DROP POLICY IF EXISTS "produtos update authenticated" ON storage.objects;
CREATE POLICY "produtos update authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "produtos delete authenticated" ON storage.objects;
CREATE POLICY "produtos delete authenticated" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'produtos');

-- 5. Função para obter URL assinada de imagem
CREATE OR REPLACE FUNCTION public.get_signed_image_url(image_path text, expiry_seconds integer DEFAULT 3600)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signed_url text;
BEGIN
  -- Esta função é um wrapper para criar URLs assinadas
  -- O cliente deve usar o método createSignedUrl do SDK
  RETURN NULL;
END;
$$;

-- 6. Função para listar imagens de um produto
CREATE OR REPLACE FUNCTION public.listar_imagens_produto(produto_id uuid)
RETURNS TABLE (
  name text,
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.name,
    s.id,
    s.created_at,
    s.updated_at,
    s.last_accessed_at,
    s.metadata
  FROM storage.objects s
  WHERE s.bucket_id = 'produtos'
    AND s.name LIKE produto_id::text || '%'
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_imagens_produto(uuid) TO authenticated;

-- 7. Função para deletar imagem de um produto
CREATE OR REPLACE FUNCTION public.deletar_imagem(produto_id uuid, imagem_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'produtos'
    AND name = imagem_name;
  
  -- Atualizar o produto se era a imagem principal
  UPDATE produtos 
  SET imagem_path = NULL,
      updated_at = now()
  WHERE id = produto_id 
    AND imagem_path = imagem_name;
    
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deletar_imagem(uuid, text) TO authenticated;

-- Verificar resultados
SELECT id, nome, categoria, foto_url, imagem_path FROM produtos ORDER BY categoria, nome;
