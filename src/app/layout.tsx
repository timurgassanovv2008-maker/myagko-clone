import type { Metadata, Viewport } from "next";
import { getPublicSettings } from "@/server/public-settings";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getPublicSettings();
  const title = `${company.name} — ${company.tagline.toLowerCase()}`;
  return {
    title: { default: title, template: `%s — ${company.name}` },
    description:
      "Выберите мебель, сразу узнайте примерную стоимость химчистки и оставьте заявку. Мастер приедет и почистит диван, кресло, матрас или стулья у вас дома.",
    applicationName: company.name,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
