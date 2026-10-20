import { useSyncExternalStore } from "react";
import { isUuid } from "@/lib/online-order";

/**
 * Guarda no aparelho apenas os tokens (links) dos pedidos do cliente para que ele
 * possa acompanhá-los na loja sem login. Os pedidos em si ficam no banco.
 */
const STORAGE_KEY = "pizzastockai:meus-pedidos";
const CHANGE_EVENT = "pizzastockai:meus-pedidos-change";
const MAX_SAVED = 10;

export type SavedOrder = { token: string; savedAt: string };

const EMPTY: SavedOrder[] = [];
let cachedRaw: string | null | undefined;
let cachedValue: SavedOrder[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function read(): SavedOrder[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed)
      ? parsed.filter(
          (o): o is SavedOrder =>
            !!o && typeof o === "object" && typeof (o as SavedOrder).token === "string" && isUuid((o as SavedOrder).token),
        )
      : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function write(list: SavedOrder[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch {
    /* modo privado sem storage: o link do pedido continua funcionando */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function rememberOrder(token: string) {
  if (typeof window === "undefined" || !isUuid(token)) return;
  const current = read();
  if (current[0]?.token === token) return;
  write([{ token, savedAt: new Date().toISOString() }, ...current.filter((o) => o.token !== token)]);
}

export function forgetOrder(token: string) {
  if (typeof window === "undefined") return;
  const current = read();
  if (!current.some((o) => o.token === token)) return;
  write(current.filter((o) => o.token !== token));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useMyOrders(): SavedOrder[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
