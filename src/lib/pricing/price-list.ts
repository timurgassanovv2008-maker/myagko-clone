import { z } from "zod";
import { VARIANT_IDS, type VariantId } from "./catalog";

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

/** Демо-прайс. Владелец заменит его в «Тарифах». */
export const DEMO_PRICE_LIST: PriceList = {
  variants: {
    "sofa-2": 9000,
    "sofa-3": 11000,
    "sofa-corner": 14000,
    armchair: 4500,
    "armchair-recliner": 6000,
    "mattress-single": 6000,
    "mattress-double": 8000,
    "chair-seat": 1200,
    "chair-seat-back": 1800,
  },
  minOrder: 6000,
  heavySoilPercent: 30,
  mattressSecondSidePercent: 70,
  outOfTownFee: 2000,
};
