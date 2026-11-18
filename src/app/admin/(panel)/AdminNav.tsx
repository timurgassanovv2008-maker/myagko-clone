"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";

const ITEMS = [
  { href: "/admin", title: "Заявки" },
  { href: "/admin/tarify", title: "Тарифы" },
  { href: "/admin/kompaniya", title: "Компания" },
  { href: "/admin/dostup", title: "Доступ" },
];

export function AdminNav({ newCount }: { newCount: number }) {
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label="Разделы кабинета">
      {ITEMS.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" || path.startsWith("/admin/zayavki") : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={styles.navItem} aria-current={active ? "page" : undefined}>
            {it.title}
            {it.href === "/admin" && newCount > 0 && <span className={styles.navBadge}>{newCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
