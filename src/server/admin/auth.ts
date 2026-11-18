import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { adminSessions } from "../db/schema";
import { readSetting, writeSetting } from "../settings";

// Вход владельца: один пароль на компанию.
//  • Пока пароль не меняли в кабинете — действует ADMIN_PASSWORD из окружения.
//  • После смены в «Доступе» в базе хранится только scrypt-хэш, а все прежние сеансы закрываются.
// Сеанс — случайный токен в httpOnly-cookie; в базе — его SHA-256.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "bliss_admin";
const SESSION_DAYS = 30;
/** Пароль для локальной разработки, если ADMIN_PASSWORD не задан. На хостинге не работает. */
export const DEV_PASSWORD = "bliss-demo";

type StoredPassword = { salt: string; hash: string };

async function hashPassword(password: string, salt = randomBytes(16)): Promise<StoredPassword> {
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function envPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p && p.length >= 8) return p;
  return process.env.NODE_ENV !== "production" ? DEV_PASSWORD : null;
}

export async function verifyPassword(db: Db, password: string): Promise<boolean> {
  const stored = (await readSetting(db, "admin:password")) as StoredPassword | undefined;
  if (stored?.salt && stored.hash) {
    const { hash } = await hashPassword(password, Buffer.from(stored.salt, "base64"));
    return safeEqual(Buffer.from(hash, "base64"), Buffer.from(stored.hash, "base64"));
  }
  const fallback = envPassword();
  if (!fallback) return false;
  // сравнение хэшей — без утечки длины пароля по времени
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(fallback).digest();
  return safeEqual(a, b);
}

export async function setPassword(db: Db, password: string): Promise<void> {
  await writeSetting(db, "admin:password", await hashPassword(password));
  await db.delete(adminSessions); // закрыть все сеансы
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

export async function createSession(db: Db): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(adminSessions).values({ tokenHash: tokenHash(token), expiresAt });
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Текущий сеанс владельца или null. */
export async function getSession(): Promise<{ db: Db } | null> {
  await connection(); // кабинет всегда рендерится по запросу, без заготовки заранее
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const rows = await db
    .select({ tokenHash: adminSessions.tokenHash })
    .from(adminSessions)
    .where(and(eq(adminSessions.tokenHash, tokenHash(token)), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ? { db } : null;
}

/** Для страниц и действий кабинета: без сеанса — на страницу входа. */
export async function requireAdmin(): Promise<Db> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session.db;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash(token)));
  }
  store.delete(SESSION_COOKIE);
}
