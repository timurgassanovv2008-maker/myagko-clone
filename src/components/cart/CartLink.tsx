"use client";

import Link from "next/link";
import { totalQty } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/store";

/** «Заказ» в шапке с количеством предметов. Ведёт к корзине на главной с любой страницы. */
export function CartLink({ className }: { className?: string }) {
  const items = useCart();
  const qty = totalQty(items);
  return (
    <Link href="/#zakaz" className={className}>
      Заказ{qty > 0 && <span aria-label={`, предметов: ${qty}`}>{"\u00a0·\u00a0"}{qty}</span>}
    </Link>
  );
}
