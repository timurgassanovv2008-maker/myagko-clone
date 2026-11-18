import { getDb } from "@/server/db";
import { clientIp, fail, forbiddenOrigin, isSameOrigin, json, tooMany } from "@/server/http";
import { MAX_UPLOAD_BYTES, PhotoError, processImage, saveUpload } from "@/server/photos";
import { hit, LIMITS } from "@/server/rate-limit";

// Загрузка одного фото до отправки заявки. Ответ — id, по которому фото прикрепляется к заявке.
// Само фото по этому id никто не откроет: показ — только через токен заявки или кабинет.

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "Файл больше 4 МБ");

  const db = await getDb();
  if (!(await hit(db, LIMITS.upload, clientIp(req)))) return tooMany();

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail(400, "Не удалось прочитать файл");
  }
  if (!(file instanceof File)) return fail(400, "Файл не получен");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "Файл больше 4 МБ");

  try {
    const img = await processImage(new Uint8Array(await file.arrayBuffer()));
    const { id } = await saveUpload(db, img);
    return json({ id, width: img.width, height: img.height }, 201);
  } catch (e) {
    if (e instanceof PhotoError) return fail(415, e.message);
    throw e;
  }
}
