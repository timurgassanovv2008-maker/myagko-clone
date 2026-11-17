import { NextResponse, type NextRequest } from "next/server";

// Быстрый серверный редирект на вход, если cookie сеанса нет вовсе.
// Настоящая проверка сеанса — в requireAdmin() на каждой странице и в каждом действии кабинета.
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin/login")) return NextResponse.next();
  if (!req.cookies.has("bliss_admin")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
