import type { CategoryId } from "./pricing/catalog";

// Персонажи-мебель для 3D-сцены. Модели и постеры собираются в Blender
// (blender/build_characters.py), подробности — docs/ASSETS.md.

export type CharacterInfo = {
  /** GLB с клипами Idle, Blink, Wave и якорями anchor_bubble, anchor_face */
  model: string;
  /** постер 900×900: пока грузится 3D и если WebGL недоступен */
  poster: string;
  /** подпись к постеру */
  alt: string;
  /** как назвать выбор варианта */
  variantLabel: string;
  /** масштаб в сцене относительно «вписать в шар»: плоскому матрасу нужно крупнее, высокому стулу — мельче */
  fit: number;
  /** подъём над общей линией пола и точки реплики (в единицах сцены) — для плоских предметов */
  lift?: number;
  bubbleLift?: number;
  /** короткие реплики-приветствия; одна случайная при появлении */
  phrases: string[];
};

export const CHARACTERS: Record<CategoryId, CharacterInfo> = {
  sofa: {
    model: "/models/sofa.glb",
    poster: "/posters/sofa.webp",
    alt: "Зелёный диван с улыбающимся лицом на спинке машет рукой",
    variantLabel: "Размер",
    fit: 1.08,
    phrases: [
      "Привет! Пятно от кофе? Уберём.",
      "Я диван. Хочу снова быть свежим!",
      "После чистки на мне снова приятно сидеть.",
    ],
  },
  armchair: {
    model: "/models/armchair.glb",
    poster: "/posters/armchair.webp",
    alt: "Терракотовое кресло с улыбающимся лицом на спинке",
    variantLabel: "Тип",
    fit: 0.98,
    phrases: [
      "Привет! Любимое кресло тоже устаёт.",
      "Обычное или реклайнер — почистим оба.",
      "Подлокотники — моё слабое место.",
    ],
  },
  mattress: {
    model: "/models/mattress.glb",
    poster: "/posters/mattress.webp",
    alt: "Стёганый матрас с лицом на боковой ленте",
    variantLabel: "Размер",
    fit: 1.1,
    lift: 0.26,
    bubbleLift: 0.3,
    phrases: [
      "Привет! Можно почистить и вторую сторону.",
      "На мне спят каждую ночь. Пора освежиться.",
      "Чистый матрас — спокойный сон.",
    ],
  },
  chair: {
    model: "/models/chair.glb",
    poster: "/posters/chair.webp",
    alt: "Деревянный стул с горчичной обивкой и лицом на спинке",
    variantLabel: "Что чистить",
    fit: 0.86,
    phrases: [
      "Привет! Сколько нас у вас за столом?",
      "Сиденье или со спинкой — выберите ниже.",
      "Стулья любят компанию. Посчитаем все?",
    ],
  },
  other: {
    model: "/models/other.glb",
    poster: "/posters/other.webp",
    alt: "Круглый сиреневый пуф с лицом",
    variantLabel: "Вариант",
    fit: 0.95,
    phrases: [
      "Пуф, банкетка, изголовье? Оценим по фото.",
      "Не нашли свою мебель? Опишите её — мастер подскажет.",
    ],
  },
};
