// Local storage layer that works as a fallback when Supabase RLS blocks writes.
// Stores products, ingredients, and recipes in browser localStorage as JSON.
// Images are stored as base64 data URLs.

const KEYS = {
  products: "pizzastock_products",
  ingredients: "pizzastock_ingredients",
  recipes: "pizzastock_recipes",
  loja_config: "pizzastock_loja_config",
  motoboys: "pizzastock_motoboys",
  cupons: "pizzastock_cupons",
  delivery_orders: "pizzastock_delivery_orders",
};

function get<T = any>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function set<T extends { id: string }>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    // Notify other tabs and React Query that data changed
    window.dispatchEvent(new CustomEvent("pizzastock-local-change", { detail: key }));
  } catch (err: any) {
    console.error("[local-storage] Quota exceeded or error:", err.message);
  }
}

// --- Real-time sync: listen for localStorage changes from other tabs ---
// The native "storage" event fires in other tabs when localStorage changes.
// We also listen for our custom event for same-tab changes.
let _listeners: Array<(key: string) => void> = [];

export function onLocalStorageChange(fn: (key: string) => void) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

function notifyListeners(key: string) {
  for (const fn of _listeners) {
    try { fn(key); } catch {}
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("pizzastock_")) {
      notifyListeners(e.key);
    }
  });
  window.addEventListener("pizzastock-local-change", (e: any) => {
    notifyListeners(e.detail);
  });
}

function generateId() {
  return crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Products ---

export function getLocalProducts(): any[] {
  return get(KEYS.products, []);
}

export function saveLocalProduct(product: {
  id?: string;
  nome: string;
  categoria: string;
  preco: number;
  descricao?: string | null;
  foto_url?: string | null;
  ativo: boolean;
}): { id: string; error?: string } {
  try {
    const products = getLocalProducts();
    const now = new Date().toISOString();
    const idx = product.id ? products.findIndex((p: any) => p.id === product.id) : -1;

    const entry = {
      id: product.id || generateId(),
      nome: product.nome,
      categoria: product.categoria,
      preco: product.preco,
      descricao: product.descricao || null,
      foto_url: product.foto_url || null,
      ativo: product.ativo,
      created_at: idx >= 0 ? products[idx].created_at : now,
      updated_at: now,
    };

    if (idx >= 0) {
      products[idx] = entry;
    } else {
      products.push(entry);
    }

    set(KEYS.products, products);
    return { id: entry.id };
  } catch (err: any) {
    return { id: "", error: err.message };
  }
}

export function deleteLocalProduct(id: string): { error?: string } {
  try {
    const products = getLocalProducts().filter((p: any) => p.id !== id);
    set(KEYS.products, products);
    // Also delete related recipes
    const recipes = getLocalRecipes().filter((r: any) => r.produto_id !== id);
    set(KEYS.recipes, recipes);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Ingredients ---

export function getLocalIngredients(): any[] {
  return get(KEYS.ingredients, []);
}

export function saveLocalIngredient(ingredient: {
  id?: string;
  nome: string;
  unidade: string;
  quantidade: number;
  estoque_minimo: number;
  custo_unitario: number;
  validade?: string | null;
}): { id: string; error?: string } {
  try {
    const ingredients = getLocalIngredients();
    const now = new Date().toISOString();
    const idx = ingredient.id ? ingredients.findIndex((i: any) => i.id === ingredient.id) : -1;

    const entry = {
      id: ingredient.id || generateId(),
      nome: ingredient.nome,
      unidade: ingredient.unidade,
      quantidade: ingredient.quantidade,
      estoque_minimo: ingredient.estoque_minimo,
      custo_unitario: ingredient.custo_unitario,
      validade: ingredient.validade || null,
      created_at: idx >= 0 ? ingredients[idx].created_at : now,
      updated_at: now,
    };

    if (idx >= 0) {
      ingredients[idx] = entry;
    } else {
      ingredients.push(entry);
    }

    set(KEYS.ingredients, ingredients);
    return { id: entry.id };
  } catch (err: any) {
    return { id: "", error: err.message };
  }
}

export function darEntradaLocal(id: string, quantidade: number): { error?: string } {
  try {
    const ingredients = getLocalIngredients();
    const ing = ingredients.find((i: any) => i.id === id);
    if (!ing) return { error: "Ingrediente não encontrado" };
    ing.quantidade = Number(ing.quantidade) + quantidade;
    ing.updated_at = new Date().toISOString();
    set(KEYS.ingredients, ingredients);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export function deleteLocalIngredient(id: string): { error?: string } {
  try {
    const ingredients = getLocalIngredients().filter((i: any) => i.id !== id);
    set(KEYS.ingredients, ingredients);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Recipes ---

export function getLocalRecipes(): any[] {
  return get(KEYS.recipes, []);
}

export function saveLocalRecipes(produtoId: string, linhas: { ingrediente_id: string; quantidade: number }[]): { error?: string } {
  try {
    let recipes = getLocalRecipes();
    // Delete old recipes for this product
    recipes = recipes.filter((r: any) => r.produto_id !== produtoId);
    // Add new recipes
    const now = new Date().toISOString();
    for (const linha of linhas) {
      recipes.push({
        id: generateId(),
        produto_id: produtoId,
        ingrediente_id: linha.ingrediente_id,
        quantidade: linha.quantidade,
        created_at: now,
      });
    }
    set(KEYS.recipes, recipes);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Loja Config ---

export function getLocalLojaConfig(): any {
  const items = get(KEYS.loja_config, []);
  return items[0] || {
    id: 1,
    abre: "08:00",
    fecha: "22:00",
    taxa_entrega: 5,
    som_alerta: true,
  };
}

export function saveLocalLojaConfig(config: {
  abre?: string;
  fecha?: string;
  taxa_entrega?: number;
  som_alerta?: boolean;
}): { error?: string } {
  try {
    const current = getLocalLojaConfig();
    const updated = {
      ...current,
      ...config,
      updated_at: new Date().toISOString(),
    };
    set(KEYS.loja_config, [updated]);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Motoboys ---

export function getLocalMotoboys(): any[] {
  return get(KEYS.motoboys, []);
}

export function saveLocalMotoboy(nome: string, telefone?: string | null): { id: string; error?: string } {
  try {
    const motoboys = getLocalMotoboys();
    const entry = {
      id: generateId(),
      nome,
      telefone: telefone || null,
      ativo: true,
      created_at: new Date().toISOString(),
    };
    motoboys.push(entry);
    set(KEYS.motoboys, motoboys);
    return { id: entry.id };
  } catch (err: any) {
    return { id: "", error: err.message };
  }
}

export function toggleLocalMotoboy(id: string): { error?: string } {
  try {
    const motoboys = getLocalMotoboys();
    const mb = motoboys.find((m: any) => m.id === id);
    if (mb) mb.ativo = !mb.ativo;
    set(KEYS.motoboys, motoboys);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Cupons ---

export function getLocalCupons(): any[] {
  return get(KEYS.cupons, []);
}

export function saveLocalCupom(codigo: string, percentual: number): { id: string; error?: string } {
  try {
    const cupons = getLocalCupons();
    const entry = {
      id: generateId(),
      codigo,
      percentual,
      ativo: true,
      created_at: new Date().toISOString(),
    };
    cupons.push(entry);
    set(KEYS.cupons, cupons);
    return { id: entry.id };
  } catch (err: any) {
    return { id: "", error: err.message };
  }
}

export function toggleLocalCupom(id: string): { error?: string } {
  try {
    const cupons = getLocalCupons();
    const cp = cupons.find((c: any) => c.id === id);
    if (cp) cp.ativo = !cp.ativo;
    set(KEYS.cupons, cupons);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- Merge: cloud + local ---
// Merges cloud data with local data. Local data takes precedence for updates,
// and local-only items are appended.

export function mergeWithLocal<T extends { id: string }>(cloudItems: T[], localItems: T[]): T[] {
  const cloudMap = new Map(cloudItems.map((c) => [c.id, c]));
  for (const local of localItems) {
    if (cloudMap.has(local.id)) {
      // Update cloud item with local changes
      cloudMap.set(local.id, { ...cloudMap.get(local.id)!, ...local });
    } else {
      // Add local-only item
      cloudMap.set(local.id, local);
    }
  }
  return Array.from(cloudMap.values());
}

// --- Image compression ---
// Compresses an image file to a smaller base64 data URL to save localStorage space

export async function compressImage(file: File, maxWidth = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// --- Delivery Orders ---
// Stores online delivery orders locally when Supabase RLS blocks writes

export function getLocalDeliveryOrders(): any[] {
  return get(KEYS.delivery_orders, []);
}

export function saveLocalDeliveryOrder(order: {
  id?: string;
  cliente: string;
  telefone: string;
  endereco: string;
  itens: Array<{ nome: string; descricao?: string; quantidade: number; preco_unitario?: number }>;
  subtotal: number;
  desconto: number;
  taxa_entrega: number;
  total: number;
  status: string;
  status_delivery?: string;
  cupom?: string | null;
  observacoes?: string | null;
}): { id: string; error?: string } {
  try {
    const orders = getLocalDeliveryOrders();
    const now = new Date().toISOString();
    const idx = order.id ? orders.findIndex((o: any) => o.id === order.id) : -1;

    const entry = {
      id: order.id || generateId(),
      cliente: order.cliente,
      telefone: order.telefone,
      endereco: order.endereco,
      itens: order.itens,
      subtotal: order.subtotal,
      desconto: order.desconto,
      taxa_entrega: order.taxa_entrega,
      total: order.total,
      status: order.status,
      status_delivery: order.status_delivery || "pendente",
      cupom: order.cupom || null,
      observacoes: order.observacoes || null,
      created_at: idx >= 0 ? orders[idx].created_at : now,
      updated_at: now,
    };

    if (idx >= 0) {
      orders[idx] = entry;
    } else {
      orders.push(entry);
    }

    set(KEYS.delivery_orders, orders);
    return { id: entry.id };
  } catch (err: any) {
    return { id: "", error: err.message };
  }
}

export function updateLocalDeliveryOrderStatus(id: string, status: string): { error?: string } {
  try {
    const orders = getLocalDeliveryOrders();
    const order = orders.find((o: any) => o.id === id);
    if (!order) return { error: "Pedido não encontrado" };
    order.status = status;
    order.status_delivery = status;
    order.updated_at = new Date().toISOString();
    set(KEYS.delivery_orders, orders);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export function deleteLocalDeliveryOrder(id: string): { error?: string } {
  try {
    const orders = getLocalDeliveryOrders().filter((o: any) => o.id !== id);
    set(KEYS.delivery_orders, orders);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}
