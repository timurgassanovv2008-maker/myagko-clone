import { CATEGORY_BY_ID, variantTitle } from "./pricing/catalog";
import type { OrderItem } from "./pricing/calc";

/** «Диван, 3 места × 2 · Матрас, односпальный» */
export function itemsSummary(items: OrderItem[]): string {
  return items
    .map((it) => {
      let s = CATEGORY_BY_ID[it.category].title;
      if (it.variant) s += `, ${variantTitle(it.variant).toLowerCase()}`;
      if (it.category === "other" && it.description) s += ` (${it.description})`;
      if (it.qty > 1) s += ` × ${it.qty}`;
      return s;
    })
    .join(" · ");
}
