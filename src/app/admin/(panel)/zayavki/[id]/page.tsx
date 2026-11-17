import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/admin/auth";
import { getAdminOrder, type AdminOrder } from "@/server/admin/orders";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { TIME_ZONE } from "@/lib/company";
import { formatPhone, orderNumber, STATUS_TITLES, timeSlotTitle } from "@/lib/order";
import { CATEGORY_BY_ID, variantTitle } from "@/lib/pricing/catalog";
import { formatDateTime, formatWishDate } from "@/lib/format";
import { dateToZonedLocal } from "@/lib/tz";
import { QuoteSummary } from "@/components/QuoteSummary";
import { OrderEditor, DeleteOrder } from "./OrderEditor";
import styles from "../../../admin.module.css";

export const metadata = { title: "Заявка" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/zayavki/[id]">) {
  const db = await requireAdmin();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const order = await getAdminOrder(db, id);
  if (!order) notFound();

  const currency = order.currency as CurrencyCode;
  const money = (n: number) => formatMoney(n, currency);
  const phoneDigits = order.phone.replace(/\D/g, "");
  const wishTime = timeSlotTitle(order.wishTime);

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.back}>
        ← Все заявки
      </Link>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>Заявка № {orderNumber(order.id)}</h1>
          <p className="hint">Получена {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`badge badge-${order.status}`}>{STATUS_TITLES[order.status]}</span>
      </div>

      <div className={styles.detail}>
        <div className={styles.col}>
          <section className={`card ${styles.block}`}>
            <h2 className={styles.h2}>Клиент</h2>
            <p className={styles.big}>{order.name}</p>
            <div className={styles.contactRow}>
              <a className="btn btn-primary" href={`tel:${order.phone}`}>
                Позвонить {formatPhone(order.phone)}
              </a>
              <a className="btn btn-secondary" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </div>
            <dl className={styles.dl}>
              <dt>Адрес</dt>
              <dd>
                {order.address}
                {order.outOfTown && <strong> · за городом</strong>}
              </dd>
              <dt>Пожелание по времени</dt>
              <dd>
                {order.wishDate ? formatWishDate(order.wishDate) : "дата любая"}
                {wishTime ? `, ${wishTime}` : order.wishDate ? ", время любое" : ""}
              </dd>
              {order.comment && (
                <>
                  <dt>Комментарий клиента</dt>
                  <dd className={styles.pre}>{order.comment}</dd>
                </>
              )}
            </dl>
          </section>

          <section className={`card ${styles.block}`}>
            <h2 className={styles.h2}>Состав и предварительный расчёт</h2>
            <Items order={order} money={money} />
            <QuoteSummary quote={order.quote} currency={currency} minOrder={order.priceSnapshot.minOrder} />
            <p className="hint">Расчёт по прайсу на момент отправки заявки.</p>
          </section>

          {order.photos.length > 0 && (
            <section className={`card ${styles.block}`}>
              <h2 className={styles.h2}>Фото ({order.photos.length})</h2>
              <div className={styles.photoGrid}>
                {order.photos.map((p) => (
                  <a key={p.id} href={`/api/admin/photos/${p.id}`} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element -- приватное фото через проверяющий маршрут */}
                    <img src={`/api/admin/photos/${p.id}`} alt="Фото от клиента" width={p.width} height={p.height} className={styles.photo} />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={styles.col}>
          <section className={`card ${styles.block}`}>
            <h2 className={styles.h2}>Согласование</h2>
            <OrderEditor
              id={order.id}
              currencySymbol={money(0).replace(/[\d\s]/g, "")}
              suggestedPrice={order.quote.total}
              initial={{
                status: order.status,
                finalPrice: order.finalPrice === null ? "" : String(order.finalPrice),
                agreedAt: order.agreedAt ? dateToZonedLocal(order.agreedAt, TIME_ZONE) : "",
                ownerNote: order.ownerNote,
              }}
            />
          </section>

          <section className={`card ${styles.block}`}>
            <h2 className={styles.h2}>История</h2>
            <ol className={styles.timeline}>
              {order.events.map((e) => (
                <li key={e.id}>
                  <span className="hint">{formatDateTime(e.at)}</span>
                  <span>{eventText(e, money)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={`card ${styles.block}`}>
            <h2 className={styles.h2}>Удаление</h2>
            <DeleteOrder id={order.id} number={orderNumber(order.id)} photos={order.photos.length} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Items({ order, money }: { order: AdminOrder; money: (n: number) => string }) {
  return (
    <ul className={styles.items}>
      {order.items.map((it, i) => {
        const line = order.quote.lines[i];
        const extras = [it.heavySoil && "сильные загрязнения", it.secondSide && "вторая сторона", it.description]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={i}>
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

function eventText(e: AdminOrder["events"][number], money: (n: number) => string): string {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "created":
      return "Заявка получена";
    case "status":
      return `Статус: ${STATUS_TITLES[d.from as keyof typeof STATUS_TITLES]} → ${STATUS_TITLES[d.to as keyof typeof STATUS_TITLES]}`;
    case "price":
      return typeof d.to === "number" ? `Итоговая цена: ${money(d.to)}` : "Итоговая цена убрана";
    case "time":
      return typeof d.to === "string" ? `Время выезда: ${formatDateTime(d.to)}` : "Время выезда убрано";
    case "note":
      return "Изменена заметка";
    default:
      return e.kind;
  }
}
