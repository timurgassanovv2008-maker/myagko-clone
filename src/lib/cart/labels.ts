import { CATEGORY_BY_ID, variantTitle } from "../pricing/catalog";
import type { OrderItem } from "../pricing/calc";

/** «Диван · 3 места», «Другое». */
export function itemTitle(item: Pick<OrderItem, "category" | "variant">): string {
  const cat = CATEGORY_BY_ID[item.category].title;
  return item.variant ? `${cat} · ${variantTitle(item.variant).toLowerCase()}` : cat;
}

/** Надбавки позиции словами. */
export function itemExtras(item: Pick<OrderItem, "heavySoil" | "secondSide">): string[] {
  const out: string[] = [];
  if (item.heavySoil) out.push("сильные загрязнения");
  if (item.secondSide) out.push("вторая сторона");
  return out;
}

/** plural(3, ["предмет", "предмета", "предметов"]) → «предмета». */
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

export const ITEMS: [string, string, string] = ["предмет", "предмета", "предметов"];
