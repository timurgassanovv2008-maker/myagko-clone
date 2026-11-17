"use client";

import { totalQty } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/store";

/** «Заказ» в шапке с количеством предметов. */
export function CartLink({ className }: { className?: string }) {
  const items = useCart();
  const qty = totalQty(items);
  return (
    <a href="#zakaz" className={className}>
      Заказ{qty > 0 && <span aria-label={`, предметов: ${qty}`}> · {qty}</span>}
    </a>
  );
}
