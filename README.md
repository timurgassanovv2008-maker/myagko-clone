# BLISS — выездная химчистка мягкой мебели

Веб-приложение: клиент выбирает мебель, видит примерную стоимость и оставляет заявку; владелец согласует цену и выезд в кабинете. Шаблон, который можно адаптировать под другую компанию.

- Задание: [`docs/PROMPT.md`](docs/PROMPT.md)
- Разбор и решения (формула цены, хранение, безопасность, порядок работы): [`docs/PLAN.md`](docs/PLAN.md)

## Статус

Ранняя стадия. Готово:

- каталог мебели и формула расчёта цены с тестами (`src/lib/pricing`);
- стартовая страница с услугами и ценами (демо-прайс), светлая и тёмная темы.

Пока **нет**: выбора мебели и корзины, оформления заявки, базы, кабинета, 3D. Заявки сайт не принимает.

## Валюта

Сейчас цены в тенге (₸). Чтобы перейти на турецкие лиры (₺), откройте `src/lib/company.ts` и замените

```ts
export const CURRENCY: CurrencyCode = "KZT";
```

на

```ts
export const CURRENCY: CurrencyCode = "TRY";
```

Демо-цены для обеих валют лежат в `src/lib/pricing/price-list.ts`.

## Запуск

Нужен Node.js 22 или новее.

```bash
npm install
npm run dev        # сайт на http://localhost:3000
```

Проверки:

```bash
npm test           # тесты формулы
npm run typecheck  # типы
npm run lint
npm run build      # сборка
```

## Стек

Next.js 16 (App Router), React 19, TypeScript, zod, Vitest. Дальше: Three.js + React Three Fiber, Motion, PostgreSQL (Drizzle).
