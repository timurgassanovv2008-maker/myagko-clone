import { z } from "zod";
import { MAX_ITEMS, MAX_QTY, mergeKey, orderItemSchema, type OrderItem } from "../pricing/calc";

// Корзина: чистые функции без браузера, чтобы их можно было проверить тестами.
// Хранение в localStorage — в ./store.ts.

export type CartItem = OrderItem & { id: string };

export type AddResult =
  | { ok: true; items: CartItem[]; merged: boolean; capped: boolean }
  | { ok: false; reason: "too-many-items" };

/** Добавить позицию. Действительно одинаковые объединяются (количество складывается, не больше MAX_QTY). */
export function addItem(items: CartItem[], item: CartItem): AddResult {
  const key = mergeKey(item);
  const idx = key === null ? -1 : items.findIndex((c) => mergeKey(c) === key);
  if (idx !== -1) {
    const sum = items[idx].qty + item.qty;
    const next = items.map((c, i) => (i === idx ? { ...c, qty: Math.min(MAX_QTY, sum) } : c));
    return { ok: true, items: next, merged: true, capped: sum > MAX_QTY };
  }
  if (items.length >= MAX_ITEMS) return { ok: false, reason: "too-many-items" };
  return { ok: true, items: [...items, item], merged: false, capped: false };
}

/**
 * Изменить позицию. Если после правки она совпала с другой — объединяем
 * в ту, что выше по списку, чтобы не было двух одинаковых строк.
 */
export function updateItem(items: CartItem[], id: string, patch: Partial<OrderItem>): CartItem[] {
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) return items;
  const updated: CartItem = { ...items[idx], ...patch, id };
  if (updated.category !== "other") delete updated.description;
  const key = mergeKey(updated);
  const twin = key === null ? -1 : items.findIndex((c, i) => i !== idx && mergeKey(c) === key);
  if (twin === -1) return items.map((c, i) => (i === idx ? updated : c));
  const target = Math.min(twin, idx);
  const merged: CartItem = { ...items[target], ...(target === idx ? updated : {}), qty: Math.min(MAX_QTY, items[twin].qty + updated.qty) };
  return items
    .map((c, i) => (i === target ? merged : c))
    .filter((_, i) => i !== Math.max(twin, idx));
}

export type Removed = { item: CartItem; index: number };

export function removeItem(items: CartItem[], id: string): { items: CartItem[]; removed: Removed | null } {
  const index = items.findIndex((c) => c.id === id);
  if (index === -1) return { items, removed: null };
  return { items: items.filter((c) => c.id !== id), removed: { item: items[index], index } };
}

/** Отмена удаления: вернуть позицию на прежнее место (или объединить, если такую уже добавили заново). */
export function restoreItem(items: CartItem[], removed: Removed): CartItem[] {
  if (items.some((c) => c.id === removed.item.id)) return items;
  const key = mergeKey(removed.item);
  if (key !== null && items.some((c) => mergeKey(c) === key)) {
    const result = addItem(items, removed.item);
    return result.ok ? result.items : items;
  }
  if (items.length >= MAX_ITEMS) return items;
  const at = Math.min(removed.index, items.length);
  return [...items.slice(0, at), removed.item, ...items.slice(at)];
}

export function totalQty(items: CartItem[]): number {
  return items.reduce((n, c) => n + c.qty, 0);
}

// ─── Хранение ────────────────────────────────────────────────────────

export const STORAGE_KEY = "bliss.cart.v1";
const idSchema = z.string().min(1).max(64);

/** Разобрать сохранённую корзину. Испорченные или устаревшие позиции молча отбрасываются. */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) return [];
  const out: CartItem[] = [];
  for (const entry of (data as { items: unknown[] }).items) {
    if (!entry || typeof entry !== "object") continue;
    const { id, ...rest } = entry as Record<string, unknown>;
    const parsedId = idSchema.safeParse(id);
    const parsed = orderItemSchema.safeParse(rest);
    if (!parsedId.success || !parsed.success) continue;
    if (out.some((c) => c.id === parsedId.data)) continue;
    out.push({ ...parsed.data, id: parsedId.data });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function serializeCart(items: CartItem[]): string {
  return JSON.stringify({ v: 1, items });
}
