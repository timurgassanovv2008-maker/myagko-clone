"use client";

import Link from "next/link";
import { getRecentOrders } from "@/lib/client/recent-orders";
import { useHydrated } from "@/lib/client/use-hydrated";
import styles from "./RecentOrders.module.css";

export function RecentOrders() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const orders = getRecentOrders();
  if (orders.length === 0) return null;
  return (
    <section className={styles.box}>
      <h2 className={styles.title}>Ваши заявки</h2>
      <ul className={styles.list}>
        {orders.map((o) => (
          <li key={o.token}>
            <Link href={`/z/${o.token}`} className={styles.link}>
              Заявка № {o.number}
              <span className={styles.date}>{new Date(o.at).toLocaleDateString("ru-RU")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
