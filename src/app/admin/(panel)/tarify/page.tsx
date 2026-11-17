import { requireAdmin } from "@/server/admin/auth";
import { getPriceList } from "@/server/settings";
import { CATEGORIES } from "@/lib/pricing/catalog";
import { CURRENCIES } from "@/lib/currency";
import { CURRENCY } from "@/lib/company";
import { savePricesAction } from "../../actions";
import { SettingsForm } from "../SettingsForm";
import styles from "../../admin.module.css";

export const metadata = { title: "Тарифы" };

export default async function PricesPage() {
  const db = await requireAdmin();
  const p = await getPriceList(db);
  const cur = CURRENCIES[CURRENCY].symbol;
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Тарифы</h1>
      <p className="hint">
        Цены в {CURRENCIES[CURRENCY].name}, целыми числами. Новые цены действуют для новых заявок — в уже отправленных
        сохраняются условия на момент отправки.
      </p>
      <SettingsForm
        action={savePricesAction}
        submitLabel="Сохранить цены"
        groups={[
          ...CATEGORIES.filter((c) => c.variants.length > 0).map((c) => ({
            title: c.title,
            fields: c.variants.map((v) => ({
              name: `variant.${v.id}`,
              label: v.title,
              type: "number" as const,
              suffix: cur,
              defaultValue: String(p.variants[v.id]),
            })),
          })),
          {
            title: "Доплаты и минимум",
            note: "Порядок расчёта: цена × количество, затем надбавки в процентах (складываются), округление строки до 10. Минимальный заказ — только на чистку, выезд за город добавляется после.",
            fields: [
              { name: "minOrder", label: "Минимальный заказ на чистку", type: "number", suffix: cur, defaultValue: String(p.minOrder) },
              { name: "heavySoilPercent", label: "Сильные загрязнения", type: "number", suffix: "%", defaultValue: String(p.heavySoilPercent) },
              {
                name: "mattressSecondSidePercent",
                label: "Вторая сторона матраса",
                type: "number",
                suffix: "%",
                defaultValue: String(p.mattressSecondSidePercent),
              },
              { name: "outOfTownFee", label: "Выезд за город", type: "number", suffix: cur, defaultValue: String(p.outOfTownFee) },
            ],
          },
        ]}
      />
    </div>
  );
}
