import type { CategoryId } from "@/lib/pricing/catalog";

/** Выбор категории извне конфигуратора (например, из карточек услуг). */
export const CATEGORY_EVENT = "bliss:category";

export function requestCategory(id: CategoryId) {
  window.dispatchEvent(new CustomEvent<CategoryId>(CATEGORY_EVENT, { detail: id }));
}
