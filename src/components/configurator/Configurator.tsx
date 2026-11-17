"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId, type VariantId } from "@/lib/pricing/catalog";
import { MAX_ITEMS, MAX_QTY, isCategory, orderItemSchema, type OrderItem } from "@/lib/pricing/calc";
import { estimateItem } from "@/lib/pricing/estimate";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { CHARACTERS } from "@/lib/characters";
import { addItem, updateItem } from "@/lib/cart/cart";
import { itemTitle } from "@/lib/cart/labels";
import { newItemId, readCart, writeCart } from "@/lib/cart/store";
import { CATEGORY_EVENT, EDIT_EVENT } from "./events";
import { Stage } from "./Stage";
import styles from "./Configurator.module.css";

type Params = { variant?: VariantId; qty: number; heavySoil: boolean; secondSide: boolean; description: string };

const defaults = (c: (typeof CATEGORIES)[number]): Params => ({
  variant: c.variants[0]?.id,
  qty: 1,
  heavySoil: false,
  secondSide: false,
  description: "",
});

function initialParams(): Record<CategoryId, Params> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, defaults(c)])) as Record<CategoryId, Params>;
}

type Notice = { text: string; tone: "ok" | "warn" };

type Props = {
  prices: PriceList;
  currency: CurrencyCode;
  /** Заголовок и текст первого экрана (серверная разметка) */
  children: ReactNode;
};

export function Configurator({ prices, currency, children }: Props) {
  const [category, setCategory] = useState<CategoryId>("sofa");
  const [params, setParams] = useState(initialParams);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [descError, setDescError] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef(0);
  const panelRef = useRef<HTMLFormElement>(null);
  const id = useId();

  // Выбор из карточек услуг и «Изменить» в корзине.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (typeof detail === "string" && isCategory(detail)) setCategory(detail);
    };
    const onEdit = (e: Event) => {
      const itemId = (e as CustomEvent<unknown>).detail;
      const item = readCart().find((c) => c.id === itemId);
      if (!item) return;
      setCategory(item.category);
      setParams((all) => ({
        ...all,
        [item.category]: {
          variant: item.variant,
          qty: item.qty,
          heavySoil: item.heavySoil,
          secondSide: item.secondSide,
          description: item.description ?? "",
        },
      }));
      setEditingId(item.id);
      setDescError(false);
      setNotice(null);
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(CATEGORY_EVENT, onPick);
    window.addEventListener(EDIT_EVENT, onEdit);
    return () => {
      window.removeEventListener(CATEGORY_EVENT, onPick);
      window.removeEventListener(EDIT_EVENT, onEdit);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const cat = CATEGORY_BY_ID[category];
  const p = params[category];
  const update = (patch: Partial<Params>) => setParams((all) => ({ ...all, [category]: { ...all[category], ...patch } }));

  const say = (text: string, tone: Notice["tone"] = "ok") => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  };

  const currentItem = (): OrderItem => ({
    category,
    variant: p.variant,
    qty: p.qty,
    heavySoil: p.heavySoil,
    secondSide: cat.hasSecondSide && p.secondSide,
    ...(category === "other" ? { description: p.description.trim() } : {}),
  });

  const submit = () => {
    const item = currentItem();
    if (!orderItemSchema.safeParse(item).success) {
      // единственная ошибка, которую можно допустить в этой форме, — пустое описание у «Другое»
      setDescError(true);
      document.getElementById(`${id}-desc`)?.focus();
      return;
    }
    const cart = readCart();
    if (editingId && cart.some((c) => c.id === editingId)) {
      writeCart(updateItem(cart, editingId, item));
      setEditingId(null);
      say("Позиция изменена.");
      return;
    }
    setEditingId(null);
    const result = addItem(cart, { ...item, id: newItemId() });
    if (!result.ok) {
      say(`В заказе уже ${MAX_ITEMS} позиций — больше добавить нельзя.`, "warn");
      return;
    }
    writeCart(result.items);
    if (category === "other") update({ description: "" });
    if (result.capped) say(`В одной позиции не больше ${MAX_QTY} шт. — количество ограничено.`, "warn");
    else if (result.merged) say(`${itemTitle(item)}: количество в заказе увеличено.`);
    else say(`Добавлено: ${itemTitle(item)}.`);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNotice(null);
  };

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

      <form
        id="raschet"
        ref={panelRef}
        className={styles.panel}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label="Расчёт стоимости"
        noValidate
      >
        {editingId && (
          <p className={styles.editing}>
            Вы меняете позицию заказа. Сохраните изменения или отмените их.
          </p>
        )}

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
          <div className={styles.group}>
            <label className={styles.legend} htmlFor={`${id}-desc`}>
              Что это за предмет?
            </label>
            <textarea
              id={`${id}-desc`}
              className={styles.textarea}
              rows={2}
              maxLength={500}
              value={p.description}
              placeholder="Например: пуф, банкетка, изголовье кровати, автокресло"
              aria-invalid={descError}
              aria-describedby={`${id}-desc-hint`}
              onChange={(e) => {
                update({ description: e.target.value });
                if (descError && e.target.value.trim().length >= 3) setDescError(false);
              }}
            />
            <p id={`${id}-desc-hint`} className={descError ? styles.error : styles.fine}>
              {descError
                ? "Опишите предмет хотя бы парой слов — так мастер поймёт, что чистить."
                : "Фото приложите при оформлении — по ним мастер назовёт цену."}
            </p>
          </div>
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

        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            {editingId ? "Сохранить изменения" : "Добавить в заказ"}
          </button>
          {editingId && (
            <button type="button" className={styles.secondary} onClick={cancelEdit}>
              Отмена
            </button>
          )}
        </div>
        <p className={styles.notice} data-tone={notice?.tone} role="status">
          {notice && (
            <>
              {notice.text} <a href="#zakaz">К заказу ↓</a>
            </>
          )}
        </p>

        <p className={styles.fine}>
          Итоговую цену мастер подтвердит после разговора. Выезд за город +{money(prices.outOfTownFee)}.
        </p>
      </form>
    </div>
  );
}
