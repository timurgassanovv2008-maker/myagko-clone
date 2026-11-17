"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_BY_ID, variantTitle } from "@/lib/pricing/catalog";
import { calculateQuote } from "@/lib/pricing/calc";
import type { PriceList } from "@/lib/pricing/price-list";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { crossFieldIssues, flattenIssues, orderRequestSchema, TIME_SLOTS, type FieldErrors } from "@/lib/order";
import { cart, useCart } from "@/lib/client/cart-store";
import { prepareImage, ImagePrepError } from "@/lib/client/images";
import { rememberOrder } from "@/lib/client/recent-orders";
import { randomId, readJson, removeKey, writeJson } from "@/lib/client/storage";
import { useHydrated } from "@/lib/client/use-hydrated";
import { QuoteSummary } from "@/components/QuoteSummary";
import { PhotoPicker, type Photo } from "./PhotoPicker";
import styles from "./checkout.module.css";

const DRAFT_KEY = "bliss:draft:v1";

type Draft = {
  name: string;
  phone: string;
  address: string;
  outOfTown: boolean;
  wishDate: string;
  wishTime: string;
  comment: string;
  consent: boolean;
  /** Ключ повтора: один на попытку оформления, пока заявка не принята. */
  key: string;
  photos: { id: string; thumb: string }[];
};

function loadDraft(): Draft {
  const d = readJson<Partial<Draft>>(DRAFT_KEY) ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    name: str(d.name),
    phone: str(d.phone),
    address: str(d.address),
    outOfTown: d.outOfTown === true,
    wishDate: str(d.wishDate),
    wishTime: str(d.wishTime),
    comment: str(d.comment),
    consent: d.consent === true,
    key: typeof d.key === "string" && d.key.length >= 16 ? d.key : randomId(18),
    photos: Array.isArray(d.photos)
      ? d.photos.filter((p) => typeof p?.id === "string" && typeof p?.thumb === "string").slice(0, 3)
      : [],
  };
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function omit(o: FieldErrors, key: string): FieldErrors {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

type Props = { prices: PriceList; currency: CurrencyCode };

export function CheckoutForm(props: Props) {
  const hydrated = useHydrated();
  const { lines } = useCart();
  if (!hydrated) {
    return (
      <div className={styles.page} aria-busy="true">
        <h1 className={styles.h1}>Оформление заявки</h1>
        <div className={styles.skeleton} />
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.h1}>Оформление заявки</h1>
        <div className="card" style={{ padding: 24, display: "grid", gap: 14, justifyItems: "start" }}>
          <p>В корзине пока ничего нет — сначала выберите мебель.</p>
          <Link href="/#vybor" className="btn btn-primary">
            Выбрать мебель
          </Link>
        </div>
      </div>
    );
  }
  return <CheckoutInner {...props} />;
}

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; retry: boolean };

function CheckoutInner({ prices, currency }: Props) {
  const router = useRouter();
  const { lines } = useCart();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [photos, setPhotos] = useState<Photo[]>(() =>
    draft.photos.map((p) => ({ key: p.id, status: "done", id: p.id, thumb: p.thumb })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const done = useRef(false);

  // Черновик сохраняется при каждом изменении (кроме уже отправленной заявки).
  useEffect(() => {
    if (done.current) return;
    const saved = photos.filter((p) => p.status === "done" && p.id && p.thumb).map((p) => ({ id: p.id!, thumb: p.thumb! }));
    writeJson(DRAFT_KEY, { ...draft, photos: saved });
  }, [draft, photos]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    const field = k === "consent" ? "consent" : `customer.${k}`;
    if (errors[field]) setErrors((er) => omit(er, field));
  };

  const quote = calculateQuote(lines, prices, draft.outOfTown);
  const needsPhoto = lines.some((l) => l.category === "other");
  const money = (n: number) => formatMoney(n, currency);

  // ─── Фото ───
  const patchPhoto = (key: string, p: Partial<Photo>) =>
    setPhotos((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function upload(key: string, blob: Blob) {
    patchPhoto(key, { status: "uploading", error: undefined });
    const fd = new FormData();
    fd.append("file", blob, "photo.jpg");
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patchPhoto(key, { status: "error", error: data.error ?? "Не удалось загрузить" });
        return;
      }
      patchPhoto(key, { status: "done", id: data.id, blob: undefined });
    } catch {
      patchPhoto(key, { status: "error", error: "Нет связи" });
    }
  }

  async function addFiles(files: File[]) {
    setErrors((er) => omit(er, "photoIds"));
    for (const file of files) {
      const key = randomId(9);
      setPhotos((list) => [...list, { key, status: "preparing" }]);
      try {
        const { blob, thumb } = await prepareImage(file);
        patchPhoto(key, { thumb, blob });
        void upload(key, blob);
      } catch (e) {
        setPhotos((list) => list.filter((x) => x.key !== key));
        setErrors((er) => ({
          ...er,
          photoIds: `${file.name}: ${e instanceof ImagePrepError ? e.message : "не удалось открыть"}`,
        }));
      }
    }
  }

  function removePhoto(key: string) {
    const p = photos.find((x) => x.key === key);
    setPhotos((list) => list.filter((x) => x.key !== key));
    if (p?.id) void fetch(`/api/uploads/${p.id}`, { method: "DELETE" }).catch(() => {});
  }

  // ─── Отправка ───
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (send.kind === "sending") return;

    if (photos.some((p) => p.status === "uploading" || p.status === "preparing")) {
      setErrors((er) => ({ ...er, photoIds: "Дождитесь, пока загрузятся фото" }));
      return;
    }
    if (photos.some((p) => p.status === "error")) {
      setErrors((er) => ({ ...er, photoIds: "Есть незагруженные фото: повторите загрузку или удалите их" }));
      return;
    }

    const payload = {
      idempotencyKey: draft.key,
      items: cart.items(),
      customer: {
        name: draft.name,
        phone: draft.phone,
        address: draft.address,
        outOfTown: draft.outOfTown,
        wishDate: draft.wishDate,
        wishTime: draft.wishTime,
        comment: draft.comment,
      },
      consent: draft.consent,
      photoIds: photos.filter((p) => p.status === "done" && p.id).map((p) => p.id!),
    };

    const check = orderRequestSchema.safeParse(payload);
    if (!check.success) {
      showErrors(flattenIssues([...check.error.issues, ...crossFieldIssues(payload)]));
      return;
    }

    setSend({ kind: "sending" });
    let res: Response;
    try {
      res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      setSend({
        kind: "error",
        retry: true,
        message: "Не удалось отправить: нет связи с сервером. Всё введённое сохранено — попробуйте ещё раз.",
      });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.token === "string") {
      done.current = true;
      rememberOrder({ token: data.token, number: data.number, at: new Date().toISOString() });
      removeKey(DRAFT_KEY);
      cart.clear();
      router.replace(`/z/${data.token}?new=1`);
      return;
    }
    if (res.status === 422 && data.fieldErrors) {
      setSend({ kind: "idle" });
      showErrors(data.fieldErrors);
      return;
    }
    setSend({
      kind: "error",
      retry: res.status >= 500 || res.status === 429,
      message: data.error ?? "Что-то пошло не так. Попробуйте ещё раз через минуту.",
    });
  }

  function showErrors(fe: FieldErrors) {
    setErrors(fe);
    const itemsError = Object.keys(fe).find((k) => k.startsWith("items"));
    if (itemsError) {
      setSend({ kind: "error", retry: false, message: "Проверьте позиции в корзине: " + fe[itemsError] });
    }
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], #photos-error, #consent-error");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (el && "focus" in el) el.focus({ preventScroll: true });
    });
  }

  const err = (k: string) => errors[`customer.${k}`];
  const inputProps = (k: keyof Draft & string) => ({
    id: `f-${k}`,
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": err(k) ? `f-${k}-error` : k === "phone" ? "f-phone-hint" : undefined,
  });
  const errorText = (k: string) =>
    err(k) ? (
      <span className="error" id={`f-${k}-error`}>
        {err(k)}
      </span>
    ) : null;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.h1}>Оформление заявки</h1>
        <Link href="/korzina" className="btn btn-ghost">
          ← Корзина
        </Link>
      </div>

      <div className={styles.layout}>
        <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
          <fieldset className={styles.block} disabled={send.kind === "sending"}>
            <legend className={styles.legend}>Контакты</legend>
            <div className="field">
              <label className="label" htmlFor="f-name">Имя</label>
              <input
                className="input"
                autoComplete="name"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                {...inputProps("name")}
              />
              {errorText("name")}
            </div>
            <div className="field">
              <label className="label" htmlFor="f-phone">Телефон</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 700 000 00 00"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                {...inputProps("phone")}
              />
              {errorText("phone") ?? (
                <span className="hint" id="f-phone-hint">
                  Позвоним, чтобы согласовать цену и время.
                </span>
              )}
            </div>
          </fieldset>

          <fieldset className={styles.block} disabled={send.kind === "sending"}>
            <legend className={styles.legend}>Куда приехать</legend>
            <div className="field">
              <label className="label" htmlFor="f-address">Адрес</label>
              <textarea
                className="input"
                rows={2}
                autoComplete="street-address"
                placeholder="Улица, дом, подъезд, этаж, квартира"
                value={draft.address}
                onChange={(e) => set("address", e.target.value)}
                {...inputProps("address")}
              />
              {errorText("address")}
            </div>
            <label className="check">
              <input type="checkbox" checked={draft.outOfTown} onChange={(e) => set("outOfTown", e.target.checked)} />
              <span>
                За городом
                <span className="hint" style={{ display: "block" }}>
                  Выезд за город +{money(prices.outOfTownFee)}
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className={styles.block} disabled={send.kind === "sending"}>
            <legend className={styles.legend}>
              Когда удобно <span className="hint">необязательно</span>
            </legend>
            <div className={styles.row2}>
              <div className="field">
                <label className="label" htmlFor="f-wishDate">Дата</label>
                <input
                  className="input"
                  type="date"
                  min={todayLocal()}
                  value={draft.wishDate}
                  onChange={(e) => set("wishDate", e.target.value)}
                  {...inputProps("wishDate")}
                />
                {errorText("wishDate")}
              </div>
              <div className="field">
                <label className="label" htmlFor="f-wishTime">Время</label>
                <select
                  className="input"
                  value={draft.wishTime}
                  onChange={(e) => set("wishTime", e.target.value)}
                  {...inputProps("wishTime")}
                >
                  <option value="">Любое</option>
                  {TIME_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                {errorText("wishTime")}
              </div>
            </div>
            <p className="hint">Это пожелание. Мастер подтвердит дату и время, когда позвонит вам.</p>
          </fieldset>

          <fieldset className={styles.block} disabled={send.kind === "sending"}>
            <legend className={styles.legend}>Подробности</legend>
            <PhotoPicker
              photos={photos}
              required={needsPhoto}
              error={errors.photoIds}
              onAdd={addFiles}
              onRetry={(key) => {
                const p = photos.find((x) => x.key === key);
                if (p?.blob) void upload(key, p.blob);
              }}
              onRemove={removePhoto}
            />
            <div className="field">
              <label className="label" htmlFor="f-comment">
                Комментарий <span className="hint">необязательно</span>
              </label>
              <textarea
                className="input"
                rows={3}
                maxLength={1000}
                placeholder="Что за пятна, есть ли домашние животные, код домофона…"
                value={draft.comment}
                onChange={(e) => set("comment", e.target.value)}
                {...inputProps("comment")}
              />
              {errorText("comment")}
            </div>
          </fieldset>

          <div className={styles.block}>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.consent}
                onChange={(e) => set("consent", e.target.checked)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "consent-error" : undefined}
              />
              <span>
                Согласен(на) на обработку персональных данных по{" "}
                <Link href="/politika" target="_blank">
                  политике конфиденциальности
                </Link>
              </span>
            </label>
            {errors.consent && (
              <span className="error" id="consent-error">
                {errors.consent}
              </span>
            )}
          </div>

          {send.kind === "error" && (
            <div className="notice notice-danger" role="alert">
              <p>{send.message}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={send.kind === "sending"}>
            {send.kind === "sending" ? (
              <>
                <span className="spinner" aria-hidden="true" /> Отправляем…
              </>
            ) : send.kind === "error" && send.retry ? (
              "Отправить ещё раз"
            ) : (
              "Отправить заявку"
            )}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>
            Оплата не нужна. Мы перезвоним и подтвердим цену и время.
          </p>
        </form>

        <aside className={`card ${styles.summary}`}>
          <h2 className={styles.h2}>Ваш заказ</h2>
          <ul className={styles.items}>
            {lines.map((l, i) => {
              const r = quote.lines[i];
              return (
                <li key={l.id} className={styles.item}>
                  <span>
                    {CATEGORY_BY_ID[l.category].title}
                    {l.variant && `, ${variantTitle(l.variant).toLowerCase()}`}
                    {l.qty > 1 && ` × ${l.qty}`}
                    <span className={styles.itemSub}>
                      {[l.heavySoil && "сильные загрязнения", l.secondSide && "вторая сторона", l.description]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="tabular">{r.known ? money(r.amount) : "по фото"}</span>
                </li>
              );
            })}
          </ul>
          <QuoteSummary quote={quote} currency={currency} minOrder={prices.minOrder} />
        </aside>
      </div>
    </div>
  );
}
