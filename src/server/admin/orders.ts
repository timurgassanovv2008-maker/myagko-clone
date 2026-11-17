import "server-only";
import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES, orderEvents, orders, photos, type OrderStatus } from "../db/schema";
import type { Db } from "../db";
import { listOrderPhotos } from "../photos";

export type OrderFilter = { q?: string; status?: OrderStatus | "all" | "active" };

const LIST_LIMIT = 100;

export async function listOrders(db: Db, filter: OrderFilter) {
  const where: SQL[] = [];
  if (filter.status === "active") where.push(or(eq(orders.status, "new"), eq(orders.status, "agreed"))!);
  else if (filter.status && filter.status !== "all") where.push(eq(orders.status, filter.status));

  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    const digits = q.replace(/\D/g, "");
    const parts: SQL[] = [ilike(orders.name, like), ilike(orders.address, like), ilike(orders.comment, like)];
    if (digits.length >= 3) parts.push(ilike(orders.phone, `%${digits}%`));
    // Номер заявки (1000 + id)
    if (/^\d{4,9}$/.test(q)) parts.push(eq(orders.id, Number(q) - 1000));
    where.push(or(...parts)!);
  }

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
      items: orders.items,
      quote: orders.quote,
      currency: orders.currency,
      finalPrice: orders.finalPrice,
      agreedAt: orders.agreedAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(LIST_LIMIT + 1);
  return { rows: rows.slice(0, LIST_LIMIT), more: rows.length > LIST_LIMIT };
}

export async function countNew(db: Db): Promise<number> {
  const [r] = await db.select({ n: count() }).from(orders).where(eq(orders.status, "new"));
  return r?.n ?? 0;
}

export async function getAdminOrder(db: Db, id: number) {
  const row = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, id) });
  if (!row) return null;
  const [photoList, events] = await Promise.all([
    listOrderPhotos(db, id),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.at), asc(orderEvents.id)),
  ]);
  return { ...row, photos: photoList, events };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

export const orderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    finalPrice: z.number().int().min(0).max(100_000_000).nullable(),
    agreedAt: z.date().nullable(),
    ownerNote: z.string().max(4000, "Заметка до 4000 символов"),
  })
  .superRefine((u, ctx) => {
    if (u.status === "agreed") {
      if (u.finalPrice === null) ctx.addIssue({ code: "custom", path: ["finalPrice"], message: "Для «Согласована» укажите цену" });
      if (u.agreedAt === null) ctx.addIssue({ code: "custom", path: ["agreedAt"], message: "Для «Согласована» укажите время" });
    }
  });

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

/** Изменить заявку и записать в историю, что поменялось. */
export async function updateOrder(db: Db, id: number, u: OrderUpdate): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [cur] = await tx
      .select({ status: orders.status, finalPrice: orders.finalPrice, agreedAt: orders.agreedAt, ownerNote: orders.ownerNote })
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (!cur) return false;

    const events: { kind: string; data: Record<string, unknown> }[] = [];
    if (cur.finalPrice !== u.finalPrice) events.push({ kind: "price", data: { from: cur.finalPrice, to: u.finalPrice } });
    const curAt = cur.agreedAt?.toISOString() ?? null;
    const newAt = u.agreedAt?.toISOString() ?? null;
    if (curAt !== newAt) events.push({ kind: "time", data: { from: curAt, to: newAt } });
    if (cur.status !== u.status) events.push({ kind: "status", data: { from: cur.status, to: u.status } });
    if (cur.ownerNote !== u.ownerNote) events.push({ kind: "note", data: {} });
    if (events.length === 0) return true;

    await tx
      .update(orders)
      .set({ status: u.status, finalPrice: u.finalPrice, agreedAt: u.agreedAt, ownerNote: u.ownerNote, updatedAt: new Date() })
      .where(eq(orders.id, id));
    await tx.insert(orderEvents).values(events.map((e) => ({ orderId: id, ...e })));
    return true;
  });
}

/** Удалить заявку вместе с фото и историей. */
export async function deleteOrder(db: Db, id: number): Promise<{ photos: number } | null> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ n: count() }).from(photos).where(eq(photos.orderId, id));
    const deleted = await tx.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
    return deleted.length ? { photos: p?.n ?? 0 } : null;
  });
}
