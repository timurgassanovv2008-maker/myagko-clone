import { describe, expect, it } from "vitest";
import { addToCart, calculateQuote, orderItemSchema, type OrderItem } from "./calc";
import { DEMO_PRICE_LIST, DEMO_PRICE_LISTS, priceListSchema, type PriceList } from "./price-list";
import { CURRENCIES, formatMoney, type CurrencyCode } from "../currency";
import { CURRENCY } from "../company";

const P: PriceList = {
  ...DEMO_PRICE_LIST,
  variants: { ...DEMO_PRICE_LIST.variants, "sofa-3": 11000, "chair-seat": 1200, "mattress-double": 8000, armchair: 4555 },
  minOrder: 6000,
  heavySoilPercent: 30,
  mattressSecondSidePercent: 70,
  outOfTownFee: 2000,
};

const item = (x: Partial<OrderItem> & Pick<OrderItem, "category">): OrderItem => ({
  qty: 1,
  heavySoil: false,
  secondSide: false,
  ...x,
});

describe("calculateQuote — формула", () => {
  it("одна позиция без надбавок", () => {
    const q = calculateQuote([item({ category: "sofa", variant: "sofa-3" })], P, false);
    expect(q.lines[0]).toEqual({ known: true, base: 11000, surchargePercent: 0, amount: 11000 });
    expect(q.total).toBe(11000);
    expect(q.minOrderApplied).toBe(false);
  });

  it("количество умножает базу", () => {
    const q = calculateQuote([item({ category: "chair", variant: "chair-seat", qty: 6 })], P, false);
    expect(q.knownSubtotal).toBe(7200);
  });

  it("надбавки складываются, а не перемножаются", () => {
    // 8000 × (100 + 30 + 70) / 100 = 16000 (при перемножении было бы 8000×1.3×1.7 = 17680)
    const q = calculateQuote(
      [item({ category: "mattress", variant: "mattress-double", heavySoil: true, secondSide: true })],
      P,
      false,
    );
    expect(q.lines[0]).toMatchObject({ surchargePercent: 100, amount: 16000 });
  });

  it("округление до 10 по каждой позиции, половина вверх", () => {
    // 4555 → 4560 ; 4555 × 1.3 = 5921.5 → 5920
    expect(calculateQuote([item({ category: "armchair", variant: "armchair" })], P, false).lines[0]).toMatchObject({ amount: 4560 });
    expect(
      calculateQuote([item({ category: "armchair", variant: "armchair", heavySoil: true })], P, false).lines[0],
    ).toMatchObject({ amount: 5920 });
    const p2 = { ...P, variants: { ...P.variants, armchair: 4545 } };
    expect(calculateQuote([item({ category: "armchair", variant: "armchair" })], p2, false).lines[0]).toMatchObject({ amount: 4550 });
  });

  it("вторая сторона игнорируется не у матраса", () => {
    // схема такую позицию не пропустит, но и формула не должна добавлять процент
    const q = calculateQuote([item({ category: "sofa", variant: "sofa-3", secondSide: true })], P, false);
    expect(q.lines[0]).toMatchObject({ surchargePercent: 0 });
  });

  it("минимальный заказ относится только к чистке, выезд добавляется после", () => {
    const q = calculateQuote([item({ category: "chair", variant: "chair-seat", qty: 2 })], P, true);
    expect(q.knownSubtotal).toBe(2400);
    expect(q.minOrderApplied).toBe(true);
    expect(q.cleaning).toBe(6000);
    expect(q.outOfTown).toBe(2000);
    expect(q.total).toBe(8000);
  });

  it("смешанный заказ: известная сумма отдельно, «Другое» по фото", () => {
    const q = calculateQuote(
      [item({ category: "sofa", variant: "sofa-3" }), item({ category: "other", description: "пуф", qty: 2 })],
      P,
      false,
    );
    expect(q.lines[1]).toEqual({ known: false });
    expect(q.knownSubtotal).toBe(11000);
    expect(q.manualCount).toBe(2);
    expect(q.total).toBe(11000);
  });

  it("только «Другое»: итога нет, минимум не применяется, выезд виден отдельно", () => {
    const q = calculateQuote([item({ category: "other", description: "банкетка" })], P, true);
    expect(q.cleaning).toBeNull();
    expect(q.total).toBeNull();
    expect(q.minOrderApplied).toBe(false);
    expect(q.outOfTown).toBe(2000);
    expect(q.manualCount).toBe(1);
  });

  it("пустой заказ", () => {
    const q = calculateQuote([], P, false);
    expect(q.total).toBeNull();
    expect(q.manualCount).toBe(0);
  });
});

describe("orderItemSchema — проверка позиции", () => {
  it("принимает правильную позицию", () => {
    expect(orderItemSchema.safeParse({ category: "sofa", variant: "sofa-2", qty: 1 }).success).toBe(true);
  });
  it("вариант должен принадлежать категории", () => {
    expect(orderItemSchema.safeParse({ category: "sofa", variant: "armchair", qty: 1 }).success).toBe(false);
  });
  it("вторая сторона только у матраса", () => {
    expect(orderItemSchema.safeParse({ category: "chair", variant: "chair-seat", qty: 1, secondSide: true }).success).toBe(false);
    expect(orderItemSchema.safeParse({ category: "mattress", variant: "mattress-single", qty: 1, secondSide: true }).success).toBe(true);
  });
  it("«Другое» требует описания и не имеет варианта", () => {
    expect(orderItemSchema.safeParse({ category: "other", qty: 1 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ category: "other", qty: 1, description: "пуф" }).success).toBe(true);
    expect(orderItemSchema.safeParse({ category: "other", qty: 1, description: "пуф", variant: "sofa-2" }).success).toBe(false);
  });
  it("количество от 1 до 20, целое", () => {
    expect(orderItemSchema.safeParse({ category: "sofa", variant: "sofa-2", qty: 0 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ category: "sofa", variant: "sofa-2", qty: 21 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ category: "sofa", variant: "sofa-2", qty: 1.5 }).success).toBe(false);
  });
});

describe("корзина", () => {
  it("одинаковые позиции объединяются", () => {
    let cart: OrderItem[] = [];
    cart = addToCart(cart, item({ category: "sofa", variant: "sofa-2" }));
    cart = addToCart(cart, item({ category: "sofa", variant: "sofa-2", qty: 2 }));
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
  });
  it("разные настройки — отдельные позиции", () => {
    let cart: OrderItem[] = [];
    cart = addToCart(cart, item({ category: "sofa", variant: "sofa-2" }));
    cart = addToCart(cart, item({ category: "sofa", variant: "sofa-2", heavySoil: true }));
    cart = addToCart(cart, item({ category: "sofa", variant: "sofa-3" }));
    expect(cart).toHaveLength(3);
  });
  it("«Другое» не объединяется", () => {
    let cart: OrderItem[] = [];
    cart = addToCart(cart, item({ category: "other", description: "пуф" }));
    cart = addToCart(cart, item({ category: "other", description: "пуф" }));
    expect(cart).toHaveLength(2);
  });
  it("количество не превышает 20", () => {
    let cart: OrderItem[] = [item({ category: "chair", variant: "chair-seat", qty: 19 })];
    cart = addToCart(cart, item({ category: "chair", variant: "chair-seat", qty: 5 }));
    expect(cart[0].qty).toBe(20);
  });
});

describe("прайс и валюта", () => {
  it("демо-прайсы всех валют проходят проверку", () => {
    for (const code of Object.keys(CURRENCIES) as CurrencyCode[]) {
      expect(priceListSchema.safeParse(DEMO_PRICE_LISTS[code]).success, code).toBe(true);
    }
  });
  it("по умолчанию — тенге", () => {
    expect(CURRENCY).toBe("KZT");
    expect(DEMO_PRICE_LIST).toBe(DEMO_PRICE_LISTS.KZT);
  });
  it("суммы форматируются с разрядами и значком валюты", () => {
    expect(formatMoney(18000, "KZT")).toBe("18 000 ₸");
    expect(formatMoney(2500, "TRY")).toBe("2 500 ₺");
  });
  it("отрицательные цены и дробные проценты отклоняются", () => {
    expect(priceListSchema.safeParse({ ...DEMO_PRICE_LIST, minOrder: -1 }).success).toBe(false);
    expect(priceListSchema.safeParse({ ...DEMO_PRICE_LIST, heavySoilPercent: 12.5 }).success).toBe(false);
  });
});
