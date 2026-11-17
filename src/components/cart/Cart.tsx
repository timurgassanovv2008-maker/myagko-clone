"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_QTY, calculateQuote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { removeItem, restoreItem, updateItem, totalQty, type Removed } from "@/lib/cart/cart";
import { ITEMS, itemExtras, itemTitle, plural } from "@/lib/cart/labels";
import { readCart, useCart, writeCart } from "@/lib/cart/store";
import { requestEdit } from "@/components/configurator/events";
import styles from "./Cart.module.css";

type Props = { prices: PriceList; currency: CurrencyCode };

const UNDO_MS = 7000;

export function Cart({ prices, currency }: Props) {
  const items = useCart();
  const [removed, setRemoved] = useState<Removed | null>(null);
  const undoTimer = useRef(0);
  const money = (n: number) => formatMoney(n, currency);
  const quote = calculateQuote(items, prices, false);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const remove = (id: string) => {
    const res = removeItem(readCart(), id);
    if (!res.removed) return;
    writeCart(res.items);
    setRemoved(res.removed);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setRemoved(null), UNDO_MS);
  };

  const undo = () => {
    if (!removed) return;
    writeCart(restoreItem(readCart(), removed));
    setRemoved(null);
    window.clearTimeout(undoTimer.current);
  };

  const setQty = (id: string, qty: number) => writeCart(updateItem(readCart(), id, { qty }));

  return (
    <section id="zakaz" className={styles.cart} aria-labelledby="zakaz-title">
      <h2 id="zakaz-title" className={styles.title}>
        Ваш заказ
        {items.length > 0 && (
          <span className={styles.count}>
            {totalQty(items)} {plural(totalQty(items), ITEMS)}
          </span>
        )}
      </h2>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>Пока пусто. Выберите мебель выше и нажмите «Добавить в заказ» — сюда можно собрать всё, что нужно почистить.</p>
          <a href="#raschet" className={styles.link}>
            Выбрать мебель ↑
          </a>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item, i) => {
              const line = quote.lines[i];
              const extras = itemExtras(item);
              const title = itemTitle(item);
              return (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemTitle}>{title}</span>
                    {item.description && <span className={styles.itemDesc}>«{item.description}»</span>}
                    {extras.length > 0 && <span className={styles.itemExtras}>+ {extras.join(", ")}</span>}
                  </div>

                  <div className={styles.qty} role="group" aria-label={`Количество: ${title}`}>
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty - 1)}
                      disabled={item.qty <= 1}
                      aria-label="Меньше"
                    >
                      −
                    </button>
                    <output>{item.qty}</output>
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty + 1)}
                      disabled={item.qty >= MAX_QTY}
                      aria-label="Больше"
                    >
                      +
                    </button>
                  </div>

                  <span className={styles.itemPrice}>{line?.known ? money(line.amount) : "По фото"}</span>

                  <div className={styles.itemActions}>
                    <button type="button" className={styles.textButton} onClick={() => requestEdit(item.id)}>
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => remove(item.id)}
                      aria-label={`Удалить: ${title}`}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={styles.summary} aria-live="polite">
            {quote.total === null ? (
              <>
                <div className={styles.totalRow}>
                  <span>Итог</span>
                  <strong>По фото</strong>
                </div>
                <p className={styles.fine}>
                  Мастер оценит {quote.manualCount} {plural(quote.manualCount, ITEMS)} по фото и описанию.
                </p>
              </>
            ) : (
              <>
                {quote.minOrderApplied && (
                  <div className={styles.row}>
                    <span>Чистка по прайсу</span>
                    <span>{money(quote.knownSubtotal)}</span>
                  </div>
                )}
                {quote.minOrderApplied && (
                  <div className={styles.row}>
                    <span>Минимальный заказ</span>
                    <span>{money(prices.minOrder)}</span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>{quote.manualCount > 0 ? "Известно" : "Итого примерно"}</span>
                  <strong>{money(quote.total)}</strong>
                </div>
                {quote.manualCount > 0 && (
                  <p className={styles.manual}>
                    + {quote.manualCount} {plural(quote.manualCount, ITEMS)} по фото — цену назовёт мастер
                  </p>
                )}
                {quote.minOrderApplied && (
                  <p className={styles.fine}>
                    Сумма меньше минимального заказа, поэтому за чистку — {money(prices.minOrder)}. Можно добавить ещё
                    мебель без доплаты до этой суммы.
                  </p>
                )}
              </>
            )}
            <p className={styles.fine}>
              Выезд за город +{money(prices.outOfTownFee)} — отметите при оформлении. Итоговую цену мастер подтвердит
              после разговора.
            </p>
          </div>

          <div className={styles.checkout}>
            <button type="button" className={styles.primary} disabled aria-describedby="zakaz-soon">
              Оформить заявку
            </button>
            <p id="zakaz-soon" className={styles.fine}>
              Онлайн-заявка скоро заработает. Заказ сохранится в этом браузере.
            </p>
            <a href="#raschet" className={styles.link}>
              Добавить ещё ↑
            </a>
          </div>
        </>
      )}

      <div className={styles.toast} data-show={removed !== null} role="status">
        {removed && (
          <>
            <span>Удалено: {itemTitle(removed.item)}</span>
            <button type="button" onClick={undo}>
              Вернуть
            </button>
          </>
        )}
      </div>
    </section>
  );
}
