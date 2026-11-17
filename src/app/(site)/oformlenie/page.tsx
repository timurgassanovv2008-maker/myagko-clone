import type { Metadata } from "next";
import { getPublicSettings } from "@/server/public-settings";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Оформление заявки", robots: { index: false } };

export default async function CheckoutPage() {
  const { company, prices } = await getPublicSettings();
  return (
    <main className="container">
      <CheckoutForm prices={prices} currency={company.currency} />
    </main>
  );
}
