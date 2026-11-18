import { z } from "zod";
import { TOKEN_RE } from "@/lib/order";
import { getDb } from "@/server/db";
import { fail } from "@/server/http";
import { getOrderPhotoByToken, imageResponse } from "@/server/photos";

// Фото заявки для клиента: только вместе с секретным токеном этой заявки.
export async function GET(_req: Request, ctx: RouteContext<"/api/z/[token]/photos/[id]">) {
  const { token, id } = await ctx.params;
  if (!TOKEN_RE.test(token) || !z.uuid().safeParse(id).success) return fail(404, "Не найдено");
  const photo = await getOrderPhotoByToken(await getDb(), token, id);
  if (!photo) return fail(404, "Не найдено");
  return imageResponse(photo.data, photo.mime);
}
