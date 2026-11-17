import { Suspense } from "react";
import { getPublicSettings } from "@/server/public-settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartBar } from "@/components/CartBar";

// Оформление публичной части сайта: шапка, подвал, плашка корзины.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { company, prices } = await getPublicSettings();
  return (
    <>
      <SiteHeader name={company.name} />
      {children}
      <SiteFooter company={company} />
      <Suspense fallback={null}>
        <CartBar prices={prices} currency={company.currency} />
      </Suspense>
    </>
  );
}
