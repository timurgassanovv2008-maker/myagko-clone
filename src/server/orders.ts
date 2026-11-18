import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { calculateQuote } from "@/lib/pricing/calc";
import { CURRENCY } from "@/lib/company";
import type { FieldErrors, OrderRequest } from "@/lib/order";
import type { Db } from "./db";
import { orderEvents, orders, photos } from "./db/schema";
import { getPriceList } from "./settings";
import { UPLOAD_TTL_MS, listOrderPhotos } from "./photos";

export class OrderInputError extends Error {
  constructor(public fieldErrors: FieldErrors) {
    super(Object.values(fieldErrors)[0] ?? "Проверьте заявку");
  }
}

export type CreatedOrder = { id: number; token: string; created: boolean };

const newToken = () => randomBytes(32).toString("base64url");

async function findByKey(db: Db, key: string): Promise<CreatedOrder | null> {
  const rows = await db
    .select({ id: orders.id, token: orders.token })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  return rows[0] ? { ...rows[0], created: false } : null;
}

/**
 * Принять заявку. Цена считается здесь заново по текущему прайсу, сумме из браузера не доверяем.
 * Повтор с тем же idempotencyKey возвращает ту же заявку, дубль не создаётся.
 */
export async function createOrder(db: Db, input: OrderRequest, now = new Date()): Promise<CreatedOrder> {
  const existing = await findByKey(db, input.idempotencyKey);
  if (existing) return existing;

  const prices = await getPriceList(db);
  const quote = calculateQuote(input.items, prices, input.customer.outOfTown);

  if (input.photoIds.length > 0) {
    const found = await db
      .select({ id: photos.id, orderId: photos.orderId, createdAt: photos.createdAt })
      .from(photos)
      .where(inArray(photos.id, input.photoIds));
    const fresh = found.filter((p) => p.orderId === null && now.getTime() - p.createdAt.getTime() < UPLOAD_TTL_MS);
    if (fresh.length !== input.photoIds.length) {
      throw new OrderInputError({ photoIds: "Часть фото не найдена или устарела — загрузите их ещё раз" });
    }
  }

  const c = input.customer;
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(orders)
      .values({
        token: newToken(),
        idempotencyKey: input.idempotencyKey,
        status: "new",
        name: c.name,
        phone: c.phone,
        address: c.address,
        outOfTown: c.outOfTown,
        wishDate: c.wishDate,
        wishTime: c.wishTime,
        comment: c.comment,
        items: input.items,
        currency: CURRENCY,
        priceSnapshot: prices,
        quote,
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id, token: orders.token });

    const row = inserted[0];
    if (!row) return null; // параллельный повтор уже создал заявку

    // Привязываем фото к заявке (не больше трёх — по одному запросу на фото).
    for (const [position, photoId] of input.photoIds.entries()) {
      const attached = await tx
        .update(photos)
        .set({ orderId: row.id, position })
        .where(and(eq(photos.id, photoId), isNull(photos.orderId)))
        .returning({ id: photos.id });
      if (attached.length !== 1) {
        throw new OrderInputError({ photoIds: "Часть фото не найдена — загрузите их ещё раз" });
      }
    }

    await tx.insert(orderEvents).values({ orderId: row.id, kind: "created", data: { total: quote.total } });
    return { ...row, created: true };
  });

  return result ?? (await findByKey(db, input.idempotencyKey))!;
}

/** Заявка для клиента по приватной ссылке. Без заметки владельца. */
export async function getPublicOrder(db: Db, token: string) {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      name: orders.name,
      phone: orders.phone,
      address: orders.address,
      outOfTown: orders.outOfTown,
      wishDate: orders.wishDate,
      wishTime: orders.wishTime,
      comment: orders.comment,
      items: orders.items,
      currency: orders.currency,
      priceSnapshot: orders.priceSnapshot,
      quote: orders.quote,
      finalPrice: orders.finalPrice,
      agreedAt: orders.agreedAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(eq(orders.token, token))
    .limit(1);
  const order = rows[0];
  if (!order) return null;
  const [photoList, events] = await Promise.all([
    listOrderPhotos(db, order.id),
    db
      .select({ at: orderEvents.at, kind: orderEvents.kind, data: orderEvents.data })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.at), asc(orderEvents.id)),
  ]);
  // Клиенту — только публичные события (без заметок владельца).
  const publicEvents = events
    .filter((e) => e.kind === "created" || e.kind === "status" || e.kind === "price" || e.kind === "time")
    .map((e) => ({ at: e.at, kind: e.kind, data: e.kind === "created" ? {} : e.data }));
  return { ...order, photos: photoList, events: publicEvents };
}

export type PublicOrder = NonNullable<Awaited<ReturnType<typeof getPublicOrder>>>;
