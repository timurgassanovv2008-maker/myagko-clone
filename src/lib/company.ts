import type { CurrencyCode } from "./currency";

export { formatMoney } from "./currency";

// Настройки компании. Пока — демо-значения в коде.
// Когда появится база, они переедут в раздел кабинета «Компания».

/**
 * ВАЛЮТА САЙТА.
 *   "KZT" — тенге (₸)
 *   "TRY" — турецкая лира (₺)
 * Поменяйте значение — и цены, и значок валюты на сайте переключатся
 * (демо-прайс для каждой валюты лежит в src/lib/pricing/price-list.ts).
 */
export const CURRENCY: CurrencyCode = "KZT";

export type Company = {
  name: string;
  tagline: string;
  city: string;
  currency: CurrencyCode;
  /** Пусто, пока владелец не указал реальный номер. Заглушку не показываем. */
  phone: string;
  telegram: string;
};

export const DEMO_COMPANY: Company = {
  name: "BLISS",
  tagline: "Выездная химчистка мягкой мебели",
  city: "",
  currency: CURRENCY,
  phone: "",
  telegram: "",
};
