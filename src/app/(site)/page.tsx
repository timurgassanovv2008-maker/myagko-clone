import { CATEGORIES } from "@/lib/pricing/catalog";
import { formatMoney } from "@/lib/company";
import { getPublicSettings } from "@/server/public-settings";
import { Configurator } from "@/components/configurator/Configurator";
import { PickCategory } from "@/components/configurator/PickCategory";
import { Cart } from "@/components/cart/Cart";
import { CartBar } from "@/components/cart/CartBar";
import styles from "./page.module.css";

const STEPS = [
  { title: "Выберите мебель", text: "Диван, кресло, матрас или стулья — и сразу увидите примерную стоимость." },
  { title: "Оставьте заявку", text: "Адрес, удобное время и пара фото. Оплата не нужна." },
  { title: "Мастер приедет", text: "Созвонимся, подтвердим цену и время и почистим всё у вас дома." },
];

export default async function Home() {
  // Прайс и название — из настроек компании (кабинет → «Тарифы», «Компания»).
  const { company, prices } = await getPublicSettings();
  const money = (n: number) => formatMoney(n, company.currency);
  const fromPrice = (categoryId: string): string => {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    if (!cat || cat.variants.length === 0) return "По фото";
    return `от ${money(Math.min(...cat.variants.map((v) => prices.variants[v.id])))}`;
  };

  return (
    <div className={styles.page}>
      <main>
        <Configurator prices={prices} currency={company.currency}>
          <p className={styles.kicker}>
            {company.tagline}
            {company.city && ` · ${company.city}`}
          </p>
          <h1 className={styles.title}>Мягкая мебель снова чистая — не выходя из дома</h1>
          <p className={styles.lead}>
            Выберите, что почистить, и сразу увидите примерную стоимость. Мастер приедет со всем оборудованием.
          </p>
        </Configurator>

        <Cart prices={prices} currency={company.currency} />

        <section id="uslugi" className={styles.section}>
          <h2 className={styles.h2}>Услуги и цены</h2>
          <ul className={styles.services}>
            {CATEGORIES.map((c) => (
              <li key={c.id} className={styles.service}>
                <span className={styles.serviceTitle}>{c.title}</span>
                <span className={styles.serviceVariants}>
                  {c.variants.length > 0 ? c.variants.map((v) => v.title).join(" · ") : "Пуфы, банкетки, изголовья…"}
                </span>
                <span className={styles.servicePrice}>{fromPrice(c.id)}</span>
                <PickCategory category={c.id} className={styles.servicePick}>
                  Рассчитать
                </PickCategory>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Сильные загрязнения +{prices.heavySoilPercent}%. Вторая сторона матраса +{prices.mattressSecondSidePercent}%.
            Минимальный заказ на чистку — {money(prices.minOrder)}. Выезд за город +{money(prices.outOfTownFee)}. Итоговую
            цену мастер подтверждает после разговора.
          </p>
        </section>

        <section id="kak" className={styles.section}>
          <h2 className={styles.h2}>Как это работает</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.stepTitle}>{s.title}</span>
                <span className={styles.stepText}>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <CartBar prices={prices} currency={company.currency} />
    </div>
  );
}
