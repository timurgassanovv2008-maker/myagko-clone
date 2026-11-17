// Настройки компании. Пока — демо-значения в коде.
// Когда появится база, они переедут в раздел кабинета «Компания».

export type Company = {
  name: string;
  tagline: string;
  city: string;
  /** Символ валюты, в которой считаются цены */
  currency: string;
  /** Пусто, пока владелец не указал реальный номер. Заглушку не показываем. */
  phone: string;
  telegram: string;
};

export const DEMO_COMPANY: Company = {
  name: "BLISS",
  tagline: "Выездная химчистка мягкой мебели",
  city: "",
  currency: "₽",
  phone: "",
  telegram: "",
};

export function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ${currency}`;
}
