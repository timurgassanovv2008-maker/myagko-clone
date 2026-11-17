"use client";

import { useEffect, useState } from "react";
import { calculateQuote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { totalQty } from "@/lib/cart/cart";
import { ITEMS, plural } from "@/lib/cart/labels";
import { useCart } from "@/lib/cart/store";
import styles from "./CartBar.module.css";

/** Плашка «Заказ · 3 предмета · 42 000 ₸» внизу экрана, пока сам заказ не на экране. */
export function CartBar({ prices, currency }: { prices: PriceList; currency: CurrencyCode }) {
  const items = useCart();
  const cartVisible = useSectionVisible("zakaz");
  if (items.length === 0) return null;

  const qty = totalQty(items);
  const quote = calculateQuote(items, prices, false);
  const sum =
    quote.total === null
      ? "по фото"
      : `${formatMoney(quote.total, currency)}${quote.manualCount > 0 ? " + по фото" : ""}`;

  return (
    <a href="#zakaz" className={styles.bar} data-hidden={cartVisible} aria-hidden={cartVisible} tabIndex={cartVisible ? -1 : 0}>
      <span className={styles.label}>Заказ</span>
      <span>
        {qty} {plural(qty, ITEMS)} · {sum}
      </span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

function useSectionVisible(id: string) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return visible;
}
