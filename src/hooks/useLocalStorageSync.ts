// Hook that auto-refreshes React Query when localStorage data changes.
// This enables real-time sync across all open pages when a save happens.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onLocalStorageChange } from "@/lib/local-storage";

const KEY_MAP: Record<string, string[]> = {
  pizzastock_products: ["produtos", "receitas"],
  pizzastock_ingredients: ["ingredientes", "receitas"],
  pizzastock_recipes: ["receitas"],
  pizzastock_loja_config: ["config"],
  pizzastock_motoboys: ["motoboys"],
  pizzastock_cupons: ["cupons"],
  pizzastock_delivery_orders: ["pedidos-online-delivery"],
};

export function useLocalStorageSync() {
  const qc = useQueryClient();

  useEffect(() => {
    return onLocalStorageChange((key: string) => {
      const queryKeys = KEY_MAP[key] || [];
      for (const qk of queryKeys) {
        qc.invalidateQueries({ queryKey: [qk] });
      }
      // Also invalidate vendas when ingredients change (stock impact)
      if (key === "pizzastock_ingredients") {
        qc.invalidateQueries({ queryKey: ["vendas"] });
      }
    });
  }, [qc]);
}
