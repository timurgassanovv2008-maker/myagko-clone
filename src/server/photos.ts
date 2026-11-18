import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import sharp from "sharp";
import type { Db } from "./db";
import { orders, photos } from "./db/schema";

// Фото: проверка настоящего формата по содержимому, сжатие, хранение в базе.

/** Сколько байт принимаем за один файл. Браузер заранее ужимает фото, так что хватает с запасом. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Неприкреплённые к заявке фото удаляются через сутки. */
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SIDE = 1600;

export type ImageFormat = "jpeg" | "png" | "webp";

/** Формат по сигнатуре файла, а не по имени или заявленному типу. */
export function sniffFormat(b: Uint8Array): ImageFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "webp";
  return null;
}

export class PhotoError extends Error {}

export type ProcessedImage = { data: Uint8Array; width: number; height: number; mime: "image/webp" };

export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new PhotoError("Файл больше 4 МБ");
  const format = sniffFormat(input);
  if (!format) throw new PhotoError("Подходят только JPEG, PNG или WebP");
  try {
    const img = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await img.metadata();
    if (meta.format !== format) throw new PhotoError("Файл повреждён или это не изображение");
    const { data, info } = await img
      .rotate() // учесть поворот из EXIF, затем метаданные (в т. ч. геопозиция) отбрасываются
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height, mime: "image/webp" };
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    throw new PhotoError("Не удалось прочитать изображение");
  }
}

/** Сохранить загруженное фото (ещё без заявки). Заодно чистим старые неприкреплённые. */
export async function saveUpload(db: Db, img: ProcessedImage, now = new Date()): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(photos).values({
    id,
    data: img.data,
    mime: img.mime,
    width: img.width,
    height: img.height,
    size: img.data.byteLength,
  });
  await db.delete(photos).where(and(isNull(photos.orderId), lt(photos.createdAt, new Date(now.getTime() - UPLOAD_TTL_MS))));
  return { id };
}

/** Удалить ещё не прикреплённое фото (клиент передумал). */
export async function deleteUpload(db: Db, id: string): Promise<void> {
  await db.delete(photos).where(and(eq(photos.id, id), isNull(photos.orderId)));
}

/** Фото заявки — только при совпадении токена заявки. */
export async function getOrderPhotoByToken(db: Db, token: string, photoId: string) {
  const rows = await db
    .select({ data: photos.data, mime: photos.mime })
    .from(photos)
    .innerJoin(orders, eq(photos.orderId, orders.id))
    .where(and(eq(orders.token, token), eq(photos.id, photoId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPhotoById(db: Db, photoId: string) {
  const rows = await db
    .select({ data: photos.data, mime: photos.mime, orderId: photos.orderId })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listOrderPhotos(db: Db, orderId: number) {
  return db
    .select({ id: photos.id, width: photos.width, height: photos.height })
    .from(photos)
    .where(eq(photos.orderId, orderId))
    .orderBy(asc(photos.position));
}

export function imageResponse(data: Uint8Array, mime: string): Response {
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
