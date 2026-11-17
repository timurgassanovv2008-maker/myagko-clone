"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { lineCount, useCart } from "@/lib/client/cart-store";
import { calculateQuote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { ITEM_FORMS, plural } from "@/lib/plural";
import styles from "./CartBar.module.css";

const HIDDEN_ON = ["/korzina", "/oformlenie", "/z/", "/admin"];

/** Плашка корзины внизу экрана — видна, когда в заказе что-то есть. */
export function CartBar({ prices, currency }: { prices: PriceList; currency: CurrencyCode }) {
  const { hydrated, lines } = useCart();
  const pathname = usePathname();
  if (!hydrated || lines.length === 0 || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const quote = calculateQuote(lines, prices, false);
  const count = lineCount(lines);
  const sum =
    quote.total !== null
      ? formatMoney(quote.total, currency) + (quote.manualCount > 0 ? " + по фото" : "")
      : "по фото";

  return (
    <div className={styles.bar}>
      <Link href="/korzina" className={styles.inner}>
        <span className={styles.text}>
          <span className={styles.count}>
            {count} {plural(count, ITEM_FORMS)}
          </span>
          <span className={`${styles.sum} tabular`}>{sum}</span>
        </span>
        <span className={styles.cta}>Корзина</span>
      </Link>
    </div>
  );
}

/** Ссылка на корзину в шапке со счётчиком. */
export function CartLink() {
  const { hydrated, lines } = useCart();
  const count = hydrated ? lineCount(lines) : 0;
  return (
    <Link href="/korzina" className={styles.headerLink} aria-label={count ? `Корзина: ${count}` : "Корзина"}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.4" fill="currentColor" />
        <circle cx="17" cy="20" r="1.4" fill="currentColor" />
      </svg>
      {count > 0 && <span className={`${styles.dot} tabular`}>{count}</span>}
    </Link>
  );
}
