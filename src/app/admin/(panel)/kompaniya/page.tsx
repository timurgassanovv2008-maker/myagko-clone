import { requireAdmin } from "@/server/admin/auth";
import { PHONE_EXAMPLE } from "@/lib/company";
import { getCompany } from "@/server/settings";
import { saveCompanyAction } from "../../actions";
import { SettingsForm } from "../SettingsForm";
import styles from "../../admin.module.css";

export const metadata = { title: "Компания" };

export default async function CompanyPage() {
  const db = await requireAdmin();
  const c = await getCompany(db);
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Компания</h1>
      <SettingsForm
        action={saveCompanyAction}
        groups={[
          {
            title: "Название и город",
            fields: [
              { name: "name", label: "Название", defaultValue: c.name },
              { name: "tagline", label: "Короткое описание", defaultValue: c.tagline },
              { name: "city", label: "Город", defaultValue: c.city, placeholder: "Ваш город" },
              { name: "area", label: "Территория выезда", defaultValue: c.area, placeholder: "Город и пригород до 30 км" },
              { name: "hours", label: "Часы работы", defaultValue: c.hours, placeholder: "Ежедневно 9:00–21:00" },
            ],
          },
          {
            title: "Контакты",
            note: "Показываются на сайте только заполненные. Пустые поля не превращаются в заглушки.",
            fields: [
              { name: "phone", label: "Телефон", type: "tel", defaultValue: c.phone, placeholder: PHONE_EXAMPLE },
              { name: "whatsapp", label: "WhatsApp", type: "tel", defaultValue: c.whatsapp, placeholder: PHONE_EXAMPLE },
              { name: "telegram", label: "Telegram", defaultValue: c.telegram, placeholder: "@username" },
              { name: "email", label: "E-mail", type: "email", defaultValue: c.email },
            ],
          },
          {
            title: "Оформление",
            fields: [
              {
                name: "accent",
                label: "Акцентный цвет",
                defaultValue: c.accent,
                placeholder: "#2f5d50",
                hint: "Цвет кнопок и выделений в формате #RRGGBB. Пусто — фирменный зелёный. Логотип и полная палитра меняются в исходниках.",
              },
            ],
          },
        ]}
      />
    </div>
  );
}
