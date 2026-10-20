import { z } from "zod";

export const ORDER_STATUSES = [
  "aguardando_pagamento",
  "pago",
  "preparo",
  "saiu",
  "entregue",
  "cancelado",
  "expirado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pagamento confirmado",
  preparo: "Em preparo",
  saiu: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
  expirado: "Tempo de pagamento expirado",
};

export const NEXT_STATUS: Record<OrderStatus, { status: OrderStatus; label: string } | null> = {
  aguardando_pagamento: { status: "pago", label: "Confirmar pagamento" },
  pago: { status: "preparo", label: "Iniciar preparo" },
  preparo: { status: "saiu", label: "Saiu para entrega" },
  saiu: { status: "entregue", label: "Marcar entregue" },
  entregue: null,
  cancelado: null,
  expirado: null,
};

export function isFinalStatus(status: OrderStatus) {
  return status === "entregue" || status === "cancelado" || status === "expirado";
}

export function normalizeStatus(value: unknown): OrderStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if ((ORDER_STATUSES as readonly string[]).includes(s)) return s as OrderStatus;
  if (s === "novo" || s === "confirmado") return "pago";
  if (s === "em_preparo") return "preparo";
  if (s === "saiu_para_entrega" || s === "em_rota") return "saiu";
  return "aguardando_pagamento";
}

export type OnlineItem = { produto_id: string; nome: string; quantidade: number; preco_unitario: number };

export type OnlineOrder = {
  id: string;
  cliente: string;
  telefone: string;
  endereco: string;
  itens: OnlineItem[];
  subtotal: number;
  desconto: number;
  taxa_entrega: number;
  total: number;
  cupom: string | null;
  status: OrderStatus;
  created_at: string;
  /** Tempo limite para pagamento (15 min após criação) */
  expires_at?: string | null;
  /** Presente apenas para a equipe; permite compartilhar o link de acompanhamento. */
  token?: string;
  /** `undefined` quando a coluna ainda não existe no banco (migração 0002 pendente). */
  motoboy_id?: string | null;
  /** Status do pedido no delivery: pendente, aceito, recusado */
  status_delivery?: string | null;
  /** Motivo da recusa do pedido */
  motivo_recusa?: string | null;
  /** Horário de aceite do pedido */
  aceito_em?: string | null;
  /** Horário de recusa do pedido */
  recusado_em?: string | null;
  /** Horário de entrega do pedido */
  entregue_em?: string | null;
};

export type PublicProduct = { id: string; nome: string; categoria: string; descricao: string | null; preco: number; imagem_path: string | null; imagem: string | null };
export type Catalog = { produtos: PublicProduct[]; taxa_entrega: number; abre: string; fecha: string; aberta_manual: boolean | null };

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function isUuid(value: string) {
  return new RegExp(`^${UUID_RE.source}$`, "i").test(value.trim());
}

/** Extrai o token de um link de acompanhamento (…/pagamento/<token>) ou do próprio código. */
export function extractOrderToken(value: string): string | null {
  const match = value.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

/** Código curto exibido para cliente e equipe (8 primeiros caracteres do id). */
export function orderCode(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function newOrderToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeItems(raw: unknown): OnlineItem[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      produto_id: String(item["produto_id"] ?? ""),
      nome: String(item["nome"] ?? "Item"),
      quantidade: Math.max(1, Math.round(toNumber(item["quantidade"])) || 1),
      preco_unitario: toNumber(item["preco_unitario"]),
    }));
}

/** Aceita qualquer formato vindo do banco (objeto, string JSON, array de 1 linha) e devolve um pedido consistente. */
export function normalizeOrder(raw: unknown): OnlineOrder | null {
  let value = parseJson(raw);
  if (Array.isArray(value)) value = value[0];
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!r["id"]) return null;

  const order: OnlineOrder = {
    id: String(r["id"]),
    cliente: String(r["cliente"] ?? ""),
    telefone: String(r["telefone"] ?? ""),
    endereco: String(r["endereco"] ?? ""),
    itens: normalizeItems(r["itens"]),
    subtotal: toNumber(r["subtotal"]),
    desconto: toNumber(r["desconto"]),
    taxa_entrega: toNumber(r["taxa_entrega"]),
    total: toNumber(r["total"]),
    cupom: r["cupom"] ? String(r["cupom"]) : null,
    status: normalizeStatus(r["status"]),
    created_at: r["created_at"] ? String(r["created_at"]) : new Date().toISOString(),
    expires_at: r["expires_at"] ? String(r["expires_at"]) : null,
  };
  if (typeof r["token"] === "string") order.token = r["token"];
  if ("motoboy_id" in r) order.motoboy_id = r["motoboy_id"] ? String(r["motoboy_id"]) : null;
  return order;
}

export const novoPedidoSchema = z.object({
  token: z.string().uuid("Código do pedido inválido"),
  cliente: z.string().trim().min(2, "Informe seu nome").max(120, "Nome muito longo"),
  telefone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo")
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Informe um telefone válido com DDD"),
  endereco: z.string().trim().min(8, "Endereço muito curto — inclua rua e número").max(500, "Endereço muito longo"),
  cupom: z.string().trim().max(50).default(""),
  itens: z
    .array(
      z.object({
        produto_id: z.string().uuid("Produto inválido"),
        quantidade: z.number().int().min(1).max(99, "Máximo de 99 unidades por item"),
      }),
    )
    .min(1, "Adicione itens ao pedido")
    .max(50, "Pedido com itens demais"),
});
export type NovoPedidoInput = z.input<typeof novoPedidoSchema>;
export type NovoPedido = z.output<typeof novoPedidoSchema>;

export function parseNovoPedido(input: unknown): NovoPedido {
  const result = novoPedidoSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Dados do pedido inválidos");
  return result.data;
}

export function errorMessage(error: unknown, fallback = "Erro inesperado"): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (typeof error === "string" && error) return error;
  return fallback;
}
