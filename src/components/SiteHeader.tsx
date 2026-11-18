import Link from "next/link";
import { CartLink } from "./cart/CartLink";
import styles from "./Site.module.css";

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.logo}>
          {name}
        </Link>
        <nav className={styles.nav} aria-label="Разделы">
          <Link href="/#raschet">Расчёт</Link>
          <CartLink className={styles.cartLink} />
          <Link href="/#uslugi" className={styles.navWide}>
            Услуги
          </Link>
          <Link href="/#kontakty" className={styles.navWide}>
            Контакты
          </Link>
        </nav>
      </div>
    </header>
  );
}
