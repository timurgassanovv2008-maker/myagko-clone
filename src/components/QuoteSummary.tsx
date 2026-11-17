import type { Quote } from "@/lib/pricing/calc";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { ITEM_FORMS, plural } from "@/lib/plural";
import styles from "./QuoteSummary.module.css";

type Props = {
  quote: Quote;
  currency: CurrencyCode;
  minOrder: number;
  /** Подпись итога. */
  totalLabel?: string;
};

/** Разбивка суммы: известная часть, минимум, выезд, предметы «по фото». Неизвестную цену не показываем как ноль. */
export function QuoteSummary({ quote, currency, minOrder, totalLabel = "Предварительно" }: Props) {
  const money = (n: number) => formatMoney(n, currency);
  const hasKnown = quote.cleaning !== null;
  return (
    <dl className={styles.list}>
      {hasKnown && (
        <div className={styles.row}>
          <dt>Чистка</dt>
          <dd className="tabular">{money(quote.knownSubtotal)}</dd>
        </div>
      )}
      {quote.minOrderApplied && (
        <div className={styles.row}>
          <dt>
            До минимального заказа
            <span className={styles.sub}>минимум на чистку — {money(minOrder)}</span>
          </dt>
          <dd className="tabular">+{money(quote.cleaning! - quote.knownSubtotal)}</dd>
        </div>
      )}
      {quote.manualCount > 0 && (
        <div className={styles.row}>
          <dt>
            {quote.manualCount} {plural(quote.manualCount, ITEM_FORMS)} по фото
            <span className={styles.sub}>мастер оценит по фото и назовёт цену</span>
          </dt>
          <dd>по фото</dd>
        </div>
      )}
      {quote.outOfTown > 0 && (
        <div className={styles.row}>
          <dt>Выезд за город</dt>
          <dd className="tabular">+{money(quote.outOfTown)}</dd>
        </div>
      )}
      <div className={`${styles.row} ${styles.total}`}>
        <dt>{totalLabel}</dt>
        <dd className="tabular">
          {quote.total !== null ? money(quote.total) : "По фото"}
          {quote.total !== null && quote.manualCount > 0 && <span className={styles.plus}> + по фото</span>}
        </dd>
      </div>
    </dl>
  );
}
