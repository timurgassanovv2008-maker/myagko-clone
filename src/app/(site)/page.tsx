import Link from "next/link";
import { CATEGORIES } from "@/lib/pricing/catalog";
import { formatMoney } from "@/lib/company";
import { getPublicSettings } from "@/server/public-settings";
import { Configurator } from "@/components/Configurator";
import { FurniturePoster } from "@/components/FurniturePoster";
import styles from "./page.module.css";

const STEPS = [
  { title: "Выберите мебель", text: "Диван, кресло, матрас или стулья — и сразу увидите примерную стоимость." },
  { title: "Оставьте заявку", text: "Адрес, удобное время и пара фото. Оплачивать заранее ничего не нужно." },
  { title: "Мастер приедет", text: "Созвонимся, подтвердим цену и время и почистим всё у вас дома." },
];

export default async function Home() {
  const { company, prices } = await getPublicSettings();
  const money = (n: number) => formatMoney(n, company.currency);
  const fromPrice = (id: string) => {
    const cat = CATEGORIES.find((c) => c.id === id)!;
    if (cat.variants.length === 0) return "По фото";
    return `от ${money(Math.min(...cat.variants.map((v) => prices.variants[v.id])))}`;
  };

  return (
    <main>
      <section className={`container ${styles.hero}`}>
        <p className={styles.kicker}>
          {company.tagline}
          {company.city && ` · ${company.city}`}
        </p>
        <h1 className={styles.title}>Мягкая мебель снова чистая — не выходя из дома</h1>
        <p className={styles.lead}>
          Выберите, что почистить, узнайте примерную стоимость за минуту и оставьте заявку. Мастер приедет со всем
          оборудованием.
        </p>
        <div className={styles.heroActions}>
          <a className="btn btn-primary btn-lg" href="#vybor">
            Рассчитать стоимость
          </a>
          <a className="btn btn-ghost btn-lg" href="#kak">
            Как это работает
          </a>
        </div>
      </section>

      <section id="vybor" className={`container ${styles.section} ${styles.picker}`} aria-labelledby="vybor-title">
        <h2 id="vybor-title" className="visually-hidden">
          Выбор мебели и расчёт стоимости
        </h2>
        <Configurator prices={prices} currency={company.currency} />
      </section>

      <section id="uslugi" className={`container ${styles.section}`}>
        <h2 className={styles.h2}>Услуги и цены</h2>
        <ul className={styles.services}>
          {CATEGORIES.map((c) => (
            <li key={c.id} className={styles.service}>
              <FurniturePoster category={c.id} className={styles.serviceArt} />
              <span className={styles.serviceTitle}>{c.title}</span>
              <span className={styles.serviceVariants}>
                {c.variants.length > 0 ? c.variants.map((v) => v.title).join(" · ") : "Пуфы, банкетки, изголовья…"}
              </span>
              <span className={`${styles.servicePrice} tabular`}>{fromPrice(c.id)}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Сильные загрязнения +{prices.heavySoilPercent}%. Вторая сторона матраса +{prices.mattressSecondSidePercent}%.
          Минимальный заказ на чистку — {money(prices.minOrder)}. Выезд за город +{money(prices.outOfTownFee)}. Итоговую
          цену мастер подтверждает после разговора.
        </p>
        <Link href="#vybor" className="btn btn-secondary">
          Выбрать мебель
        </Link>
      </section>

      <section id="kak" className={`container ${styles.section}`}>
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
  );
}
