"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./order.module.css";

/** Кнопка «Скопировать ссылку» — без параметров вроде ?new=1. */
export function CopyLink() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Скопируйте ссылку", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <div className={styles.copy}>
      <p>Это приватная ссылка на вашу заявку. Не публикуйте её — по ней видны адрес и детали.</p>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
      </button>
    </div>
  );
}

/** Обновлять страницу, пока она открыта: изменения владельца появятся сами. */
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
