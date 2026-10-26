# Sistema de Imagens de Produtos

Este documento descreve como usar o sistema de imagens implementado para salvar fotos de produtos no banco de dados.

## Visão Geral

O sistema de imagens permite:
- Upload de fotos de produtos para o Supabase Storage diretamente pelo painel admin
- Salvar o caminho das imagens no banco de dados
- Exibir imagens no cardápio admin e na loja online
- Listar imagens de um produto
- Deletar imagens de produtos
- Atualizar a imagem principal de um produto

## Arquitetura

### Banco de Dados
- Tabela `produtos` com colunas:
  - `foto_url` (text) - URL externa da imagem (ex: Unsplash) ou base64 data URL
  - `imagem_path` (text) - Caminho da imagem no Supabase Storage (prioridade na exibição)

### Supabase Storage
- Bucket: `produtos` (público)
- Permite imagens: JPEG, PNG, WebP, GIF
- Tamanho máximo: 5MB
- Estrutura de pastas: `{produto_id}/{nome_arquivo}`

### Prioridade de Exibição
O sistema usa esta ordem para determinar qual imagem mostrar:
1. `imagem_path` — imagem enviada para o Supabase Storage (prioridade máxima)
2. `foto_url` — URL externa ou base64 data URL
3. Foto padrão da categoria

## Como Usar

### 1. Upload de Imagem

```typescript
import { uploadImagemProduto } from "@/lib/image.functions";

// Upload de uma imagem
const file = event.target.files[0]; // File do input
const resultado = await uploadImagemProduto(file, produtoId);

console.log(resultado);
// {
//   path: "uuid-do-produto/1234567890-abc123.jpg",
//   publicUrl: "https://seu-projeto.supabase.co/storage/v1/object/public/produtos/...",
//   produto_id: "uuid-do-produto"
// }
```

### 2. Salvar Produto com Imagem

```typescript
import { salvarProdutoComImagem } from "@/lib/image.functions";

// Cria/atualiza produto e faz upload da imagem em uma única chamada
const produto = await salvarProdutoComImagem({
  nome: "Pizza Calabresa",
  categoria: "Pizza",
  preco: 45.90,
  descricao: "Pizza com calabresa e queijo",
  ativo: true,
}, file); // file é opcional
```

### 3. Listar Imagens de um Produto

```typescript
import { listarImagensProduto } from "@/lib/image.functions";

const imagens = await listarImagensProduto(produtoId);
console.log(imagens);
// Array de objetos com informações das imagens
```

### 4. Atualizar Imagem de um Produto

```typescript
import { atualizarImagemProduto } from "@/lib/image.functions";

// Atualiza a imagem principal do produto
await atualizarImagemProduto(produtoId, "novo-caminho-da-imagem.jpg");

// Remove a imagem do produto
await atualizarImagemProduto(produtoId, null);
```

### 5. Deletar Imagem de um Produto

```typescript
import { deletarImagemProduto } from "@/lib/image.functions";

// Deleta a imagem do storage e atualiza o produto
await deletarImagemProduto(produtoId, "caminho-da-imagem.jpg");
```

## API Endpoints

### Upload de Imagem
- **URL:** `/api/admin/upload-image`
- **Método:** POST
- **Body:** FormData
  - `file`: File (imagem)
  - `produto_id`: string (opcional, UUID do produto)

**Resposta:**
```json
{
  "error": null,
  "data": {
    "path": "uuid/1234567890-abc123.jpg",
    "publicUrl": "https://...",
    "produto_id": "uuid"
  }
}
```

### Ações do Admin Save
- **URL:** `/api/admin/save`
- **Método:** POST

#### Deletar Imagem
```json
{
  "action": "deletar_imagem_produto",
  "params": {
    "_produto_id": "uuid-do-produto",
    "_imagem_path": "caminho-da-imagem.jpg"
  }
}
```

#### Listar Imagens
```json
{
  "action": "listar_imagens_produto",
  "params": {
    "_produto_id": "uuid-do-produto"
  }
}
```

#### Atualizar Imagem
```json
{
  "action": "atualizar_imagem_produto",
  "params": {
    "_produto_id": "uuid-do-produto",
    "_imagem_path": "novo-caminho.jpg"
  }
}
```

## Migration

Para configurar o sistema de imagens, execute a migration:

```sql
-- Execute no Supabase Dashboard > SQL Editor
-- Arquivo: supabase/migrations/0019_product_images.sql
```

A migration:
1. Adiciona colunas `foto_url` e `imagem_path` na tabela `produtos`
2. Cria o bucket `produtos` no Supabase Storage
3. Configura políticas de segurança (RLS)
4. Cria funções para listar e deletar imagens

## Exemplo de Uso no Frontend

```tsx
import { useState } from "react";
import { uploadImagemProduto } from "@/lib/image.functions";

function ProdutoForm({ produtoId }) {
  const [imagem, setImagem] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleUpload = async () => {
    if (!imagem) return;
    
    setCarregando(true);
    try {
      const resultado = await uploadImagemProduto(imagem, produtoId);
      console.log("Imagem uploadada:", resultado);
      // Atualizar UI com a nova imagem
    } catch (error) {
      console.error("Erro ao uploadar imagem:", error);
      alert(error.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={(e) => setImagem(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload} disabled={carregando}>
        {carregando ? "Uploadando..." : "Uploadar Imagem"}
      </button>
    </div>
  );
}
```

## Notas Importantes

1. **Tamanho das imagens:** Máximo 5MB por imagem
2. **Formatos suportados:** JPEG, PNG, WebP, GIF
3. **Organização:** Imagens são organizadas por produto_id no storage
4. **URLs públicas:** As imagens são públicas e podem ser acessadas diretamente
5. **Segurança:** Apenas usuários autenticados podem fazer upload e deletar imagens

## Migração de Dados

Se você já tem produtos com `foto_url` do Unsplash, eles continuam funcionando. O sistema suporta ambos:
- `foto_url`: URLs externas (Unsplash, etc.)
- `imagem_path`: Imagens no Supabase Storage

Para migrar de `foto_url` para `imagem_path`, basta fazer upload da imagem e atualizar o produto com o novo caminho.
