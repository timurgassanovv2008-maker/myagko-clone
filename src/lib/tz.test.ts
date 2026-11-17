import { describe, expect, it } from "vitest";
import { dateToZonedLocal, zonedLocalToDate } from "./tz";

describe("часовой пояс компании", () => {
  it("Алматы (UTC+5)", () => {
    const d = zonedLocalToDate("2026-11-20T10:00", "Asia/Almaty")!;
    expect(d.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(dateToZonedLocal(d, "Asia/Almaty")).toBe("2026-11-20T10:00");
  });
  it("Стамбул (UTC+3)", () => {
    const d = zonedLocalToDate("2026-07-01T09:30", "Europe/Istanbul")!;
    expect(d.toISOString()).toBe("2026-07-01T06:30:00.000Z");
    expect(dateToZonedLocal(d, "Europe/Istanbul")).toBe("2026-07-01T09:30");
  });
  it("летнее время учитывается", () => {
    expect(zonedLocalToDate("2026-07-01T12:00", "Europe/Berlin")!.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedLocalToDate("2026-01-01T12:00", "Europe/Berlin")!.toISOString()).toBe("2026-01-01T11:00:00.000Z");
  });
  it("мусор отклоняется", () => {
    expect(zonedLocalToDate("20.11.2026 10:00", "Asia/Almaty")).toBeNull();
    expect(zonedLocalToDate("2026-13-01T10:00", "Asia/Almaty")).toBeNull();
  });
});
