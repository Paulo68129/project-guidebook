-- Execute este SQL no Supabase Dashboard > SQL Editor
-- Isso adiciona a coluna foto_url e já atualiza a Pizza Calabresa com a foto específica

-- Passo 1: Adicionar a coluna foto_url
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Passo 2: Atualizar a Pizza Calabresa com a foto específica
UPDATE produtos 
SET foto_url = 'https://images.unsplash.com/photo-1513104890138-7c749659a591'
WHERE nome ILIKE '%calabresa%' AND nome NOT ILIKE '%combo%';

-- Passo 3 (opcional): Popular fotos padrão para outros produtos sem foto
UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'pizza';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a'
WHERE foto_url IS NULL AND LOWER(categoria) = 'bebida';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a'
WHERE foto_url IS NULL AND LOWER(categoria) = 'refrigerante';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1600271886742-f049cd451bba'
WHERE foto_url IS NULL AND LOWER(categoria) = 'suco';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'sobremesa';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1528735602780-2552fd1b1d59?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'entrada';

UPDATE produtos SET foto_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'
WHERE foto_url IS NULL AND LOWER(categoria) = 'combo';

-- Verificar resultados
SELECT id, nome, categoria, foto_url FROM produtos ORDER BY categoria, nome;
