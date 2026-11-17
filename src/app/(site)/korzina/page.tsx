import type { Metadata } from "next";
import { getPublicSettings } from "@/server/public-settings";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Корзина", robots: { index: false } };

export default async function CartPage() {
  const { company, prices } = await getPublicSettings();
  return (
    <main className="container">
      <CartView prices={prices} currency={company.currency} />
    </main>
  );
}
