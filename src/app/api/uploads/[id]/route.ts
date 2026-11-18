import { z } from "zod";
import { getDb } from "@/server/db";
import { fail, forbiddenOrigin, isSameOrigin } from "@/server/http";
import { deleteUpload } from "@/server/photos";

// Удалить загруженное, но ещё не отправленное фото.
export async function DELETE(req: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return fail(404, "Не найдено");
  await deleteUpload(await getDb(), id);
  return new Response(null, { status: 204 });
}
