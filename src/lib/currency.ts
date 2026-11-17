// Валюты, которые поддерживает сайт.
// Чтобы добавить новую — допишите её сюда и добавьте демо-прайс в pricing/price-list.ts.

export const CURRENCIES = {
  KZT: { symbol: "₸", name: "тенге" },
  TRY: { symbol: "₺", name: "турецкая лира" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(x: string): x is CurrencyCode {
  return Object.hasOwn(CURRENCIES, x);
}

/** 18000 → «18 000 ₸». Суммы целые, без копеек/курушей. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} ${CURRENCIES[currency].symbol}`;
}
