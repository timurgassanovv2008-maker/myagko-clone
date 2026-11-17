import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "64px 16px", textAlign: "center", display: "grid", gap: 14, justifyItems: "center" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Страница не найдена</h1>
      <p style={{ color: "var(--ink-2)", maxWidth: "30em" }}>
        Возможно, ссылка неполная. Если это ссылка на заявку — скопируйте её целиком из сообщения или браузера.
      </p>
      <Link href="/" className="btn btn-primary">
        На главную
      </Link>
    </main>
  );
}
