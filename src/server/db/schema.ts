import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { OrderItem, Quote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

/** Настройки компании (прайс, контакты, игра…) — ключ → JSON. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ORDER_STATUSES = ["new", "agreed", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Секрет приватной ссылки /z/<token>. */
    token: text("token").notNull().unique(),
    /** Ключ повтора: тот же ключ — та же заявка. */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").$type<OrderStatus>().notNull().default("new"),

    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    outOfTown: boolean("out_of_town").notNull().default(false),
    /** Пожелание клиента: YYYY-MM-DD или null. */
    wishDate: text("wish_date"),
    /** Пожелание клиента: id интервала времени или null. */
    wishTime: text("wish_time"),
    comment: text("comment").notNull().default(""),

    items: jsonb("items").$type<OrderItem[]>().notNull(),
    /** Условия на момент отправки — новый прайс их не меняет. */
    currency: text("currency").notNull(),
    priceSnapshot: jsonb("price_snapshot").$type<PriceList>().notNull(),
    quote: jsonb("quote").$type<Quote>().notNull(),

    /** Итоговая цена, согласованная владельцем. */
    finalPrice: integer("final_price"),
    /** Согласованное время выезда (ISO, с часовым поясом компании). */
    agreedAt: timestamp("agreed_at", { withTimezone: true }),
    /** Приватная заметка владельца — клиенту не показывается. */
    ownerNote: text("owner_note").notNull().default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_created_idx").on(t.createdAt), index("orders_status_idx").on(t.status)],
);

/** История заявки: создание, смена статуса, цены, времени. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/**
 * Фото. Загружаются до отправки заявки (order_id = null), при отправке
 * привязываются. Отдаются только через проверяющие маршруты.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_order_idx").on(t.orderId)],
);

/** Ограничение частоты запросов (окно фиксированной длины). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

/** Сессии владельца: хранится только хэш токена. */
export const adminSessions = pgTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
