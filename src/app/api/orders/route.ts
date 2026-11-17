import { flattenIssues, orderNumber, orderRequestSchema } from "@/lib/order";
import { getDb } from "@/server/db";
import { clientIp, fail, forbiddenOrigin, isSameOrigin, json, tooMany } from "@/server/http";
import { createOrder, OrderInputError } from "@/server/orders";
import { hit, LIMITS } from "@/server/rate-limit";

// Приём заявки. Сервер сам проверяет данные и считает цену; повтор с тем же ключом — та же заявка.

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Некорректный запрос");
  }
  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) return fail(422, "Проверьте поля формы", flattenIssues(parsed.error.issues));

  const db = await getDb();
  // Повтор уже принятой заявки не считается в лимит — иначе ретрай после сбоя сети мог бы упереться в него.
  const { idempotencyKey } = parsed.data;
  const ip = clientIp(req);
  try {
    const repeat = await db.query.orders.findFirst({
      columns: { id: true, token: true },
      where: (o, { eq }) => eq(o.idempotencyKey, idempotencyKey),
    });
    if (!repeat && !(await hit(db, LIMITS.order, ip))) return tooMany();
    const order = repeat ? { ...repeat, created: false } : await createOrder(db, parsed.data);
    return json({ token: order.token, number: orderNumber(order.id), created: order.created }, order.created ? 201 : 200);
  } catch (e) {
    if (e instanceof OrderInputError) return fail(422, e.message, e.fieldErrors);
    throw e;
  }
}
