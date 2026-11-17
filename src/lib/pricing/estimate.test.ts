import { describe, expect, it } from "vitest";
import { estimateItem } from "./estimate";
import type { OrderItem } from "./calc";
import { DEMO_PRICE_LIST, type PriceList } from "./price-list";

const P: PriceList = {
  ...DEMO_PRICE_LIST,
  variants: { ...DEMO_PRICE_LIST.variants, "sofa-3": 24000, "mattress-double": 18000, "chair-seat": 2500 },
  minOrder: 15000,
  heavySoilPercent: 30,
  mattressSecondSidePercent: 70,
};

const item = (x: Partial<OrderItem> & Pick<OrderItem, "category">): OrderItem => ({
  qty: 1,
  heavySoil: false,
  secondSide: false,
  ...x,
});

describe("estimateItem — подсказка цены при выборе", () => {
  it("цена варианта × количество", () => {
    expect(estimateItem(item({ category: "sofa", variant: "sofa-3", qty: 2 }), P)).toEqual({
      kind: "price",
      amount: 48000,
      unitPrice: 24000,
      qty: 2,
      surchargePercent: 0,
      belowMinOrder: false,
      minOrder: 15000,
    });
  });

  it("надбавки складываются, как в заявке", () => {
    const e = estimateItem(item({ category: "mattress", variant: "mattress-double", heavySoil: true, secondSide: true }), P);
    // 18000 × (100 + 30 + 70) / 100
    expect(e).toMatchObject({ kind: "price", amount: 36000, surchargePercent: 100 });
  });

  it("отмечает позицию меньше минимального заказа", () => {
    expect(estimateItem(item({ category: "chair", variant: "chair-seat", qty: 2 }), P)).toMatchObject({
      amount: 5000,
      belowMinOrder: true,
    });
  });

  it("«Другое» — по фото, не ноль", () => {
    expect(estimateItem(item({ category: "other", qty: 3, description: "пуф" }), P)).toEqual({ kind: "photo", qty: 3 });
  });
});
