import { z } from "zod";
import "./zod-locale";
import { MAX_ITEMS, orderItemSchema } from "./pricing/calc";

// Заявка: общая схема для формы в браузере и проверки на сервере.

export const MAX_PHOTOS = 3;

/** Желаемое время — интервал. Это пожелание: мастер подтверждает запись после разговора. */
export const TIME_SLOTS = [
  { id: "09-12", title: "9:00–12:00" },
  { id: "12-15", title: "12:00–15:00" },
  { id: "15-18", title: "15:00–18:00" },
  { id: "18-21", title: "18:00–21:00" },
] as const;
export type TimeSlotId = (typeof TIME_SLOTS)[number]["id"];
const TIME_SLOT_IDS = TIME_SLOTS.map((s) => s.id) as [TimeSlotId, ...TimeSlotId[]];

export function timeSlotTitle(id: string | null | undefined): string | null {
  return TIME_SLOTS.find((s) => s.id === id)?.title ?? null;
}

/** «+7 (701) 123-45-67» → «+77011234567». */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!isoDate.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Дата не в прошлом (с запасом в сутки на часовые пояса) и не дальше чем через год. */
export function isAllowedWishDate(s: string, now: Date = new Date()): boolean {
  if (!isRealDate(s)) return false;
  const day = Date.parse(`${s}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return day >= today - 86_400_000 && day <= today + 366 * 86_400_000;
}

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Как к вам обращаться?").max(80, "Слишком длинное имя"),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((p) => {
      const n = p.replace("+", "").length;
      return n >= 10 && n <= 15;
    }, "Проверьте номер: нужно 10–15 цифр"),
  address: z.string().trim().min(5, "Укажите адрес: улица, дом, квартира").max(300, "Слишком длинный адрес"),
  outOfTown: z.boolean().default(false),
  wishDate: z
    .string()
    .trim()
    .transform((s) => s || null)
    .nullable()
    .default(null)
    .refine((s) => s === null || isAllowedWishDate(s), "Выберите дату не раньше сегодняшней"),
  wishTime: z
    .union([z.enum(TIME_SLOT_IDS), z.literal("")])
    .transform((s) => s || null)
    .nullable()
    .default(null),
  comment: z.string().trim().max(1000, "Комментарий до 1000 символов").default(""),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type Customer = z.output<typeof customerSchema>;

export const orderRequestSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Некорректный ключ"),
    items: z.array(orderItemSchema).min(1, "Корзина пуста").max(MAX_ITEMS, `Не больше ${MAX_ITEMS} позиций`),
    customer: customerSchema,
    consent: z.literal(true, "Нужно согласие на обработку данных"),
    photoIds: z.array(z.uuid()).max(MAX_PHOTOS, `Не больше ${MAX_PHOTOS} фото`).default([]),
  })
  .superRefine((o, ctx) => {
    for (const issue of crossFieldIssues(o)) ctx.addIssue({ code: "custom", ...issue });
  });

type CrossInput = {
  items?: readonly { category?: string }[];
  customer?: { wishDate?: string | null; wishTime?: string | null };
  photoIds?: readonly string[];
};

/**
 * Проверки, связывающие разные поля. Вынесены отдельно, чтобы форма показывала их
 * сразу вместе с остальными ошибками (zod запускает superRefine только для валидного объекта).
 */
export function crossFieldIssues(o: CrossInput): { path: string[]; message: string }[] {
  const out: { path: string[]; message: string }[] = [];
  const photoIds = o.photoIds ?? [];
  if (o.customer?.wishTime && !o.customer.wishDate) {
    out.push({ path: ["customer", "wishDate"], message: "Для времени выберите дату" });
  }
  if (o.items?.some((i) => i.category === "other") && photoIds.length === 0) {
    out.push({ path: ["photoIds"], message: "Для «Другое» нужно хотя бы одно фото" });
  }
  if (new Set(photoIds).size !== photoIds.length) {
    out.push({ path: ["photoIds"], message: "Одно и то же фото добавлено дважды" });
  }
  return out;
}

export type OrderRequest = z.output<typeof orderRequestSchema>;
export type OrderRequestInput = z.input<typeof orderRequestSchema>;

/** Ошибки по полям: «customer.phone» → текст. Так их удобно показывать рядом с полем. */
export type FieldErrors = Record<string, string>;

export function flattenIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

// ─── Статусы ──────────────────────────────────────────────────────

export const STATUS_TITLES = {
  new: "Новая",
  agreed: "Согласована",
  done: "Завершена",
  cancelled: "Отменена",
} as const;

export const STATUS_HINTS = {
  new: "Мы получили заявку и скоро свяжемся с вами, чтобы согласовать цену и время.",
  agreed: "Цена и время согласованы. Мастер приедет в назначенное время.",
  done: "Работа выполнена. Спасибо, что выбрали нас!",
  cancelled: "Заявка отменена.",
} as const;

/** Номер для людей. Не секрет и не даёт доступа к заявке. */
export function orderNumber(id: number): string {
  return String(1000 + id);
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
