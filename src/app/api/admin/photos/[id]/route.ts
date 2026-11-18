import { z } from "zod";
import { getSession } from "@/server/admin/auth";
import { fail } from "@/server/http";
import { getPhotoById, imageResponse } from "@/server/photos";

// Фото заявки для владельца — только с действующим сеансом кабинета.
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/photos/[id]">) {
  const session = await getSession();
  if (!session) return fail(401, "Нужен вход в кабинет");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return fail(404, "Не найдено");
  const photo = await getPhotoById(session.db, id);
  if (!photo || photo.orderId === null) return fail(404, "Не найдено");
  return imageResponse(photo.data, photo.mime);
}
