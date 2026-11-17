import Link from "next/link";
import { CartLink } from "./CartBar";
import styles from "./Site.module.css";

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.logo}>
          {name}
        </Link>
        <nav className={styles.nav} aria-label="Разделы">
          <Link href="/#vybor">Рассчитать</Link>
          <Link href="/#uslugi" className={styles.navWide}>
            Цены
          </Link>
          <Link href="/#kontakty" className={styles.navWide}>
            Контакты
          </Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
