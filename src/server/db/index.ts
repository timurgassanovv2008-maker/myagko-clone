import "server-only";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Подключение к базе.
//  • DATABASE_URL задана → PostgreSQL (Neon, Supabase, свой сервер).
//  • Не задана → PGlite: настоящий Postgres внутри процесса, данные в .data/pglite.
//    Подходит для разработки и демо на своём компьютере, но НЕ для serverless-хостинга.
// Миграции из папки drizzle/ применяются автоматически при первом обращении.

export type Db = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Holder = { promise?: Promise<Db> };
const holder = ((globalThis as unknown as { __blissDb?: Holder }).__blissDb ??= {});

export function getDb(): Promise<Db> {
  holder.promise ??= connect().catch((err) => {
    holder.promise = undefined;
    throw err;
  });
  return holder.promise;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);
  // Сборка без базы: настройки для статических страниц берутся из демо-значений.
  if (process.env.NEXT_PHASE === "phase-production-build") return connectPglite("memory://");
  if (process.env.VERCEL) {
    throw new Error("Не задана DATABASE_URL. На хостинге заявки нельзя хранить в локальном файле — подключите PostgreSQL.");
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  return connectPglite(dir);
}

async function connectPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });

  // Миграции под advisory-lock: несколько одновременных запусков не помешают друг другу.
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(727001)");
    await migrate(drizzle(client, { schema }), { migrationsFolder: MIGRATIONS });
  } finally {
    await client.query("select pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
  return drizzle(pool, { schema });
}

/** Отдельно экспортируется для тестов: `createPgliteDb("memory://")`. */
export async function connectPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (!dataDir.includes("://")) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export { schema };
