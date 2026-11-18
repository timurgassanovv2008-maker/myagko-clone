import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEMO_COMPANY } from "@/lib/company";
import { DEMO_PRICE_LIST } from "@/lib/pricing/price-list";
import { getDb } from "./db";
import { getCompany, getPriceList } from "./settings";

export const SETTINGS_TAG = "settings";

/**
 * Публичные настройки для страниц сайта: название, контакты, прайс.
 * Кешируются; кабинет сбрасывает кеш (updateTag) при сохранении.
 * Заявку сервер всё равно считает по свежему прайсу из базы.
 * Если база недоступна (например, на хостинге ещё не подключена) — витрина
 * работает на демо-значениях, а приём заявок честно вернёт ошибку.
 */
export async function getPublicSettings() {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  try {
    const db = await getDb();
    const [company, prices] = await Promise.all([getCompany(db), getPriceList(db)]);
    return { company, prices };
  } catch (e) {
    console.error("Настройки компании недоступны, показываем демо-значения:", e);
    return { company: DEMO_COMPANY, prices: DEMO_PRICE_LIST };
  }
}
