import { CATEGORIES } from "@/lib/pricing/catalog";
import { DEMO_PRICE_LIST } from "@/lib/pricing/price-list";
import { DEMO_COMPANY, formatMoney } from "@/lib/company";
import { Configurator } from "@/components/configurator/Configurator";
import { PickCategory } from "@/components/configurator/PickCategory";
import { Cart } from "@/components/cart/Cart";
import { CartBar } from "@/components/cart/CartBar";
import { CartLink } from "@/components/cart/CartLink";
import styles from "./page.module.css";

const company = DEMO_COMPANY;
const prices = DEMO_PRICE_LIST;

function fromPrice(categoryId: string): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat || cat.variants.length === 0) return "По фото";
  const min = Math.min(...cat.variants.map((v) => prices.variants[v.id]));
  return `от ${formatMoney(min, company.currency)}`;
}

const STEPS = [
  { title: "Выберите мебель", text: "Диван, кресло, матрас или стулья — и сразу увидите примерную стоимость." },
  { title: "Оставьте заявку", text: "Адрес, удобное время и пара фото. Оплата не нужна." },
  { title: "Мастер приедет", text: "Созвонимся, подтвердим цену и время и почистим всё у вас дома." },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>{company.name}</span>
        <nav className={styles.nav} aria-label="Разделы">
          <a href="#raschet">Расчёт</a>
          <CartLink />
          <a href="#uslugi">Услуги</a>
          <a href="#kak" className={styles.navWide}>
            Как это работает
          </a>
        </nav>
      </header>

      <main>
        <Configurator prices={prices} currency={company.currency}>
          <p className={styles.kicker}>{company.tagline}</p>
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
            Сильные загрязнения +{prices.heavySoilPercent}%. Минимальный заказ{" "}
            {formatMoney(prices.minOrder, company.currency)}. Выезд за город +
            {formatMoney(prices.outOfTownFee, company.currency)}. Итоговую цену мастер подтверждает после разговора.
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

      <footer className={styles.footer}>
        <span>© {company.name}</span>
        <span className={styles.footerNote}>Сайт в разработке: заявки пока не принимаются.</span>
      </footer>

      <CartBar prices={prices} currency={company.currency} />
    </div>
  );
}
