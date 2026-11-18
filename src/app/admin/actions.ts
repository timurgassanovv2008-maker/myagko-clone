"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import "@/lib/zod-locale";
import { priceListSchema } from "@/lib/pricing/price-list";
import { VARIANT_IDS } from "@/lib/pricing/catalog";
import { flattenIssues, type FieldErrors } from "@/lib/order";
import { TIME_ZONE } from "@/lib/company";
import { zonedLocalToDate } from "@/lib/tz";
import { getDb } from "@/server/db";
import { createSession, destroySession, requireAdmin, setPassword, verifyPassword } from "@/server/admin/auth";
import { deleteOrder, orderUpdateSchema, updateOrder } from "@/server/admin/orders";
import { hit, LIMITS } from "@/server/rate-limit";
import { saveCompany, savePriceList } from "@/server/settings";
import { SETTINGS_TAG } from "@/server/public-settings";
import { headers } from "next/headers";

export type ActionState = { ok?: boolean; message?: string; errors?: FieldErrors };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Целое число из поля; пусто → null; мусор → NaN (схема отклонит). */
function int(fd: FormData, k: string): number | null {
  const raw = str(fd, k).replace(/[\s ]/g, "");
  if (raw === "") return null;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

// ─── Вход и доступ ────────────────────────────────────────────────

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await getDb();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!(await hit(db, LIMITS.login, ip))) {
    return { message: "Слишком много попыток. Подождите 15 минут." };
  }
  const password = String(fd.get("password") ?? "");
  if (!password || !(await verifyPassword(db, password))) {
    return { message: "Неверный пароль" };
  }
  await createSession(db);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Введите текущий пароль"),
    next: z.string().min(10, "Не короче 10 символов").max(200),
    repeat: z.string(),
  })
  .refine((p) => p.next === p.repeat, { path: ["repeat"], message: "Пароли не совпадают" });

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await requireAdmin();
  const parsed = passwordSchema.safeParse({
    current: String(fd.get("current") ?? ""),
    next: String(fd.get("next") ?? ""),
    repeat: String(fd.get("repeat") ?? ""),
  });
  if (!parsed.success) return { errors: flattenIssues(parsed.error.issues) };
  if (!(await verifyPassword(db, parsed.data.current))) return { errors: { current: "Неверный текущий пароль" } };
  await setPassword(db, parsed.data.next); // все сеансы закрыты
  await createSession(db); // этот браузер остаётся в кабинете
  return { ok: true, message: "Пароль изменён. Все остальные сеансы закрыты." };
}

export async function logoutEverywhereAction(): Promise<void> {
  const db = await requireAdmin();
  const { adminSessions } = await import("@/server/db/schema");
  await db.delete(adminSessions);
  await destroySession();
  redirect("/admin/login");
}

// ─── Заявки ───────────────────────────────────────────────────────

export async function updateOrderAction(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const db = await requireAdmin();
  const agreedRaw = str(fd, "agreedAt");
  const agreedAt = agreedRaw ? zonedLocalToDate(agreedRaw, TIME_ZONE) : null;
  if (agreedRaw && !agreedAt) return { errors: { agreedAt: "Некорректные дата и время" } };
  const parsed = orderUpdateSchema.safeParse({
    status: str(fd, "status"),
    finalPrice: int(fd, "finalPrice"),
    agreedAt,
    ownerNote: str(fd, "ownerNote"),
  });
  if (!parsed.success) return { errors: flattenIssues(parsed.error.issues) };
  const found = await updateOrder(db, id, parsed.data);
  if (!found) return { message: "Заявка не найдена — возможно, её удалили." };
  refresh();
  return { ok: true, message: "Сохранено. Клиент увидит изменения по своей ссылке." };
}

export async function deleteOrderAction(id: number): Promise<void> {
  const db = await requireAdmin();
  await deleteOrder(db, id);
  redirect("/admin?deleted=1");
}

// ─── Настройки ───────────────────────────────────────────────────

export async function savePricesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await requireAdmin();
  const parsed = priceListSchema.safeParse({
    variants: Object.fromEntries(VARIANT_IDS.map((id) => [id, int(fd, `variant.${id}`)])),
    minOrder: int(fd, "minOrder"),
    heavySoilPercent: int(fd, "heavySoilPercent"),
    mattressSecondSidePercent: int(fd, "mattressSecondSidePercent"),
    outOfTownFee: int(fd, "outOfTownFee"),
  });
  if (!parsed.success) {
    const friendly = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.code === "too_big" ? "Слишком большое значение" : "Введите целое число от 0",
    }));
    return { errors: flattenIssues(friendly), message: "Проверьте поля: нужны целые неотрицательные числа." };
  }
  await savePriceList(db, parsed.data);
  updateTag(SETTINGS_TAG);
  return { ok: true, message: "Цены сохранены. Новые заявки считаются по ним, старые — нет." };
}

const optionalText = (max: number) => z.string().trim().max(max, `До ${max} символов`);

const companySchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(40, "До 40 символов"),
  tagline: z.string().trim().min(1, "Укажите описание").max(80, "До 80 символов"),
  city: optionalText(60),
  area: optionalText(120),
  phone: optionalText(30).refine((s) => s === "" || /^[+\d][\d\s()-]{6,}$/.test(s), "Номер в формате +7 700 000 00 00"),
  whatsapp: optionalText(30).refine((s) => s === "" || /^[+\d][\d\s()-]{6,}$/.test(s), "Номер WhatsApp с кодом страны"),
  telegram: optionalText(40).refine((s) => s === "" || /^@?[A-Za-z0-9_]{4,32}$/.test(s), "Имя пользователя, например @bliss_clean"),
  email: optionalText(80).refine((s) => s === "" || z.email().safeParse(s).success, "Проверьте e-mail"),
  hours: optionalText(60),
  accent: optionalText(7).refine((s) => s === "" || /^#[0-9a-fA-F]{6}$/.test(s), "Цвет в формате #2f5d50"),
});

export async function saveCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await requireAdmin();
  const parsed = companySchema.safeParse(Object.fromEntries(Object.keys(companySchema.shape).map((k) => [k, str(fd, k)])));
  if (!parsed.success) return { errors: flattenIssues(parsed.error.issues) };
  await saveCompany(db, parsed.data);
  updateTag(SETTINGS_TAG);
  return { ok: true, message: "Сохранено. Сайт уже показывает новые данные." };
}
