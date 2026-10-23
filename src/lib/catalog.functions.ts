import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Catalog } from "./online-order";

export const getCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<Catalog> => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error("Cardápio indisponível");
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const h = new Headers(init?.headers);
    if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
    h.set('apikey', key); return fetch(input, { ...init, headers: h });
  } } });
  const { data, error } = await client.rpc("catalogo_online");
  if (error) throw new Error("Não foi possível carregar o cardápio");
  const catalog = data as unknown as Catalog;
  catalog.produtos = await Promise.all(catalog.produtos.map(async (p) => {
    if (!p.imagem_path) return { ...p, imagem: null };
    const { data: image } = await client.storage.from("produtos").createSignedUrl(p.imagem_path, 3600);
    // Signed paths must point at the browser-reachable storage origin.
    const signed = image?.signedUrl;
    const browserUrl = import.meta.env['VITE_SUPABASE_URL'];
    return { ...p, imagem: signed && browserUrl ? signed.replace(url, browserUrl) : null };
  }));
  return catalog;
});