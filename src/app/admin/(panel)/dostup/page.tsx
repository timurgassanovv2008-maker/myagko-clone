import { requireAdmin } from "@/server/admin/auth";
import { logoutAction, logoutEverywhereAction } from "../../actions";
import { PasswordForm } from "./PasswordForm";
import styles from "../../admin.module.css";

export const metadata = { title: "Доступ" };

export default async function AccessPage() {
  await requireAdmin();
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Доступ</h1>
      <section className={`card ${styles.block}`}>
        <h2 className={styles.h2}>Смена пароля</h2>
        <p className="hint">После смены все остальные сеансы (другие телефоны и браузеры) закрываются.</p>
        <PasswordForm />
      </section>
      <section className={`card ${styles.block}`}>
        <h2 className={styles.h2}>Выход</h2>
        <div className={styles.contactRow}>
          <form action={logoutAction}>
            <button className="btn btn-secondary">Выйти</button>
          </form>
          <form action={logoutEverywhereAction}>
            <button className="btn btn-ghost">Выйти на всех устройствах</button>
          </form>
        </div>
      </section>
    </div>
  );
}
