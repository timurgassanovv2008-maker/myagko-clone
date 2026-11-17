import type { Metadata, Viewport } from "next";
import { DEMO_COMPANY } from "@/lib/company";
import "./globals.css";

export const metadata: Metadata = {
  title: `${DEMO_COMPANY.name} — ${DEMO_COMPANY.tagline.toLowerCase()}`,
  description:
    "Выберите мебель, сразу узнайте примерную стоимость химчистки и оставьте заявку. Мастер приедет и почистит диван, кресло, матрас или стулья у вас дома.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
