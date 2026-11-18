import { calculateQuote, type OrderItem } from "./calc";
import type { PriceList } from "./price-list";

/** Примерная цена одной позиции для подсказки при выборе мебели. */
export type ItemEstimate =
  | {
      kind: "price";
      /** итог строки (как в корзине), округлён до 10 */
      amount: number;
      /** цена одного предмета без надбавок */
      unitPrice: number;
      qty: number;
      /** сумма надбавок в процентах */
      surchargePercent: number;
      /** позиция меньше минимального заказа — если в заказе только она, итог будет минимумом */
      belowMinOrder: boolean;
      minOrder: number;
    }
  | { kind: "photo"; qty: number };

/** Считает по той же формуле, что и заявка (calculateQuote), без выезда за город. */
export function estimateItem(item: OrderItem, prices: PriceList): ItemEstimate {
  const line = calculateQuote([item], prices, false).lines[0];
  if (!line.known || !item.variant) return { kind: "photo", qty: item.qty };
  return {
    kind: "price",
    amount: line.amount,
    unitPrice: prices.variants[item.variant],
    qty: item.qty,
    surchargePercent: line.surchargePercent,
    belowMinOrder: line.amount < prices.minOrder,
    minOrder: prices.minOrder,
  };
}
