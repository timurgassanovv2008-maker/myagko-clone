// Каталог мебели: категории и варианты.
// Цены здесь НЕ хранятся — они в настройках компании (PriceList).

export const CATEGORY_IDS = ["sofa", "armchair", "mattress", "chair", "other"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const VARIANT_IDS = [
  "sofa-2",
  "sofa-3",
  "sofa-corner",
  "armchair",
  "armchair-recliner",
  "mattress-single",
  "mattress-double",
  "chair-seat",
  "chair-seat-back",
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export type Category = {
  id: CategoryId;
  title: string;
  /** Варианты с ценой. У «Другое» вариантов нет — цена «По фото». */
  variants: { id: VariantId; title: string }[];
  /** Есть ли у категории опция «вторая сторона» (только матрас). */
  hasSecondSide: boolean;
};

export const CATEGORIES: Category[] = [
  {
    id: "sofa",
    title: "Диван",
    variants: [
      { id: "sofa-2", title: "2 места" },
      { id: "sofa-3", title: "3 места" },
      { id: "sofa-corner", title: "Угловой" },
    ],
    hasSecondSide: false,
  },
  {
    id: "armchair",
    title: "Кресло",
    variants: [
      { id: "armchair", title: "Обычное" },
      { id: "armchair-recliner", title: "Реклайнер" },
    ],
    hasSecondSide: false,
  },
  {
    id: "mattress",
    title: "Матрас",
    variants: [
      { id: "mattress-single", title: "Односпальный" },
      { id: "mattress-double", title: "Двуспальный" },
    ],
    hasSecondSide: true,
  },
  {
    id: "chair",
    title: "Стул",
    variants: [
      { id: "chair-seat", title: "Сиденье" },
      { id: "chair-seat-back", title: "Сиденье и спинка" },
    ],
    hasSecondSide: false,
  },
  {
    id: "other",
    title: "Другое",
    variants: [],
    hasSecondSide: false,
  },
];

export const CATEGORY_BY_ID: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export function categoryOfVariant(variant: VariantId): CategoryId {
  const found = CATEGORIES.find((c) => c.variants.some((v) => v.id === variant));
  if (!found) throw new Error(`Неизвестный вариант: ${variant}`);
  return found.id;
}

export function variantTitle(variant: VariantId): string {
  for (const c of CATEGORIES) {
    const v = c.variants.find((x) => x.id === variant);
    if (v) return v.title;
  }
  return variant;
}
