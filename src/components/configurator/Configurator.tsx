"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId, type VariantId } from "@/lib/pricing/catalog";
import { MAX_QTY, isCategory } from "@/lib/pricing/calc";
import { estimateItem } from "@/lib/pricing/estimate";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { CHARACTERS } from "@/lib/characters";
import { CATEGORY_EVENT } from "./events";
import { Stage } from "./Stage";
import styles from "./Configurator.module.css";

type Params = { variant?: VariantId; qty: number; heavySoil: boolean; secondSide: boolean };

function initialParams(): Record<CategoryId, Params> {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.id, { variant: c.variants[0]?.id, qty: 1, heavySoil: false, secondSide: false }]),
  ) as Record<CategoryId, Params>;
}

type Props = {
  prices: PriceList;
  currency: CurrencyCode;
  /** Заголовок и текст первого экрана (серверная разметка) */
  children: ReactNode;
};

export function Configurator({ prices, currency, children }: Props) {
  const [category, setCategory] = useState<CategoryId>("sofa");
  const [params, setParams] = useState(initialParams);
  const id = useId();

  // Выбор из карточек услуг ниже по странице.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (typeof detail === "string" && isCategory(detail)) setCategory(detail);
    };
    window.addEventListener(CATEGORY_EVENT, onPick);
    return () => window.removeEventListener(CATEGORY_EVENT, onPick);
  }, []);

  const cat = CATEGORY_BY_ID[category];
  const p = params[category];
  const update = (patch: Partial<Params>) => setParams((all) => ({ ...all, [category]: { ...all[category], ...patch } }));

  const estimate = estimateItem(
    { category, variant: p.variant, qty: p.qty, heavySoil: p.heavySoil, secondSide: cat.hasSecondSide && p.secondSide },
    prices,
  );
  const money = (n: number) => formatMoney(n, currency);

  return (
    <div className={styles.root}>
      <div className={styles.intro}>{children}</div>

      <div className={styles.stageCol}>
        <Stage category={category} />
      </div>

      <form id="raschet" className={styles.panel} onSubmit={(e) => e.preventDefault()} aria-label="Расчёт стоимости">
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Что почистить</legend>
          <div className={styles.chips}>
            {CATEGORIES.map((c) => (
              <label key={c.id} className={styles.chip} data-checked={c.id === category}>
                <input
                  type="radio"
                  name={`${id}-category`}
                  value={c.id}
                  checked={c.id === category}
                  onChange={() => setCategory(c.id)}
                  className={styles.srOnly}
                />
                {c.title}
              </label>
            ))}
          </div>
        </fieldset>

        {cat.variants.length > 0 ? (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{CHARACTERS[category].variantLabel}</legend>
            <div className={styles.chips}>
              {cat.variants.map((v) => (
                <label key={v.id} className={styles.chip} data-checked={v.id === p.variant}>
                  <input
                    type="radio"
                    name={`${id}-variant-${category}`}
                    value={v.id}
                    checked={v.id === p.variant}
                    onChange={() => update({ variant: v.id })}
                    className={styles.srOnly}
                  />
                  {v.title}
                </label>
              ))}
            </div>
            <p className={styles.fine}>Модель на картинке одна для всех вариантов — вариант меняет только цену.</p>
          </fieldset>
        ) : (
          <p className={styles.otherNote}>
            Пуфы, банкетки, изголовья кровати, детские и автокресла. При оформлении опишите предмет и приложите фото —
            мастер назовёт цену.
          </p>
        )}

        <div className={styles.row}>
          <span className={styles.rowLabel} id={`${id}-qty`}>
            Количество
          </span>
          <div className={styles.stepper} role="group" aria-labelledby={`${id}-qty`}>
            <button
              type="button"
              onClick={() => update({ qty: Math.max(1, p.qty - 1) })}
              disabled={p.qty <= 1}
              aria-label="Меньше"
            >
              −
            </button>
            <output aria-live="polite">{p.qty}</output>
            <button
              type="button"
              onClick={() => update({ qty: Math.min(MAX_QTY, p.qty + 1) })}
              disabled={p.qty >= MAX_QTY}
              aria-label="Больше"
            >
              +
            </button>
          </div>
        </div>

        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={p.heavySoil}
            onChange={(e) => update({ heavySoil: e.target.checked })}
            className={styles.srOnly}
          />
          <span className={styles.track} aria-hidden="true" />
          <span className={styles.switchText}>
            Сильные загрязнения <span className={styles.plus}>+{prices.heavySoilPercent}%</span>
          </span>
        </label>

        {cat.hasSecondSide && (
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={p.secondSide}
              onChange={(e) => update({ secondSide: e.target.checked })}
              className={styles.srOnly}
            />
            <span className={styles.track} aria-hidden="true" />
            <span className={styles.switchText}>
              Почистить и вторую сторону <span className={styles.plus}>+{prices.mattressSecondSidePercent}%</span>
            </span>
          </label>
        )}

        <div className={styles.price} aria-live="polite">
          {estimate.kind === "price" ? (
            <>
              <span className={styles.priceLabel}>Примерно</span>
              <span className={styles.priceValue}>{money(estimate.amount)}</span>
              {(estimate.qty > 1 || estimate.surchargePercent > 0) && (
                <span className={styles.priceMath}>
                  {estimate.qty > 1 ? `${estimate.qty} × ${money(estimate.unitPrice)}` : money(estimate.unitPrice)}
                  {estimate.surchargePercent > 0 && ` + ${estimate.surchargePercent}% надбавки`}
                </span>
              )}
              {estimate.belowMinOrder && (
                <span className={styles.priceNote}>
                  Минимальный заказ — {money(estimate.minOrder)}. Если в заказе только это, итог будет{" "}
                  {money(estimate.minOrder)}.
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.priceLabel}>Стоимость</span>
              <span className={styles.priceValue}>По фото</span>
              <span className={styles.priceMath}>Мастер оценит по фотографиям и описанию.</span>
            </>
          )}
        </div>

        <p className={styles.fine}>
          Итоговую цену мастер подтвердит после разговора. Выезд за город +{money(prices.outOfTownFee)}. Онлайн-заявка
          скоро заработает.
        </p>
      </form>
    </div>
  );
}
