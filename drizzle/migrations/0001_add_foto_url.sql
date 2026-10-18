-- Migration: Adiciona coluna foto_url à tabela produtos e popula com fotos padrão
-- Executar no Supabase Dashboard > SQL Editor

-- Passo 1: Adicionar a coluna foto_url
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Passo 2: Popular fotos padrão por categoria
UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'pizza';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a'
WHERE foto_url IS NULL AND LOWER(categoria) = 'bebida';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'combo';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'sobremesa';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1528735602780-2552fd1b1d59?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'entrada';

-- Verificar resultados
SELECT id, nome, categoria, foto_url FROM produtos ORDER BY categoria, nome;
