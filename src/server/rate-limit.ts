import "server-only";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { rateLimits } from "./db/schema";

// Ограничение частоты в базе: работает и на serverless, где память у каждого экземпляра своя.

export type Limit = { name: string; max: number; windowSec: number };

export const LIMITS = {
  order: { name: "order", max: 6, windowSec: 600 },
  upload: { name: "upload", max: 30, windowSec: 600 },
  login: { name: "login", max: 8, windowSec: 900 },
} satisfies Record<string, Limit>;

/** true — можно; false — слишком часто. */
export async function hit(db: Db, limit: Limit, subject: string): Promise<boolean> {
  const key = `${limit.name}:${createHash("sha256").update(subject).digest("base64url").slice(0, 22)}`;
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${limit.windowSec})`;
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });

  if (Math.random() < 0.02) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`));
  }
  return (rows[0]?.count ?? 1) <= limit.max;
}
