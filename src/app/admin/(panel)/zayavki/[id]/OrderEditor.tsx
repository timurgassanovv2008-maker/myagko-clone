"use client";

import { startTransition, useActionState, useState } from "react";
import { deleteOrderAction, updateOrderAction, type ActionState } from "../../../actions";
import { STATUS_TITLES } from "@/lib/order";
import type { OrderStatus } from "@/server/db/schema";
import styles from "../../../admin.module.css";

type Initial = { status: OrderStatus; finalPrice: string; agreedAt: string; ownerNote: string };

export function OrderEditor({
  id,
  initial,
  suggestedPrice,
  currencySymbol,
}: {
  id: number;
  initial: Initial;
  suggestedPrice: number | null;
  currencySymbol: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateOrderAction.bind(null, id), {});
  const [status, setStatus] = useState(initial.status);
  const [price, setPrice] = useState(initial.finalPrice);
  const e = state.errors ?? {};

  return (
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd)); // без сброса полей формы
      }}
    >
      <fieldset className={styles.statusGroup}>
        <legend className="label">Статус</legend>
        <div className={styles.segmented}>
          {(Object.keys(STATUS_TITLES) as OrderStatus[]).map((s) => (
            <label key={s}>
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
              <span>{STATUS_TITLES[s]}</span>
            </label>
          ))}
        </div>
        {status === "agreed" && <span className="hint">Для «Согласована» нужны итоговая цена и время.</span>}
      </fieldset>

      <div className="field">
        <label className="label" htmlFor="finalPrice">
          Итоговая цена, {currencySymbol}
        </label>
        <div className={styles.inline}>
          <input
            id="finalPrice"
            name="finalPrice"
            className="input"
            inputMode="numeric"
            pattern="[0-9 ]*"
            value={price}
            onChange={(ev) => setPrice(ev.target.value)}
            aria-invalid={e.finalPrice ? true : undefined}
            aria-describedby={e.finalPrice ? "finalPrice-error" : undefined}
          />
          {suggestedPrice !== null && price === "" && (
            <button type="button" className="btn btn-ghost" onClick={() => setPrice(String(suggestedPrice))}>
              = предварительной
            </button>
          )}
        </div>
        {e.finalPrice && (
          <span className="error" id="finalPrice-error">
            {e.finalPrice}
          </span>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="agreedAt">
          Согласованные дата и время
        </label>
        <input
          id="agreedAt"
          name="agreedAt"
          type="datetime-local"
          className="input"
          defaultValue={initial.agreedAt}
          aria-invalid={e.agreedAt ? true : undefined}
          aria-describedby={e.agreedAt ? "agreedAt-error" : undefined}
        />
        {e.agreedAt && (
          <span className="error" id="agreedAt-error">
            {e.agreedAt}
          </span>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="ownerNote">
          Заметка <span className="hint">видна только вам</span>
        </label>
        <textarea id="ownerNote" name="ownerNote" className="input" rows={3} defaultValue={initial.ownerNote} maxLength={4000} />
        {e.ownerNote && <span className="error">{e.ownerNote}</span>}
      </div>

      {state.message && (
        <p className={`notice ${state.ok ? "" : "notice-danger"}`} role="status">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}

export function DeleteOrder({ id, number, photos }: { id: number; number: string; photos: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
        Удалить заявку…
      </button>
    );
  }
  return (
    <div className="notice notice-danger" style={{ display: "grid", gap: 12 }} role="alertdialog" aria-label="Подтверждение удаления">
      <p>
        Удалить заявку № {number}
        {photos > 0 && ` вместе с ${photos} фото`}? Это нельзя отменить, клиентская ссылка перестанет работать.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ background: "var(--danger)", color: "#fff" }}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await deleteOrderAction(id);
          }}
        >
          {pending ? "Удаляем…" : "Удалить навсегда"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Отмена
        </button>
      </div>
    </div>
  );
}
