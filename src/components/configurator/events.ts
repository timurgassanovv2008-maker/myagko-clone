import type { CategoryId } from "@/lib/pricing/catalog";

/** Выбор категории извне конфигуратора (например, из карточек услуг). */
export const CATEGORY_EVENT = "bliss:category";

export function requestCategory(id: CategoryId) {
  window.dispatchEvent(new CustomEvent<CategoryId>(CATEGORY_EVENT, { detail: id }));
}

/** «Изменить» в корзине: загрузить позицию в конфигуратор. */
export const EDIT_EVENT = "bliss:edit";

export function requestEdit(itemId: string) {
  window.dispatchEvent(new CustomEvent<string>(EDIT_EVENT, { detail: itemId }));
}
