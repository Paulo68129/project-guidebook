// Server-side API route for admin save operations.
// Uses supabaseAdmin (Service Role Key) to bypass RLS and schema cache issues.
// The client calls fetch('/api/admin/save', { method: 'POST', body: JSON.stringify({ action, params }) })

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/admin/save")({
  methods: ["POST"],
  beforeLoad: async ({ context }) => {
    const req = context.request;
    const body = await req.json();
    const { action, params } = body as { action: string; params: Record<string, any> };

    try {
      switch (action) {
        case "upsert_produto": {
          const { _id, _nome, _categoria, _preco, _descricao, _foto_url, _imagem_path, _ativo } = params;
          if (_id) {
            const { data, error } = await supabaseAdmin
              .from("produtos")
              .update({
                nome: _nome, categoria: _categoria, preco: _preco,
                descricao: _descricao || null, foto_url: _foto_url || null,
                imagem_path: _imagem_path || null,
                ativo: _ativo, updated_at: new Date().toISOString(),
              })
              .eq("id", _id)
              .select()
              .single();
            if (error) return { error: { message: error.message }, data: null };
            return { error: null, data };
          } else {
            const { data, error } = await supabaseAdmin
              .from("produtos")
              .insert({
                nome: _nome, categoria: _categoria, preco: _preco,
                descricao: _descricao || null, foto_url: _foto_url || null,
                imagem_path: _imagem_path || null,
                ativo: _ativo,
              })
              .select()
              .single();
            if (error) return { error: { message: error.message }, data: null };
            return { error: null, data };
          }
        }

        case "delete_produto": {
          const { error } = await supabaseAdmin.from("produtos").delete().eq("id", params._id);
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data: true };
        }

        case "delete_receitas_por_produto": {
          const { error } = await supabaseAdmin.from("receitas").delete().eq("produto_id", params._produto_id);
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data: true };
        }

        case "insert_receitas": {
          const { _produto_id, _ingrediente_ids, _quantidades } = params;
          const rows = _ingrediente_ids.map((ingId: string, i: number) => ({
            produto_id: _produto_id, ingrediente_id: ingId, quantidade: _quantidades[i],
          }));
          const { error } = await supabaseAdmin.from("receitas").insert(rows);
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data: true };
        }

        case "upsert_ingrediente": {
          const { _id, _nome, _unidade, _quantidade, _estoque_minimo, _custo_unitario, _validade } = params;
          if (_id) {
            const { data, error } = await supabaseAdmin
              .from("ingredientes")
              .update({
                nome: _nome, unidade: _unidade, quantidade: _quantidade,
                estoque_minimo: _estoque_minimo, custo_unitario: _custo_unitario,
                validade: _validade || null, updated_at: new Date().toISOString(),
              })
              .eq("id", _id)
              .select()
              .single();
            if (error) return { error: { message: error.message }, data: null };
            return { error: null, data };
          } else {
            const { data, error } = await supabaseAdmin
              .from("ingredientes")
              .insert({
                nome: _nome, unidade: _unidade, quantidade: _quantidade,
                estoque_minimo: _estoque_minimo, custo_unitario: _custo_unitario,
                validade: _validade || null,
              })
              .select()
              .single();
            if (error) return { error: { message: error.message }, data: null };
            return { error: null, data };
          }
        }

        case "dar_entrada_ingrediente": {
          const { _id, _quantidade } = params;
          const { data: current } = await supabaseAdmin.from("ingredientes").select("quantidade").eq("id", _id).single();
          if (!current?.data) return { error: { message: "Ingrediente não encontrado" }, data: null };
          const newQty = Number(current.data.quantidade) + Number(_quantidade);
          const { data, error } = await supabaseAdmin
            .from("ingredientes")
            .update({ quantidade: newQty, updated_at: new Date().toISOString() })
            .eq("id", _id)
            .select()
            .single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "delete_ingrediente": {
          const { error } = await supabaseAdmin.from("ingredientes").delete().eq("id", params._id);
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data: true };
        }

        case "update_loja_config": {
          const { _abre, _fecha, _taxa_entrega, _som_alerta } = params;
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (_abre != null) updates.abre = _abre;
          if (_fecha != null) updates.fecha = _fecha;
          if (_taxa_entrega != null) updates.taxa_entrega = _taxa_entrega;
          if (_som_alerta != null) updates.som_alerta = _som_alerta;
          const { data, error } = await supabaseAdmin.from("loja_config").update(updates).eq("id", 1).select().single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "insert_motoboy": {
          const { _nome, _telefone } = params;
          const { data, error } = await supabaseAdmin
            .from("motoboys")
            .insert({ nome: _nome, telefone: _telefone || null })
            .select()
            .single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "toggle_motoboy_ativo": {
          const { _id } = params;
          const { data: cur } = await supabaseAdmin.from("motoboys").select("ativo").eq("id", _id).single();
          if (!cur?.data) return { error: { message: "Motoboy não encontrado" }, data: null };
          const { data, error } = await supabaseAdmin
            .from("motoboys")
            .update({ ativo: !cur.data.ativo })
            .eq("id", _id)
            .select()
            .single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "insert_cupom": {
          const { _codigo, _percentual } = params;
          const { data, error } = await supabaseAdmin
            .from("cupons")
            .insert({ codigo: _codigo, percentual: _percentual })
            .select()
            .single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "toggle_cupom_ativo": {
          const { _id } = params;
          const { data: cur } = await supabaseAdmin.from("cupons").select("ativo").eq("id", _id).single();
          if (!cur?.data) return { error: { message: "Cupom não encontrado" }, data: null };
          const { data, error } = await supabaseAdmin
            .from("cupons")
            .update({ ativo: !cur.data.ativo })
            .eq("id", _id)
            .select()
            .single();
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "listar_todos_produtos": {
          const { data, error } = await supabaseAdmin.from("produtos").select("*").order("categoria").order("nome");
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "listar_todos_ingredientes": {
          const { data, error } = await supabaseAdmin.from("ingredientes").select("*").order("nome");
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "listar_receitas_por_produto": {
          const { data, error } = await supabaseAdmin.from("receitas").select("*").eq("produto_id", params._produto_id);
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        case "deletar_imagem_produto": {
          const { _produto_id, _imagem_path } = params;
          if (!_produto_id || !_imagem_path) {
            return { error: { message: "produto_id e imagem_path são obrigatórios" }, data: null };
          }
          
          // Deletar do storage
          const { error: deleteError } = await supabaseAdmin
            .storage
            .from("produtos")
            .remove([_imagem_path]);
          
          if (deleteError) {
            console.error("[admin/save] Delete image error:", deleteError);
            return { error: { message: `Erro ao deletar imagem: ${deleteError.message}` }, data: null };
          }
          
          // Atualizar o produto se era a imagem principal
          const { error: updateError } = await supabaseAdmin
            .from("produtos")
            .update({ 
              imagem_path: null,
              updated_at: new Date().toISOString() 
            })
            .eq("id", _produto_id)
            .eq("imagem_path", _imagem_path);
          
          if (updateError) {
            console.error("[admin/save] Update product error:", updateError);
          }
          
          return { error: null, data: true };
        }

        case "listar_imagens_produto": {
          const { _produto_id } = params;
          if (!_produto_id) {
            return { error: { message: "produto_id é obrigatório" }, data: null };
          }
          
          // Listar imagens do storage para este produto
          const { data: images, error } = await supabaseAdmin
            .storage
            .from("produtos")
            .list(_produto_id);
          
          if (error) {
            console.error("[admin/save] List images error:", error);
            return { error: { message: `Erro ao listar imagens: ${error.message}` }, data: null };
          }
          
          // Construir URLs públicas
          const imagesWithUrls = images?.map(img => ({
            ...img,
            publicUrl: supabaseAdmin.storage.from("produtos").getPublicUrl(`${_produto_id}/${img.name}`).data.publicUrl,
          })) || [];
          
          return { error: null, data: imagesWithUrls };
        }

        case "atualizar_imagem_produto": {
          const { _produto_id, _imagem_path } = params;
          if (!_produto_id) {
            return { error: { message: "produto_id é obrigatório" }, data: null };
          }
          
          const { data, error } = await supabaseAdmin
            .from("produtos")
            .update({ 
              imagem_path: _imagem_path || null,
              updated_at: new Date().toISOString() 
            })
            .eq("id", _produto_id)
            .select()
            .single();
          
          if (error) return { error: { message: error.message }, data: null };
          return { error: null, data };
        }

        default:
          return { error: { message: `Ação desconhecida: ${action}` }, data: null };
      }
    } catch (err: any) {
      console.error(`[admin/save] Error in ${action}:`, err);
      return { error: { message: err.message || "Internal server error" }, data: null };
    }
  },
});
