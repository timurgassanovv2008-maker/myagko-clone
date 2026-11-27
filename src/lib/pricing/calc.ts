import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_BY_ID, VARIANT_IDS, type CategoryId, type VariantId } from "./catalog";
import type { PriceList } from "./price-list";
import { CURRENCIES } from "../currency";
import { CURRENCY } from "../company";

// ─── Позиция заказа ────────────────────────────────────────────────

export const MAX_QTY = 20;
export const MAX_ITEMS = 30;

export const orderItemSchema = z
  .object({
    category: z.enum(CATEGORY_IDS),
    variant: z.enum(VARIANT_IDS).optional(),
    qty: z.number().int().min(1).max(MAX_QTY),
    heavySoil: z.boolean().default(false),
    secondSide: z.boolean().default(false),
    /** Описание для «Другое». */
    description: z.string().trim().max(500).optional(),
  })
  .superRefine((item, ctx) => {
    const cat = CATEGORY_BY_ID[item.category];
    if (item.category === "other") {
      if (item.variant) ctx.addIssue({ code: "custom", path: ["variant"], message: "У «Другое» нет вариантов" });
      if (!item.description || item.description.length < 3)
        ctx.addIssue({ code: "custom", path: ["description"], message: "Опишите предмет" });
    } else if (!item.variant || !cat.variants.some((v) => v.id === item.variant)) {
      ctx.addIssue({ code: "custom", path: ["variant"], message: "Выберите вариант" });
    }
    if (item.secondSide && !cat.hasSecondSide)
      ctx.addIssue({ code: "custom", path: ["secondSide"], message: "Вторая сторона — только для матраса" });
  });

export type OrderItem = z.infer<typeof orderItemSchema>;

// ─── Результат расчёта ─────────────────────────────────────────────

export type LineResult =
  | {
      known: true;
      /** цена варианта × количество */
      base: number;
      /** сумма надбавок в процентах (загрязнения + вторая сторона) */
      surchargePercent: number;
      /** итог строки, округлён до шага валюты (тенге, лиры — 10; евро — 1) */
      amount: number;
    }
  | { known: false };

export type Quote = {
  lines: LineResult[];
  /** Сумма строк с известной ценой */
  knownSubtotal: number;
  /** Сколько предметов оцениваются по фото */
  manualCount: number;
  /** Сработал ли минимальный заказ */
  minOrderApplied: boolean;
  /** Чистка с учётом минимума; null — если известных позиций нет */
  cleaning: number | null;
  /** Доплата за выезд за город (0, если не нужен) */
  outOfTown: number;
  /** Предварительный итог известной части; null — если всё «по фото» */
  total: number | null;
};

/** Шаг округления строки для валюты сайта. */
export const ROUND_STEP: number = CURRENCIES[CURRENCY].roundStep;

/** Округление до шага (10 или 1), половина — вверх. Работает на целых числах. */
function roundToStep(hundredths: number, step: number): number {
  // hundredths = сумма × 100
  return Math.floor((hundredths + step * 50) / (step * 100)) * step;
}

/**
 * Единственная формула расчёта. Её же вызывает сервер при приёме заявки.
 *
 *   позиция = округлить( цена × кол-во × (100 + загрязнения% + вторая_сторона%) / 100 )   — до 10 (₸, ₺) или до 1 (€)
 *   чистка  = max(сумма позиций, минимальный заказ)   — если есть хотя бы одна позиция с ценой
 *   итог    = чистка + выезд за город
 */
export function calculateQuote(items: OrderItem[], prices: PriceList, outOfTown: boolean, roundStep: number = ROUND_STEP): Quote {
  const lines: LineResult[] = items.map((item) => {
    if (item.category === "other" || !item.variant) return { known: false };
    const base = prices.variants[item.variant] * item.qty;
    const surchargePercent =
      (item.heavySoil ? prices.heavySoilPercent : 0) +
      (item.secondSide && CATEGORY_BY_ID[item.category].hasSecondSide ? prices.mattressSecondSidePercent : 0);
    return { known: true, base, surchargePercent, amount: roundToStep(base * (100 + surchargePercent), roundStep) };
  });

  const knownLines = lines.filter((l): l is Extract<LineResult, { known: true }> => l.known);
  const knownSubtotal = knownLines.reduce((s, l) => s + l.amount, 0);
  const manualCount = items.reduce((n, item, i) => (lines[i].known ? n : n + item.qty), 0);
  const outOfTownFee = outOfTown ? prices.outOfTownFee : 0;

  if (knownLines.length === 0) {
    return { lines, knownSubtotal: 0, manualCount, minOrderApplied: false, cleaning: null, outOfTown: outOfTownFee, total: null };
  }

  const minOrderApplied = knownSubtotal < prices.minOrder;
  const cleaning = Math.max(knownSubtotal, prices.minOrder);
  return { lines, knownSubtotal, manualCount, minOrderApplied, cleaning, outOfTown: outOfTownFee, total: cleaning + outOfTownFee };
}

// ─── Корзина: объединение одинаковых позиций ───────────────────────

/** Ключ, по которому одинаковые позиции объединяются. «Другое» не объединяется. */
export function mergeKey(item: Pick<OrderItem, "category" | "variant" | "heavySoil" | "secondSide">): string | null {
  if (item.category === "other") return null;
  return [item.category, item.variant, item.heavySoil ? 1 : 0, item.secondSide ? 1 : 0].join("|");
}

/** Добавить позицию: если такая уже есть — увеличить количество (не больше MAX_QTY). */
export function addToCart<T extends OrderItem>(cart: T[], item: T): T[] {
  const key = mergeKey(item);
  if (key !== null) {
    const idx = cart.findIndex((c) => mergeKey(c) === key);
    if (idx !== -1) {
      return cart.map((c, i) => (i === idx ? { ...c, qty: Math.min(MAX_QTY, c.qty + item.qty) } : c));
    }
  }
  return [...cart, item];
}

export function isCategory(x: string): x is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(x);
}

export type { CategoryId, VariantId };
