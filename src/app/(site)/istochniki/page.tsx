import type { Metadata } from "next";
import styles from "../text.module.css";

export const metadata: Metadata = { title: "Источники и лицензии" };

export default function SourcesPage() {
  return (
    <main className={`container ${styles.text}`}>
      <h1>Источники и лицензии</h1>
      <p className={styles.lead}>Что использовано на сайте и на каких условиях.</p>

      <h2>3D-модели и картинки мебели</h2>
      <p>
        Персонажи-мебель (диван, кресло, матрас, стул, пуф) и их постеры сделаны с нуля для этого сайта в Blender
        скриптом из исходников проекта. Сторонние модели, сканы, текстуры и шрифты не использовались. Права на модели
        принадлежат владельцу сайта; их можно использовать коммерчески и передавать вместе с исходниками.
      </p>
      <p>
        Инструменты: Blender (GPL — лицензия относится к программе, а не к созданным в ней файлам), gltf-transform (MIT)
        для сжатия моделей.
      </p>

      <h2>Программное обеспечение</h2>
      <ul>
        <li>Next.js, React — лицензия MIT</li>
        <li>three.js, React Three Fiber, Drei — лицензия MIT</li>
        <li>Drizzle ORM — лицензия Apache 2.0</li>
        <li>PGlite — лицензии Apache 2.0 / PostgreSQL</li>
        <li>sharp — лицензия Apache 2.0 (libvips — LGPL 3.0)</li>
        <li>zod — лицензия MIT</li>
      </ul>
    </main>
  );
}
