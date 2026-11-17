"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEY, parseStoredCart, serializeCart, type CartItem } from "./cart";

// Корзина в localStorage этого браузера. Переживает перезагрузку,
// синхронизируется между вкладками. На сервере корзина всегда пустая.

const EMPTY: CartItem[] = [];
let items: CartItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    items = parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    items = EMPTY; // приватный режим или запрещённое хранилище — корзина живёт до перезагрузки
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    items = parseStoredCart(e.newValue);
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return items;
}

const getServerSnapshot = () => EMPTY;

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function readCart(): CartItem[] {
  return getSnapshot();
}

export function writeCart(next: CartItem[]) {
  load();
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCart(next));
  } catch {
    // нет места или хранилище запрещено — работаем в памяти
  }
  emit();
}

export function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
