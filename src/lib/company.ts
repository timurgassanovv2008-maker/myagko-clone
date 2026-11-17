import type { CurrencyCode } from "./currency";

export { formatMoney } from "./currency";

// Настройки компании. Здесь — значения по умолчанию;
// владелец меняет их в кабинете («Компания»), они хранятся в базе.

/**
 * ВАЛЮТА САЙТА.
 *   "KZT" — тенге (₸)
 *   "TRY" — турецкая лира (₺)
 * Поменяйте значение — и цены, и значок валюты на сайте переключатся
 * (демо-прайс для каждой валюты лежит в src/lib/pricing/price-list.ts).
 */
export const CURRENCY: CurrencyCode = "KZT";

/** Часовой пояс для дат и времени на сайте и в кабинете. */
export const TIME_ZONES: Record<CurrencyCode, string> = {
  KZT: "Asia/Almaty",
  TRY: "Europe/Istanbul",
};
export const TIME_ZONE = TIME_ZONES[CURRENCY];

export type Company = {
  name: string;
  tagline: string;
  /** Город, например «Алматы». Пусто — не показываем. */
  city: string;
  /** Территория выезда, например «Алматы и пригород до 30 км». */
  area: string;
  currency: CurrencyCode;
  /** Контакты. Пусто, пока владелец не указал реальные. Заглушки не показываем. */
  phone: string;
  whatsapp: string;
  telegram: string;
  email: string;
  /** Часы работы, например «Ежедневно 9:00–21:00». */
  hours: string;
  /** Акцентный цвет сайта, #RRGGBB. Пусто — фирменный зелёный. */
  accent: string;
};

export const DEMO_COMPANY: Company = {
  name: "BLISS",
  tagline: "Выездная химчистка мягкой мебели",
  city: "",
  area: "",
  currency: CURRENCY,
  phone: "",
  whatsapp: "",
  telegram: "",
  email: "",
  hours: "",
  accent: "",
};

/** Рабочие каналы связи — только заполненные. */
export function contactLinks(c: Company): { kind: string; label: string; href: string }[] {
  const out: { kind: string; label: string; href: string }[] = [];
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  if (c.phone) out.push({ kind: "phone", label: c.phone, href: `tel:${digits(c.phone)}` });
  if (c.whatsapp) out.push({ kind: "whatsapp", label: "WhatsApp", href: `https://wa.me/${digits(c.whatsapp).replace("+", "")}` });
  if (c.telegram) out.push({ kind: "telegram", label: "Telegram", href: `https://t.me/${c.telegram.replace(/^@/, "")}` });
  if (c.email) out.push({ kind: "email", label: c.email, href: `mailto:${c.email}` });
  return out;
}
