import Link from "next/link";
import { requireAdmin } from "@/server/admin/auth";
import { countNew } from "@/server/admin/orders";
import { getCompany } from "@/server/settings";
import { AdminNav } from "./AdminNav";
import styles from "../admin.module.css";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const db = await requireAdmin();
  const [company, fresh] = await Promise.all([getCompany(db), countNew(db)]);
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <Link href="/admin" className={styles.brand}>
            {company.name} <span>кабинет</span>
          </Link>
          <Link href="/" className={styles.toSite} target="_blank">
            Сайт ↗
          </Link>
        </div>
        <AdminNav newCount={fresh} />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
