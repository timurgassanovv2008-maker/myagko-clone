import Link from "next/link";
import { ORDER_STATUSES, type OrderStatus } from "@/server/db/schema";
import { requireAdmin } from "@/server/admin/auth";
import { listOrders, type OrderFilter } from "@/server/admin/orders";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { formatPhone, orderNumber, STATUS_TITLES, timeSlotTitle } from "@/lib/order";
import { itemsSummary } from "@/lib/order-text";
import { formatDateTime, formatWishDate } from "@/lib/format";
import { RefreshButton } from "./RefreshButton";
import styles from "../admin.module.css";

export const metadata = { title: "Заявки" };

const FILTERS: { id: OrderFilter["status"]; title: string }[] = [
  { id: "active", title: "В работе" },
  { id: "new", title: STATUS_TITLES.new },
  { id: "agreed", title: STATUS_TITLES.agreed },
  { id: "done", title: STATUS_TITLES.done },
  { id: "cancelled", title: STATUS_TITLES.cancelled },
  { id: "all", title: "Все" },
];

function parseStatus(v: unknown): OrderFilter["status"] {
  if (v === "all" || v === "active") return v;
  return (ORDER_STATUSES as readonly string[]).includes(String(v)) ? (v as OrderStatus) : "active";
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin">) {
  const db = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const status = parseStatus(sp.status);
  const { rows, more } = await listOrders(db, { q, status });
  const href = (s: OrderFilter["status"]) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), status: s! })}`;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Заявки</h1>
        <RefreshButton />
      </div>
      {sp.deleted === "1" && <p className="notice">Заявка удалена.</p>}

      <form className={styles.search} role="search" action="/admin">
        <input type="hidden" name="status" value={status} />
        <label className="visually-hidden" htmlFor="q">
          Поиск
        </label>
        <input
          id="q"
          name="q"
          type="search"
          className="input"
          defaultValue={q}
          placeholder="Имя, телефон, адрес или номер заявки"
        />
        <button className="btn btn-secondary">Найти</button>
      </form>

      <nav className={styles.filters} aria-label="Статус">
        {FILTERS.map((f) => (
          <Link key={f.id} href={href(f.id)} className={styles.filter} aria-current={status === f.id ? "true" : undefined}>
            {f.title}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className={`card ${styles.emptyList}`}>
          {q ? "Ничего не нашлось. Попробуйте другой запрос или фильтр «Все»." : "Здесь пока пусто. Новые заявки появятся сами."}
        </div>
      ) : (
        <ul className={styles.orders}>
          {rows.map((o) => {
            const money = (n: number) => formatMoney(n, o.currency as CurrencyCode);
            const price =
              o.finalPrice !== null
                ? money(o.finalPrice)
                : o.quote.total !== null
                  ? `≈ ${money(o.quote.total)}${o.quote.manualCount ? " + по фото" : ""}`
                  : "по фото";
            const wish = o.wishDate ? `${formatWishDate(o.wishDate)}${o.wishTime ? `, ${timeSlotTitle(o.wishTime)}` : ""}` : null;
            return (
              <li key={o.id}>
                <Link href={`/admin/zayavki/${o.id}`} className={`card ${styles.orderRow}`}>
                  <div className={styles.orderTop}>
                    <span className={styles.orderNum}>№ {orderNumber(o.id)}</span>
                    <span className={`badge badge-${o.status}`}>{STATUS_TITLES[o.status]}</span>
                    <span className={styles.orderDate}>{formatDateTime(o.createdAt)}</span>
                  </div>
                  <div className={styles.orderMain}>
                    <span className={styles.orderName}>
                      {o.name} · <span className="tabular">{formatPhone(o.phone)}</span>
                    </span>
                    <span className={`${styles.orderPrice} tabular`}>{price}</span>
                  </div>
                  <span className={styles.orderItems}>{itemsSummary(o.items)}</span>
                  <span className={styles.orderMeta}>
                    {o.address}
                    {o.outOfTown && " · за городом"}
                    {o.agreedAt
                      ? ` · выезд ${formatDateTime(o.agreedAt)}`
                      : wish
                        ? ` · пожелание: ${wish}`
                        : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {more && <p className="hint">Показаны последние 100. Уточните поиск, чтобы найти более старые.</p>}
    </div>
  );
}
