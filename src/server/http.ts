import "server-only";
import type { FieldErrors } from "@/lib/order";

/** IP клиента (за прокси хостинга — первый адрес из x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * Защита изменяющих запросов от чужих сайтов: Origin должен совпадать с адресом сайта.
 * Дополнительные адреса можно перечислить в ALLOWED_ORIGINS через запятую.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Браузеры присылают Origin для POST. Без него принимаем только явно «свои» запросы.
    const site = req.headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && originHost === host) return true;
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function fail(status: number, message: string, fieldErrors?: FieldErrors): Response {
  return json({ error: message, fieldErrors }, status);
}

export const forbiddenOrigin = () => fail(403, "Запрос отклонён: неверный источник.");
export const tooMany = () => fail(429, "Слишком много запросов. Подождите несколько минут и попробуйте снова.");
