import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CATEGORY_BY_ID, variantTitle } from "@/lib/pricing/catalog";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { orderNumber, STATUS_HINTS, STATUS_TITLES, timeSlotTitle, TOKEN_RE } from "@/lib/order";
import { formatDateTime, formatWishDate, maskPhone } from "@/lib/format";
import { getDb } from "@/server/db";
import { getPublicOrder, type PublicOrder } from "@/server/orders";
import { QuoteSummary } from "@/components/QuoteSummary";
import { AutoRefresh, CopyLink } from "./OrderClient";
import styles from "./order.module.css";

export const metadata: Metadata = {
  title: "Ваша заявка",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OrderPage({ params, searchParams }: PageProps<"/z/[token]">) {
  return (
    <main className="container">
      <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
        <OrderView params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OrderView({ params, searchParams }: Pick<PageProps<"/z/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  if (!TOKEN_RE.test(token)) notFound();
  const order = await getPublicOrder(await getDb(), token);
  if (!order) notFound();

  const currency = order.currency as CurrencyCode;
  const money = (n: number) => formatMoney(n, currency);
  const wishTime = timeSlotTitle(order.wishTime);

  return (
    <div className={styles.page}>
      <AutoRefresh />
      {isNew === "1" && (
        <div className={styles.success} role="status">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
            <path d="M7 12.5l3.2 3L17 8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className={styles.successTitle}>Заявка отправлена</p>
            <p>Мы скоро позвоним, чтобы согласовать цену и время. Сохраните эту страницу — здесь видно все изменения.</p>
          </div>
        </div>
      )}

      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>Заявка № {orderNumber(order.id)}</h1>
          <p className={styles.meta}>от {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`badge badge-${order.status}`}>{STATUS_TITLES[order.status]}</span>
      </header>
      <p className={styles.hint}>{STATUS_HINTS[order.status]}</p>

      <CopyLink />

      <div className={styles.grid}>
        <section className={`card ${styles.block}`}>
          <h2 className={styles.h2}>Стоимость</h2>
          {order.finalPrice !== null && order.status !== "cancelled" ? (
            <div className={styles.final}>
              <span>Согласованная цена</span>
              <span className={`${styles.finalValue} tabular`}>{money(order.finalPrice)}</span>
            </div>
          ) : null}
          {order.agreedAt && order.status !== "cancelled" && (
            <div className={styles.final}>
              <span>Время выезда</span>
              <span className={styles.finalValue}>{formatDateTime(order.agreedAt)}</span>
            </div>
          )}
          <QuoteSummary
            quote={order.quote}
            currency={currency}
            minOrder={order.priceSnapshot.minOrder}
            totalLabel={order.finalPrice !== null ? "Предварительный расчёт" : "Предварительно"}
          />
          {order.finalPrice === null && (
            <p className={styles.fine}>Итоговую цену мастер назовёт после разговора — она появится здесь.</p>
          )}
        </section>

        <section className={`card ${styles.block}`}>
          <h2 className={styles.h2}>Что почистить</h2>
          <Items order={order} money={money} />
        </section>

        <section className={`card ${styles.block}`}>
          <h2 className={styles.h2}>Детали</h2>
          <dl className={styles.details}>
            <div>
              <dt>Имя</dt>
              <dd>{order.name}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd className="tabular">{maskPhone(order.phone)}</dd>
            </div>
            <div>
              <dt>Адрес</dt>
              <dd>
                {order.address}
                {order.outOfTown && " (за городом)"}
              </dd>
            </div>
            <div>
              <dt>Пожелание по времени</dt>
              <dd>
                {order.wishDate ? formatWishDate(order.wishDate) : "Дата любая"}
                {wishTime ? `, ${wishTime}` : order.wishDate ? ", время любое" : ""}
              </dd>
            </div>
            {order.comment && (
              <div>
                <dt>Комментарий</dt>
                <dd className={styles.pre}>{order.comment}</dd>
              </div>
            )}
          </dl>
          {order.photos.length > 0 && (
            <div className={styles.photos}>
              {order.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element -- приватное фото через проверяющий маршрут
                <img
                  key={p.id}
                  src={`/api/z/${token}/photos/${p.id}`}
                  alt="Фото мебели"
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={styles.photo}
                />
              ))}
            </div>
          )}
        </section>

        <section className={`card ${styles.block}`}>
          <h2 className={styles.h2}>История</h2>
          <ol className={styles.timeline}>
            {order.events.map((e, i) => (
              <li key={i}>
                <span className={styles.when}>{formatDateTime(e.at)}</span>
                <span>{eventText(e, money)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Items({ order, money }: { order: PublicOrder; money: (n: number) => string }) {
  return (
    <ul className={styles.items}>
      {order.items.map((it, i) => {
        const line = order.quote.lines[i];
        const extras = [it.heavySoil && "сильные загрязнения", it.secondSide && "вторая сторона", it.description]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={i} className={styles.item}>
            <span>
              {CATEGORY_BY_ID[it.category].title}
              {it.variant && `, ${variantTitle(it.variant).toLowerCase()}`}
              {it.qty > 1 && ` × ${it.qty}`}
              {extras && <span className={styles.sub}>{extras}</span>}
            </span>
            <span className="tabular">{line?.known ? money(line.amount) : "по фото"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function eventText(e: PublicOrder["events"][number], money: (n: number) => string): string {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "created":
      return "Заявка отправлена";
    case "status":
      return `Статус: ${STATUS_TITLES[d.to as keyof typeof STATUS_TITLES] ?? d.to}`;
    case "price":
      return typeof d.to === "number" ? `Итоговая цена: ${money(d.to)}` : "Итоговая цена снята";
    case "time":
      return typeof d.to === "string" ? `Время выезда: ${formatDateTime(d.to)}` : "Время выезда снято";
    default:
      return e.kind;
  }
}
