import { redirect } from "next/navigation";
import { getSession, envPassword, DEV_PASSWORD } from "@/server/admin/auth";
import { readSetting } from "@/server/settings";
import { getDb } from "@/server/db";
import { LoginForm } from "./LoginForm";
import styles from "../admin.module.css";

export const metadata = { title: "Вход" };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  const db = await getDb();
  const hasStored = Boolean(await readSetting(db, "admin:password"));
  const fallback = envPassword();
  const notConfigured = !hasStored && !fallback;
  const devHint = !hasStored && fallback === DEV_PASSWORD;

  return (
    <main className={styles.loginPage}>
      <div className={`card ${styles.loginCard}`}>
        <h1 className={styles.loginTitle}>Кабинет владельца</h1>
        {notConfigured ? (
          <p className="notice notice-warn">
            Пароль не настроен. Задайте переменную окружения <code>ADMIN_PASSWORD</code> (не короче 8 символов) и
            перезапустите сайт.
          </p>
        ) : (
          <LoginForm />
        )}
        {devHint && (
          <p className="hint">
            Режим разработки: пароль <code>{DEV_PASSWORD}</code>. На хостинге задайте <code>ADMIN_PASSWORD</code>.
          </p>
        )}
      </div>
    </main>
  );
}
