"use client";

import { useSyncExternalStore } from "react";
import { MAX_ITEMS, MAX_QTY, mergeKey, orderItemSchema, type OrderItem } from "@/lib/pricing/calc";
import { randomId, readJson, writeJson } from "./storage";

// Корзина в браузере: переживает перезагрузку, синхронизируется между вкладками.

export type CartLine = OrderItem & { id: string };

const KEY = "bliss:cart:v1";

type State = { hydrated: boolean; lines: CartLine[] };

const SERVER_STATE: State = { hydrated: false, lines: [] };
let state: State = SERVER_STATE;
const listeners = new Set<() => void>();

function load(): CartLine[] {
  const raw = readJson<unknown[]>(KEY);
  if (!Array.isArray(raw)) return [];
  const lines: CartLine[] = [];
  for (const x of raw) {
    const parsed = orderItemSchema.safeParse(x);
    const id = (x as { id?: unknown })?.id;
    if (parsed.success && typeof id === "string") lines.push({ ...parsed.data, id });
  }
  return normalize(lines);
}

/** Действительно одинаковые позиции — в одну строку; количество не больше MAX_QTY. */
function normalize(lines: CartLine[]): CartLine[] {
  const out: CartLine[] = [];
  for (const line of lines) {
    const key = mergeKey(line);
    const twin = key === null ? -1 : out.findIndex((l) => mergeKey(l) === key);
    if (twin === -1) out.push({ ...line, qty: Math.min(MAX_QTY, Math.max(1, line.qty)) });
    else out[twin] = { ...out[twin], qty: Math.min(MAX_QTY, out[twin].qty + line.qty) };
  }
  return out.slice(0, MAX_ITEMS);
}

function set(lines: CartLine[]) {
  state = { hydrated: true, lines: normalize(lines) };
  writeJson(KEY, state.lines);
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (!state.hydrated && typeof window !== "undefined") state = { hydrated: true, lines: load() };
}

function subscribe(cb: () => void) {
  ensureLoaded();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = { hydrated: true, lines: load() };
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

export function useCart(): State {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

export const cart = {
  add(item: OrderItem): void {
    ensureLoaded();
    set([...state.lines, { ...item, id: randomId(9) }]);
  },
  update(id: string, patch: Partial<OrderItem>): void {
    ensureLoaded();
    set(state.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  },
  /** Удалить и вернуть функцию отмены. */
  remove(id: string): () => void {
    ensureLoaded();
    const index = state.lines.findIndex((l) => l.id === id);
    if (index === -1) return () => {};
    const line = state.lines[index];
    set(state.lines.filter((l) => l.id !== id));
    return () => {
      const lines = [...state.lines];
      lines.splice(Math.min(index, lines.length), 0, line);
      set(lines);
    };
  },
  clear(): void {
    set([]);
  },
  items(): OrderItem[] {
    ensureLoaded();
    return state.lines.map((line) => {
      const item: OrderItem & { id?: string } = { ...line };
      delete item.id;
      return item;
    });
  },
};

export function lineCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}
