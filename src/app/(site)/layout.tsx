import { getPublicSettings } from "@/server/public-settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AccentStyle } from "@/components/AccentStyle";

// Оформление публичной части сайта: шапка, подвал, акцентный цвет компании.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { company } = await getPublicSettings();
  return (
    <>
      <AccentStyle accent={company.accent} />
      <SiteHeader name={company.name} />
      {children}
      <SiteFooter company={company} />
    </>
  );
}
