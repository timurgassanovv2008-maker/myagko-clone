"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Обновить список вручную; заодно обновляется сам раз в минуту, пока вкладка открыта. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);
  return (
    <button type="button" className="btn btn-secondary" onClick={() => start(() => router.refresh())} disabled={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : "↻"} Обновить
    </button>
  );
}
