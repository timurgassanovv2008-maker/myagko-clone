// Валюты, которые поддерживает сайт.
// Чтобы добавить новую — допишите её сюда и добавьте демо-прайс в pricing/price-list.ts.

/** roundStep — до скольких округляется строка заказа: тенге и лиры — до 10, евро — до 1. */
export const CURRENCIES = {
  KZT: { symbol: "₸", name: "тенге", roundStep: 10 },
  TRY: { symbol: "₺", name: "турецкая лира", roundStep: 10 },
  EUR: { symbol: "€", name: "евро", roundStep: 1 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(x: string): x is CurrencyCode {
  return Object.hasOwn(CURRENCIES, x);
}

/** 18000 → «18 000 ₸», 99 → «99 €». Суммы целые, без копеек, курушей и центов. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} ${CURRENCIES[currency].symbol}`;
}
