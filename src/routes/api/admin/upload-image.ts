// Server-side API route for uploading product images to Supabase Storage.
// Uses supabaseAdmin (Service Role Key) to upload files.
// The client calls fetch('/api/admin/upload-image', { method: 'POST', body: FormData })

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/admin/upload-image")({
  methods: ["POST"],
  beforeLoad: async ({ context }) => {
    const req = context.request;
    const formData = await req.formData();
    
    try {
      const file = formData.get("file") as File | null;
      const produtoId = formData.get("produto_id") as string | null;
      
      if (!file) {
        return { error: { message: "Nenhum arquivo enviado" }, data: null };
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        return { error: { message: "Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, WebP, GIF)" }, data: null };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return { error: { message: "Arquivo muito grande. Tamanho máximo: 5MB" }, data: null };
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `${timestamp}-${randomString}.${fileExt}`;
      
      // If produto_id is provided, use it in the path for better organization
      const path = produtoId ? `${produtoId}/${fileName}` : fileName;
      
      // Upload to Supabase Storage — use File directly (Supabase JS client accepts File/Blob)
      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from("produtos")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[upload-image] Upload error:", uploadError);
        return { error: { message: `Erro ao fazer upload: ${uploadError.message}` }, data: null };
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin
        .storage
        .from("produtos")
        .getPublicUrl(path);

      // If produto_id is provided, update the product with the image path
      if (produtoId) {
        const { error: updateError } = await supabaseAdmin
          .from("produtos")
          .update({ 
            imagem_path: path,
            updated_at: new Date().toISOString() 
          })
          .eq("id", produtoId);

        if (updateError) {
          console.error("[upload-image] Update error:", updateError);
          // Still return success with URL, but log the error
        }
      }

      return { 
        error: null, 
        data: { 
          path: path,
          publicUrl: urlData?.publicUrl,
          produto_id: produtoId,
        } 
      };
    } catch (err: any) {
      console.error("[upload-image] Error:", err);
      return { error: { message: err.message || "Erro interno do servidor" }, data: null };
    }
  },
});
