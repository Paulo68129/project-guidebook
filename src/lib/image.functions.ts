/**
 * Funções para gerenciar imagens de produtos
 * 
 * Este módulo fornece métodos para:
 * - Upload de imagens para o Supabase Storage
 * - Deletar imagens de produtos
 * - Listar imagens de um produto
 * - Atualizar a imagem de um produto
 */

// Upload de imagem para um produto
// Retorna: { path: string, publicUrl: string, produto_id: string | null }
export async function uploadImagemProduto(file: File, produtoId?: string): Promise<{ 
  path: string; 
  publicUrl: string; 
  produto_id: string | null;
} | null> {
  const formData = new FormData();
  formData.append("file", file);
  if (produtoId) {
    formData.append("produto_id", produtoId);
  }

  const response = await fetch("/api/admin/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Erro ao fazer upload da imagem");
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

// Deletar imagem de um produto
export async function deletarImagemProduto(produtoId: string, imagemPath: string): Promise<boolean> {
  const response = await fetch("/api/admin/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "deletar_imagem_produto",
      params: {
        _produto_id: produtoId,
        _imagem_path: imagemPath,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Erro ao deletar imagem");
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return true;
}

// Listar imagens de um produto
export async function listarImagensProduto(produtoId: string): Promise<any[]> {
  const response = await fetch("/api/admin/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "listar_imagens_produto",
      params: {
        _produto_id: produtoId,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Erro ao listar imagens");
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data || [];
}

// Atualizar a imagem de um produto
export async function atualizarImagemProduto(produtoId: string, imagemPath: string | null): Promise<any> {
  const response = await fetch("/api/admin/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "atualizar_imagem_produto",
      params: {
        _produto_id: produtoId,
        _imagem_path: imagemPath,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Erro ao atualizar imagem");
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

// Salvar produto com imagem (combina upload e update)
export async function salvarProdutoComImagem(produto: {
  id?: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao?: string | null;
  ativo: boolean;
  foto_url?: string | null;
}, file?: File): Promise<any> {
  // Primeiro, salvar o produto
  const response = await fetch("/api/admin/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "upsert_produto",
      params: {
        _id: produto.id,
        _nome: produto.nome,
        _categoria: produto.categoria,
        _preco: produto.preco,
        _descricao: produto.descricao,
        _foto_url: produto.foto_url,
        _ativo: produto.ativo,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Erro ao salvar produto");
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }

  const produtoSalvo = result.data;

  // Se houver um arquivo, fazer upload da imagem
  if (file && produtoSalvo.id) {
    try {
      const imagemData = await uploadImagemProduto(file, produtoSalvo.id);
      // Atualizar o produto com o caminho da imagem
      if (imagemData) {
        await atualizarImagemProduto(produtoSalvo.id, imagemData.path);
      }
    } catch (error) {
      console.error("Erro ao upload da imagem:", error);
      // Retorna o produto mesmo se o upload falhar
    }
  }

  return produtoSalvo;
}
