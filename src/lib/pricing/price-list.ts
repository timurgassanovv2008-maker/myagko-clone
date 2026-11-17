import { z } from "zod";
import { VARIANT_IDS, type VariantId } from "./catalog";
import { CURRENCY } from "../company";
import type { CurrencyCode } from "../currency";

// Прайс компании. Хранится в настройках, меняется в кабинете («Тарифы»).
// Все суммы — целые, в основной валюте компании (без копеек).

const money = z.number().int().min(0).max(10_000_000);
const percent = z.number().int().min(0).max(300);

export const priceListSchema = z.object({
  variants: z.object(
    Object.fromEntries(VARIANT_IDS.map((id) => [id, money])) as Record<VariantId, typeof money>,
  ),
  minOrder: money,
  heavySoilPercent: percent,
  mattressSecondSidePercent: percent,
  outOfTownFee: money,
});

export type PriceList = z.infer<typeof priceListSchema>;

/**
 * Демо-прайсы для каждой валюты. Это примерные цены для показа,
 * владелец заменит их своими в «Тарифах».
 */
export const DEMO_PRICE_LISTS: Record<CurrencyCode, PriceList> = {
  KZT: {
    variants: {
      "sofa-2": 18000,
      "sofa-3": 24000,
      "sofa-corner": 32000,
      armchair: 9000,
      "armchair-recliner": 12000,
      "mattress-single": 12000,
      "mattress-double": 18000,
      "chair-seat": 2500,
      "chair-seat-back": 3500,
    },
    minOrder: 15000,
    heavySoilPercent: 30,
    mattressSecondSidePercent: 70,
    outOfTownFee: 5000,
  },
  TRY: {
    variants: {
      "sofa-2": 2500,
      "sofa-3": 3200,
      "sofa-corner": 4200,
      armchair: 1200,
      "armchair-recliner": 1600,
      "mattress-single": 1600,
      "mattress-double": 2400,
      "chair-seat": 350,
      "chair-seat-back": 500,
    },
    minOrder: 2000,
    heavySoilPercent: 30,
    mattressSecondSidePercent: 70,
    outOfTownFee: 750,
  },
};

/** Демо-прайс для валюты, выбранной в src/lib/company.ts */
export const DEMO_PRICE_LIST: PriceList = DEMO_PRICE_LISTS[CURRENCY];
