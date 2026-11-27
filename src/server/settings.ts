import "server-only";
import { eq } from "drizzle-orm";
import { CURRENCY, DEMO_COMPANY, type Company } from "@/lib/company";
import { DEMO_PRICE_LISTS, priceListSchema, type PriceList } from "@/lib/pricing/price-list";
import type { Db } from "./db";
import { settings } from "./db/schema";

// Настройки хранятся в таблице settings. Пока владелец ничего не менял — действуют демо-значения.
// Прайс хранится отдельно для каждой валюты: смена CURRENCY в коде не смешает валюты.

const priceKey = () => `prices:${CURRENCY}`;

async function readSetting(db: Db, key: string): Promise<unknown> {
  const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value;
}

async function writeSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getPriceList(db: Db): Promise<PriceList> {
  const parsed = priceListSchema.safeParse(await readSetting(db, priceKey()));
  return parsed.success ? parsed.data : DEMO_PRICE_LISTS[CURRENCY];
}

export async function savePriceList(db: Db, prices: PriceList): Promise<void> {
  await writeSetting(db, priceKey(), priceListSchema.parse(prices));
}

export async function getCompany(db: Db): Promise<Company> {
  const stored = await readSetting(db, "company");
  const merged = { ...DEMO_COMPANY, ...(stored && typeof stored === "object" ? stored : {}) } as Company;
  return { ...merged, currency: CURRENCY };
}

export async function saveCompany(db: Db, company: Omit<Company, "currency">): Promise<void> {
  await writeSetting(db, "company", company);
}

export { readSetting, writeSetting };
