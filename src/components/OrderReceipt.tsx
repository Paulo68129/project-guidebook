import { Printer } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/data";
import type { OnlineOrder } from "@/lib/online-order";

export function OrderReceipt({ order }: { order: OnlineOrder }) {
  const ref = useRef<HTMLDivElement>(null);
  function print() {
    if (!ref.current) return;
    const frame = document.createElement("iframe");
    frame.hidden = true; document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { frame.remove(); return; }
    doc.open(); doc.write('<!doctype html><html lang="pt-BR"><head><title>Comprovante PizzaStockAI</title></head><body></body></html>'); doc.close();
    doc.body.appendChild(ref.current.cloneNode(true));
    frame.contentWindow?.focus(); frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  }
  return <div className="space-y-3">
    <div ref={ref} className="space-y-2 text-sm">
      <h2 className="text-xl font-bold">PizzaStockAI</h2>
      <p>Comprovante de pedido · {order.id.slice(0, 8)}</p>
      <p>{new Date(order.created_at).toLocaleString("pt-BR")}</p>
      <p>{order.cliente} · {order.telefone}<br />{order.endereco}</p>
      <ul>{order.itens.map((i, idx) => <li key={idx}>{i.quantidade}× {i.nome} — {brl(Number(i.preco_unitario) * i.quantidade)}</li>)}</ul>
      <p>Subtotal: {brl(Number(order.subtotal))}<br />Desconto: {brl(Number(order.desconto))}<br />Entrega: {brl(Number(order.taxa_entrega))}</p>
      <p className="font-bold">Total: {brl(Number(order.total))}</p>
      <p>Pagamento não recebido · Aguardando pagamento</p>
      <p>SEM VALIDADE FISCAL — Não substitui NFC-e.</p>
    </div>
    <Button variant="outline" onClick={print}><Printer /> Imprimir comprovante</Button>
  </div>;
}