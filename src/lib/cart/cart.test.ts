import { describe, expect, it } from "vitest";
import { MAX_ITEMS, MAX_QTY } from "../pricing/calc";
import {
  addItem,
  parseStoredCart,
  removeItem,
  restoreItem,
  serializeCart,
  totalQty,
  updateItem,
  type CartItem,
} from "./cart";
import { itemExtras, itemTitle, plural, ITEMS } from "./labels";

let n = 0;
const item = (x: Partial<CartItem> & Pick<CartItem, "category">): CartItem => ({
  id: `id${++n}`,
  qty: 1,
  heavySoil: false,
  secondSide: false,
  ...x,
});
const sofa = (x: Partial<CartItem> = {}) => item({ category: "sofa", variant: "sofa-3", ...x });
const other = (description = "пуф") => item({ category: "other", description });

function add(items: CartItem[], it: CartItem) {
  const r = addItem(items, it);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe("addItem", () => {
  it("одинаковые позиции объединяются, количество складывается", () => {
    const a = add([], sofa({ qty: 1 })).items;
    const r = add(a, sofa({ qty: 2 }));
    expect(r.merged).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].qty).toBe(3);
    expect(r.items[0].id).toBe(a[0].id);
  });

  it("разные настройки — отдельные позиции", () => {
    let items = add([], sofa()).items;
    items = add(items, sofa({ heavySoil: true })).items;
    items = add(items, sofa({ variant: "sofa-2" })).items;
    expect(items).toHaveLength(3);
  });

  it("«Другое» никогда не объединяется", () => {
    const items = add(add([], other("пуф")).items, other("пуф")).items;
    expect(items).toHaveLength(2);
  });

  it("количество в позиции не больше максимума", () => {
    const r = add(add([], sofa({ qty: MAX_QTY - 1 })).items, sofa({ qty: 5 }));
    expect(r.items[0].qty).toBe(MAX_QTY);
    expect(r.capped).toBe(true);
  });

  it("не больше MAX_ITEMS позиций", () => {
    let items: CartItem[] = [];
    for (let i = 0; i < MAX_ITEMS; i++) items = add(items, other(`предмет ${i}`)).items;
    expect(addItem(items, other())).toEqual({ ok: false, reason: "too-many-items" });
    // объединение в существующую позицию при этом разрешено
    const withSofa = [...items.slice(0, -1), sofa()];
    expect(addItem(withSofa, sofa()).ok).toBe(true);
  });
});

describe("updateItem", () => {
  it("меняет количество и параметры", () => {
    const items = add([], sofa()).items;
    const next = updateItem(items, items[0].id, { qty: 4, heavySoil: true });
    expect(next[0]).toMatchObject({ qty: 4, heavySoil: true, id: items[0].id });
  });

  it("если правка сделала позиции одинаковыми — объединяет", () => {
    let items = add([], sofa()).items;
    items = add(items, sofa({ heavySoil: true, qty: 2 })).items;
    const next = updateItem(items, items[1].id, { heavySoil: false });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: items[0].id, qty: 3, heavySoil: false });
  });

  it("смена категории с «Другое» убирает описание", () => {
    const items = add([], other("банкетка")).items;
    const next = updateItem(items, items[0].id, { category: "chair", variant: "chair-seat" });
    expect(next[0].description).toBeUndefined();
  });
});

describe("removeItem / restoreItem", () => {
  it("удаление с отменой возвращает позицию на место", () => {
    let items = add([], sofa()).items;
    items = add(items, other()).items;
    items = add(items, sofa({ variant: "sofa-2" })).items;
    const { items: after, removed } = removeItem(items, items[1].id);
    expect(after).toHaveLength(2);
    expect(restoreItem(after, removed!)).toEqual(items);
  });

  it("если такую же позицию успели добавить заново — отмена объединяет", () => {
    const items = add([], sofa({ qty: 2 })).items;
    const { items: empty, removed } = removeItem(items, items[0].id);
    const again = add(empty, sofa({ qty: 1 })).items;
    const restored = restoreItem(again, removed!);
    expect(restored).toHaveLength(1);
    expect(restored[0].qty).toBe(3);
  });

  it("totalQty считает предметы, а не позиции", () => {
    expect(totalQty([sofa({ qty: 2 }), other()])).toBe(3);
  });
});

describe("parseStoredCart", () => {
  it("читает то, что сохранили", () => {
    const items = [sofa({ qty: 2 }), other("изголовье")];
    expect(parseStoredCart(serializeCart(items))).toEqual(items);
  });

  it("испорченные данные не ломают сайт", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("{не json")).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ items: "x" }))).toEqual([]);
  });

  it("отбрасывает неверные позиции и дубли id, оставляя верные", () => {
    const good = sofa();
    const raw = JSON.stringify({
      v: 1,
      items: [good, { ...good }, { id: "x", category: "sofa", qty: 999 }, { id: "y", category: "other" }, "мусор", null],
    });
    expect(parseStoredCart(raw)).toEqual([good]);
  });
});


describe("подписи", () => {
  it("название позиции и надбавки", () => {
    expect(itemTitle({ category: "sofa", variant: "sofa-corner" })).toBe("Диван · угловой");
    expect(itemTitle({ category: "other" })).toBe("Другое");
    expect(itemExtras({ heavySoil: true, secondSide: true })).toEqual(["сильные загрязнения", "вторая сторона"]);
  });

  it("склонение «предмет»", () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((k) => `${k} ${plural(k, ITEMS)}`)).toEqual([
      "1 предмет",
      "2 предмета",
      "5 предметов",
      "11 предметов",
      "12 предметов",
      "21 предмет",
      "22 предмета",
      "25 предметов",
      "111 предметов",
    ]);
  });
});
