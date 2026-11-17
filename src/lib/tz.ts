// Перевод между «местным временем компании» (поле datetime-local) и моментом времени (UTC).
// Без сторонних библиотек: смещение пояса берём из Intl.

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** «2026-11-20T10:00» в поясе компании → Date. null — если строка некорректна. */
export function zonedLocalToDate(local: string, timeZone: string): Date | null {
  const m = LOCAL_RE.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone); // уточнение на случай перехода на летнее время
  return new Date(utc);
}

/** Date → «2026-11-20T10:00» в поясе компании (для value у datetime-local). */
export function dateToZonedLocal(date: Date, timeZone: string): string {
  const local = new Date(date.getTime() + offsetMs(date.getTime(), timeZone));
  return local.toISOString().slice(0, 16);
}
