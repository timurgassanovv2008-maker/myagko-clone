"use client";

import Link from "next/link";
import { CATEGORY_BY_ID, type VariantId } from "@/lib/pricing/catalog";
import { calculateQuote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { cart, useCart, type CartLine } from "@/lib/client/cart-store";
import { showToast } from "@/lib/client/toast";
import { FurniturePoster } from "@/components/FurniturePoster";
import { QtyStepper } from "@/components/QtyStepper";
import { QuoteSummary } from "@/components/QuoteSummary";
import { RecentOrders } from "@/components/RecentOrders";
import styles from "./cart.module.css";

type Props = { prices: PriceList; currency: CurrencyCode };

export function CartView({ prices, currency }: Props) {
  const { hydrated, lines } = useCart();
  const money = (n: number) => formatMoney(n, currency);

  if (!hydrated) {
    return (
      <div className={styles.page} aria-busy="true">
        <h1 className={styles.h1}>Корзина</h1>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Корзина</h1>
        <div className={`card ${styles.empty}`}>
          <FurniturePoster category="sofa" className={styles.emptyArt} title="" />
          <p className={styles.emptyTitle}>Пока пусто</p>
          <p className={styles.emptyText}>Выберите диван, кресло, матрас или стулья — и сразу увидите примерную стоимость.</p>
          <Link href="/#vybor" className="btn btn-primary btn-lg">
            Выбрать мебель
          </Link>
        </div>
        <RecentOrders />
      </div>
    );
  }

  const quote = calculateQuote(lines, prices, false);

  function remove(line: CartLine) {
    const undo = cart.remove(line.id);
    showToast(`${CATEGORY_BY_ID[line.category].title} — удалено`, { label: "Вернуть", run: undo }, 6000);
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.h1}>Корзина</h1>
        <Link href="/#vybor" className="btn btn-ghost">
          + Добавить ещё
        </Link>
      </div>

      <div className={styles.layout}>
        <ul className={styles.lines}>
          {lines.map((line, i) => {
            const cat = CATEGORY_BY_ID[line.category];
            const result = quote.lines[i];
            return (
              <li key={line.id} className={`card ${styles.line}`}>
                <FurniturePoster category={line.category} className={styles.thumb} />
                <div className={styles.lineBody}>
                  <div className={styles.lineHead}>
                    <span className={styles.lineTitle}>{cat.title}</span>
                    <span className={`${styles.linePrice} tabular`}>
                      {result.known ? money(result.amount) : "По фото"}
                    </span>
                  </div>

                  {cat.variants.length > 0 ? (
                    <label className={styles.inline}>
                      <span className="visually-hidden">Вариант</span>
                      <select
                        className={`input ${styles.select}`}
                        value={line.variant}
                        onChange={(e) => cart.update(line.id, { variant: e.target.value as VariantId })}
                      >
                        {cat.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className={styles.inline}>
                      <span className="visually-hidden">Описание</span>
                      <textarea
                        className="input"
                        rows={2}
                        maxLength={500}
                        defaultValue={line.description}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v.length >= 3) cart.update(line.id, { description: v });
                          else e.target.value = line.description ?? "";
                        }}
                      />
                    </label>
                  )}

                  <div className={styles.options}>
                    <label className={styles.opt}>
                      <input
                        type="checkbox"
                        checked={line.heavySoil}
                        onChange={(e) => cart.update(line.id, { heavySoil: e.target.checked })}
                      />
                      Сильные загрязнения
                    </label>
                    {cat.hasSecondSide && (
                      <label className={styles.opt}>
                        <input
                          type="checkbox"
                          checked={line.secondSide}
                          onChange={(e) => cart.update(line.id, { secondSide: e.target.checked })}
                        />
                        Вторая сторона
                      </label>
                    )}
                  </div>

                  <div className={styles.lineFoot}>
                    <QtyStepper size="sm" value={line.qty} onChange={(qty) => cart.update(line.id, { qty })} />
                    <button type="button" className="btn btn-ghost" onClick={() => remove(line)}>
                      Удалить
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className={`card ${styles.summary}`}>
          <h2 className={styles.h2}>Итого</h2>
          <QuoteSummary quote={quote} currency={currency} minOrder={prices.minOrder} />
          <p className={styles.fine}>
            Выезд за город (+{money(prices.outOfTownFee)}) отметите при оформлении. Это предварительный расчёт — итоговую
            цену мастер подтвердит после разговора.
          </p>
          <Link href="/oformlenie" className="btn btn-primary btn-lg btn-block">
            Оформить заявку
          </Link>
        </aside>
      </div>
    </div>
  );
}
