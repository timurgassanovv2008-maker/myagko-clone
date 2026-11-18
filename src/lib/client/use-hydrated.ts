"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false при серверном рендере и гидрации, true — после. Для данных из localStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
