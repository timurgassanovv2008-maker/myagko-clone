import type { Metadata } from "next";

// Кабинет читает cookie сеанса на каждый запрос — статической оболочки у него нет.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Кабинет", template: "%s — кабинет" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
