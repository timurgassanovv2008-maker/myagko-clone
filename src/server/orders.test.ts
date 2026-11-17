import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { connectPglite, type Db } from "./db";
import { orderEvents, orders, photos } from "./db/schema";
import { createOrder, getPublicOrder, OrderInputError } from "./orders";
import { processImage, saveUpload, sniffFormat, getOrderPhotoByToken, PhotoError } from "./photos";
import { getPriceList, savePriceList } from "./settings";
import { hit } from "./rate-limit";
import { orderRequestSchema, type OrderRequestInput } from "@/lib/order";
import { DEMO_PRICE_LIST } from "@/lib/pricing/price-list";

let db: Db;
beforeAll(async () => {
  db = await connectPglite("memory://");
});

let n = 0;
const key = () => `test-key-${++n}-${"x".repeat(16)}`;

function request(over: Partial<OrderRequestInput> = {}): OrderRequestInput {
  return {
    idempotencyKey: key(),
    items: [{ category: "sofa", variant: "sofa-3", qty: 1 }],
    customer: { name: "Тест Тестов", phone: "+7 700 000-00-00", address: "ул. Вымышленная, 1", outOfTown: false },
    consent: true,
    photoIds: [],
    ...over,
  };
}
const parse = (r: OrderRequestInput) => orderRequestSchema.parse(r);

async function pngBytes(w = 40, h = 30) {
  return new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: "#c33" } }).png().toBuffer());
}

describe("приём заявки", () => {
  it("сервер считает цену сам и сохраняет снимок прайса", async () => {
    const res = await createOrder(db, parse(request()));
    expect(res.created).toBe(true);
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [row] = await db.select().from(orders).where(eq(orders.id, res.id));
    expect(row.quote.total).toBe(DEMO_PRICE_LIST.variants["sofa-3"]);
    expect(row.priceSnapshot).toEqual(DEMO_PRICE_LIST);
    expect(row.status).toBe("new");
    expect(row.phone).toBe("+77000000000");
  });

  it("повтор с тем же ключом не создаёт дубль", async () => {
    const r = request();
    const a = await createOrder(db, parse(r));
    const b = await createOrder(db, parse(r));
    const [c, d] = await Promise.all([createOrder(db, parse(r)), createOrder(db, parse(r))]);
    expect(b).toEqual({ ...a, created: false });
    expect(c.token).toBe(a.token);
    expect(d.token).toBe(a.token);
    const rows = await db.select().from(orders).where(eq(orders.idempotencyKey, r.idempotencyKey));
    expect(rows).toHaveLength(1);
  });

  it("новый прайс не меняет старую заявку", async () => {
    const res = await createOrder(db, parse(request()));
    await savePriceList(db, { ...DEMO_PRICE_LIST, variants: { ...DEMO_PRICE_LIST.variants, "sofa-3": 99990 } });
    expect((await getPriceList(db)).variants["sofa-3"]).toBe(99990);
    const order = await getPublicOrder(db, res.token);
    expect(order?.quote.total).toBe(DEMO_PRICE_LIST.variants["sofa-3"]);
    const fresh = await createOrder(db, parse(request()));
    expect((await getPublicOrder(db, fresh.token))?.quote.total).toBe(99990);
    await savePriceList(db, DEMO_PRICE_LIST);
  });

  it("смешанный заказ: известная сумма и предметы по фото", async () => {
    const photo = await saveUpload(db, await processImage(await pngBytes()));
    const res = await createOrder(
      db,
      parse(
        request({
          items: [
            { category: "chair", variant: "chair-seat", qty: 2 },
            { category: "other", qty: 1, description: "Пуф круглый" },
          ],
          customer: { name: "Тест", phone: "87000000000", address: "ул. Вымышленная, 2", outOfTown: true },
          photoIds: [photo.id],
        }),
      ),
    );
    const order = (await getPublicOrder(db, res.token))!;
    expect(order.quote.minOrderApplied).toBe(true);
    expect(order.quote.cleaning).toBe(DEMO_PRICE_LIST.minOrder);
    expect(order.quote.outOfTown).toBe(DEMO_PRICE_LIST.outOfTownFee);
    expect(order.quote.manualCount).toBe(1);
    expect(order.photos).toHaveLength(1);
  });

  it("«Другое» без фото не принимается", () => {
    const r = orderRequestSchema.safeParse(request({ items: [{ category: "other", qty: 1, description: "Пуф" }] }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["photoIds"]);
  });

  it("время без даты не принимается", () => {
    const r = orderRequestSchema.safeParse(
      request({ customer: { name: "Тест", phone: "87000000000", address: "ул. Вымышленная, 2", wishTime: "09-12" } }),
    );
    expect(r.success).toBe(false);
  });

  it("чужое или уже прикреплённое фото нельзя прикрепить", async () => {
    const photo = await saveUpload(db, await processImage(await pngBytes()));
    await createOrder(db, parse(request({ photoIds: [photo.id] })));
    await expect(createOrder(db, parse(request({ photoIds: [photo.id] })))).rejects.toBeInstanceOf(OrderInputError);
    await expect(
      createOrder(db, parse(request({ photoIds: ["00000000-0000-4000-8000-000000000000"] }))),
    ).rejects.toBeInstanceOf(OrderInputError);
  });

  it("история: событие создания", async () => {
    const res = await createOrder(db, parse(request()));
    const ev = await db.select().from(orderEvents).where(eq(orderEvents.orderId, res.id));
    expect(ev.map((e) => e.kind)).toEqual(["created"]);
  });
});

describe("приватная ссылка", () => {
  it("по неверному токену заявки нет; заметка владельца не отдаётся", async () => {
    const res = await createOrder(db, parse(request()));
    await db.update(orders).set({ ownerNote: "секрет" }).where(eq(orders.id, res.id));
    expect(await getPublicOrder(db, "A".repeat(43))).toBeNull();
    const order = await getPublicOrder(db, res.token);
    expect(order).not.toBeNull();
    expect(JSON.stringify(order)).not.toContain("секрет");
  });

  it("фото открывается только с токеном своей заявки", async () => {
    const photo = await saveUpload(db, await processImage(await pngBytes()));
    const mine = await createOrder(db, parse(request({ photoIds: [photo.id] })));
    const other = await createOrder(db, parse(request()));
    expect(await getOrderPhotoByToken(db, mine.token, photo.id)).not.toBeNull();
    expect(await getOrderPhotoByToken(db, other.token, photo.id)).toBeNull();
  });
});

describe("фото", () => {
  it("формат определяется по содержимому", async () => {
    expect(sniffFormat(await pngBytes())).toBe("png");
    expect(sniffFormat(new Uint8Array(await sharp(await pngBytes()).jpeg().toBuffer()))).toBe("jpeg");
    expect(sniffFormat(new Uint8Array(await sharp(await pngBytes()).webp().toBuffer()))).toBe("webp");
    expect(sniffFormat(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    const gif = new Uint8Array(await sharp(await pngBytes()).gif().toBuffer());
    expect(sniffFormat(gif)).toBeNull();
  });

  it("большое фото ужимается до 1600 px и сохраняется в WebP", async () => {
    const img = await processImage(await pngBytes(3200, 1000));
    expect(img.width).toBe(1600);
    expect(img.height).toBe(500);
    expect(sniffFormat(img.data)).toBe("webp");
  });

  it("подделка под PNG отклоняется", async () => {
    const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
    await expect(processImage(fake)).rejects.toBeInstanceOf(PhotoError);
  });
});

describe("ограничение частоты", () => {
  it("после лимита запросы отклоняются", async () => {
    const limit = { name: "t", max: 3, windowSec: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit(db, limit, "1.2.3.4"));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await hit(db, limit, "5.6.7.8")).toBe(true);
  });
});

void photos;
