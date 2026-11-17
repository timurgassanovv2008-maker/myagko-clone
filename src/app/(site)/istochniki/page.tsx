import type { Metadata } from "next";
import styles from "../text.module.css";

export const metadata: Metadata = { title: "Источники и лицензии" };

export default function SourcesPage() {
  return (
    <main className={`container ${styles.text}`}>
      <h1>Источники и лицензии</h1>
      <p className={styles.lead}>Что использовано на сайте и на каких условиях.</p>

      <h2>Иллюстрации мебели</h2>
      <p>Нарисованы для этого проекта, входят в исходный код сайта.</p>

      <h2>3D-модели</h2>
      <p>Появятся в следующей версии. Здесь будут перечислены источники моделей и их лицензии.</p>

      <h2>Программное обеспечение</h2>
      <ul>
        <li>Next.js, React — лицензия MIT</li>
        <li>Drizzle ORM — лицензия Apache 2.0</li>
        <li>PGlite — лицензии Apache 2.0 / PostgreSQL</li>
        <li>sharp — лицензия Apache 2.0 (libvips — LGPL 3.0)</li>
        <li>zod — лицензия MIT</li>
      </ul>
    </main>
  );
}
