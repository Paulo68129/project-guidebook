import { MapPin, Phone, User } from "lucide-react";
import { brl } from "@/lib/data";
import { maskTelefone } from "@/lib/pix";
import type { OnlineOrder } from "@/lib/online-order";

const TAXAS_FISCAIS = [
  { nome: "ICMS", pct: 18 },
  { nome: "PIS", pct: 1.65 },
  { nome: "COFINS", pct: 7.6 },
  { nome: "ISS", pct: 5 },
] as const;

export function OrderSummary({ pedido }: { pedido: OnlineOrder }) {
  return (
    <section aria-labelledby="detalhes-title" className="rounded-xl border bg-card p-5 md:p-6">
      <h2 id="detalhes-title" className="mb-4 font-display text-lg font-bold">
        Detalhes do pedido
      </h2>

      <dl className="mb-5 space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
        {pedido.cliente && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="text-muted-foreground">Cliente:</dt>
            <dd className="min-w-0 truncate font-medium">{pedido.cliente}</dd>
          </div>
        )}
        {pedido.telefone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="text-muted-foreground">Telefone:</dt>
            <dd className="font-medium">{maskTelefone(pedido.telefone)}</dd>
          </div>
        )}
        {pedido.endereco && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="shrink-0 text-muted-foreground">Endereço:</dt>
            <dd className="min-w-0 font-medium">{pedido.endereco}</dd>
          </div>
        )}
      </dl>

      {pedido.itens.length > 0 ? (
        <ul className="mb-4 divide-y">
          {pedido.itens.map((item, idx) => (
            <li key={`${item.produto_id}-${idx}`} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantidade}x {brl(item.preco_unitario)}
                </p>
              </div>
              <span className="shrink-0 font-semibold">{brl(item.preco_unitario * item.quantidade)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum item no pedido</p>
      )}

      <dl className="space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{brl(pedido.subtotal)}</dd>
        </div>
        {pedido.desconto > 0 && (
          <div className="flex justify-between text-success">
            <dt>Desconto{pedido.cupom ? ` (${pedido.cupom})` : ""}</dt>
            <dd>-{brl(pedido.desconto)}</dd>
          </div>
        )}
        {pedido.taxa_entrega > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxa de entrega</dt>
            <dd>{brl(pedido.taxa_entrega)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-3 font-display text-lg font-bold">
          <dt>Total</dt>
          <dd className="text-primary">{brl(pedido.total)}</dd>
        </div>
      </dl>

      <details className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground">Tributos aproximados</summary>
        <dl className="mt-3 space-y-1.5">
          {TAXAS_FISCAIS.map((t) => (
            <div key={t.nome} className="flex justify-between">
              <dt className="text-muted-foreground">
                {t.nome} ({t.pct.toLocaleString("pt-BR")}%)
              </dt>
              <dd>{brl((pedido.subtotal * t.pct) / 100)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
