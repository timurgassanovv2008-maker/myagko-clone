import Link from "next/link";
import { contactLinks, type Company } from "@/lib/company";
import styles from "./Site.module.css";

export function SiteFooter({ company }: { company: Company }) {
  const contacts = contactLinks(company);
  return (
    <footer className={styles.footer} id="kontakty">
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerCol}>
          <span className={styles.footerLogo}>{company.name}</span>
          <span>{company.tagline}</span>
          {company.area && <span>Выезжаем: {company.area}</span>}
          {company.hours && <span>{company.hours}</span>}
        </div>
        <div className={styles.footerCol}>
          <span className={styles.footerTitle}>Связаться</span>
          {contacts.length > 0 ? (
            contacts.map((c) => (
              <a key={c.kind} href={c.href} rel={c.kind === "phone" || c.kind === "email" ? undefined : "noopener"}>
                {c.label}
              </a>
            ))
          ) : (
            <span>Оставьте заявку — мы сами свяжемся с вами по указанному телефону.</span>
          )}
        </div>
        <div className={styles.footerCol}>
          <span className={styles.footerTitle}>Документы</span>
          <Link href="/politika">Политика конфиденциальности</Link>
          <Link href="/istochniki">Источники и лицензии</Link>
        </div>
      </div>
    </footer>
  );
}
