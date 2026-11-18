"use client";

import { readJson, writeJson } from "./storage";

// Последние заявки в этом браузере — чтобы легко вернуться к приватной ссылке.

export type RecentOrder = { token: string; number: string; at: string };
const KEY = "bliss:orders:v1";

export function getRecentOrders(): RecentOrder[] {
  const list = readJson<RecentOrder[]>(KEY);
  return Array.isArray(list) ? list.filter((o) => typeof o?.token === "string").slice(0, 5) : [];
}

export function rememberOrder(o: RecentOrder): void {
  writeJson(KEY, [o, ...getRecentOrders().filter((x) => x.token !== o.token)].slice(0, 5));
}
