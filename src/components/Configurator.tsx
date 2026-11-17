"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId, type VariantId } from "@/lib/pricing/catalog";
import { calculateQuote, type OrderItem } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { cart } from "@/lib/client/cart-store";
import { showToast } from "@/lib/client/toast";
import { FurniturePoster } from "./FurniturePoster";
import { QtyStepper } from "./QtyStepper";
import styles from "./Configurator.module.css";

type Draft = { variant?: VariantId; qty: number; heavySoil: boolean; secondSide: boolean; description: string };

const initialDrafts = (): Record<CategoryId, Draft> =>
  Object.fromEntries(
    CATEGORIES.map((c) => [
      c.id,
      { variant: c.variants[0]?.id, qty: 1, heavySoil: false, secondSide: false, description: "" },
    ]),
  ) as Record<CategoryId, Draft>;

type Props = { prices: PriceList; currency: CurrencyCode };

export function Configurator({ prices, currency }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryId>("sofa");
  // Параметры запоминаются отдельно для каждой категории.
  const [drafts, setDrafts] = useState(initialDrafts);
  const [descError, setDescError] = useState<string | null>(null);

  const cat = CATEGORY_BY_ID[category];
  const d = drafts[category];
  const patch = (p: Partial<Draft>) => setDrafts((all) => ({ ...all, [category]: { ...all[category], ...p } }));
  const money = (n: number) => formatMoney(n, currency);

  const item: OrderItem = {
    category,
    variant: category === "other" ? undefined : d.variant,
    qty: d.qty,
    heavySoil: d.heavySoil,
    secondSide: cat.hasSecondSide && d.secondSide,
    description: category === "other" ? d.description.trim() : undefined,
  };
  const line = calculateQuote([item], prices, false).lines[0];

  function add() {
    if (category === "other" && item.description!.length < 3) {
      setDescError("Опишите предмет: что это и из какой ткани");
      return;
    }
    cart.add(item);
    showToast(`${cat.title} — в заказе`, { label: "Открыть корзину", run: () => router.push("/korzina") });
    if (category === "other") patch({ description: "" });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        <div className={styles.stageInner} key={category}>
          <FurniturePoster category={category} className={styles.poster} />
        </div>
        {cat.variants.length > 1 && (
          <p className={styles.stageNote}>Картинка общая для всех вариантов — размер влияет только на цену.</p>
        )}
      </div>

      <div className={styles.panel}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Что почистить</legend>
          <div className={styles.chips}>
            {CATEGORIES.map((c) => (
              <label key={c.id} className={styles.chip}>
                <input
                  type="radio"
                  name="category"
                  value={c.id}
                  checked={category === c.id}
                  onChange={() => {
                    setCategory(c.id);
                    setDescError(null);
                  }}
                />
                <span>{c.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {cat.variants.length > 0 ? (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Вариант</legend>
            <div className={styles.variants}>
              {cat.variants.map((v) => (
                <label key={v.id} className={styles.variant}>
                  <input
                    type="radio"
                    name={`variant-${category}`}
                    value={v.id}
                    checked={d.variant === v.id}
                    onChange={() => patch({ variant: v.id })}
                  />
                  <span className={styles.variantTitle}>{v.title}</span>
                  <span className={`${styles.variantPrice} tabular`}>{money(prices.variants[v.id])}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className={styles.group}>
            <div className="field">
              <label className="label" htmlFor="other-desc">
                Что это за предмет?
              </label>
              <textarea
                id="other-desc"
                className="input"
                rows={3}
                maxLength={500}
                value={d.description}
                aria-invalid={descError ? true : undefined}
                aria-describedby={descError ? "other-desc-error" : "other-desc-hint"}
                placeholder="Например: пуф, банкетка, изголовье кровати, детское кресло"
                onChange={(e) => {
                  patch({ description: e.target.value });
                  if (descError) setDescError(null);
                }}
              />
              {descError ? (
                <span className="error" role="alert" id="other-desc-error">
                  {descError}
                </span>
              ) : (
                <span className="hint" id="other-desc-hint">
                  Стоимость — по фото. Фото приложите при оформлении заявки.
                </span>
              )}
            </div>
          </div>
        )}

        <div className={styles.group}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={d.heavySoil} onChange={(e) => patch({ heavySoil: e.target.checked })} />
            <span>
              Сильные загрязнения
              <span className={styles.toggleHint}>
                пятна, запах, шерсть животных{category !== "other" && ` · +${prices.heavySoilPercent}%`}
              </span>
            </span>
          </label>
          {cat.hasSecondSide && (
            <label className={styles.toggle}>
              <input type="checkbox" checked={d.secondSide} onChange={(e) => patch({ secondSide: e.target.checked })} />
              <span>
                Вторая сторона
                <span className={styles.toggleHint}>почистить матрас с двух сторон · +{prices.mattressSecondSidePercent}%</span>
              </span>
            </label>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.qtyRow}>
            <span className="label">Количество</span>
            <QtyStepper value={d.qty} onChange={(qty) => patch({ qty })} />
          </div>
          <div className={styles.priceRow} aria-live="polite">
            <span className={styles.priceLabel}>Примерно</span>
            <span className={`${styles.price} tabular`}>{line.known ? money(line.amount) : "По фото"}</span>
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={add}>
            Добавить в заказ
          </button>
          <p className={styles.fineprint}>
            Минимальный заказ — {money(prices.minOrder)}. Итоговую цену мастер подтвердит после разговора.{" "}
            <Link href="/korzina">Корзина</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
