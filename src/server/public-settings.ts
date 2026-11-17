import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "./db";
import { getCompany, getPriceList } from "./settings";

export const SETTINGS_TAG = "settings";

/**
 * Публичные настройки для страниц сайта: название, контакты, прайс.
 * Кешируются; кабинет сбрасывает кеш (updateTag) при сохранении.
 * Заявку сервер всё равно считает по свежему прайсу из базы.
 */
export async function getPublicSettings() {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  const db = await getDb();
  const [company, prices] = await Promise.all([getCompany(db), getPriceList(db)]);
  return { company, prices };
}
