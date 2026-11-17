import { TIME_ZONE } from "./company";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long", weekday: "short" });

/** «17 ноября, 14:05» в часовом поясе компании. */
export function formatDateTime(d: Date | string): string {
  return dateTime.format(typeof d === "string" ? new Date(d) : d);
}

/** «2026-11-20» → «пт, 20 ноября». */
export function formatWishDate(s: string): string {
  return dateOnly.format(new Date(`${s}T00:00:00Z`));
}

/** «+77011234567» → «+7 701 ••• •• 67» — в приватной ссылке номер виден не целиком. */
export function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return `${p.slice(0, p.length - 7)} ••• •• ${p.slice(-2)}`;
}
