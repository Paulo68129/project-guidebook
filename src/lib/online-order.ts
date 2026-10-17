import { z } from "zod";

export const onlineOrderSchema = z.object({
  token: z.string().uuid(),
  cliente: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(30),
  endereco: z.string().trim().min(8).max(500),
  cupom: z.string().trim().max(50),
  itens: z.array(z.object({ produto_id: z.string().uuid(), quantidade: z.number().int().min(1).max(99) })).min(1).max(50),
});
export type OnlineItem = { produto_id: string; nome: string; quantidade: number; preco_unitario: number };
export type OnlineOrder = { id: string; cliente: string; telefone: string; endereco: string; itens: OnlineItem[]; subtotal: number; desconto: number; taxa_entrega: number; total: number; status: string; created_at: string };
export type PublicProduct = { id: string; nome: string; categoria: string; descricao: string | null; preco: number; imagem_path: string | null; imagem: string | null };
export type Catalog = { produtos: PublicProduct[]; taxa_entrega: number; abre: string; fecha: string; aberta_manual: boolean | null };