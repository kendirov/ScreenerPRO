export type AcademyLessonStatus = "live" | "next" | "planned";

export type AcademyLesson = {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration: string;
  level: "База" | "Практика" | "Продвинутый";
  status: AcademyLessonStatus;
  practiceHref?: string;
  practiceLabel?: string;
};

export type AcademyModule = {
  id: string;
  index: string;
  title: string;
  description: string;
  outcome: string;
  lessons: AcademyLesson[];
};

export const academyModules: AcademyModule[] = [
  {
    id: "market-vision",
    index: "01",
    title: "Видеть рынок",
    description:
      "Научиться быстро находить инструменты, где сегодня действительно есть деньги, движение и условия для сделки.",
    outcome: "За 30–60 секунд собрать рабочий список вместо просмотра сотен тикеров.",
    lessons: [
      {
        id: "diapazon-i-oborot",
        slug: "diapazon-i-oborot",
        title: "Диапазон и оборот",
        description:
          "Где рынок реально прошёл расстояние и где реально прошли деньги.",
        duration: "6 мин",
        level: "База",
        status: "live",
        practiceHref: "/screener/stocks",
        practiceLabel: "Открыть скринер акций",
      },
    ],
  },
  {
    id: "execution",
    index: "02",
    title: "Читать микроструктуру",
    description:
      "Стакан, лента, аукцион и поток заявок — язык, на котором видно качество движения.",
    outcome: "Отличать импульс с поддержкой потока от тонкого движения и случайного шума.",
    lessons: [
      {
        id: "market-microstructure-moex",
        slug: "market-microstructure-moex",
        title: "Микроструктура MOEX",
        description:
          "Практический вводный урок о потоке заявок, режимах и аукционном контексте.",
        duration: "12 мин",
        level: "Практика",
        status: "live",
        practiceHref: "/lab/orderflow-simulator",
        practiceLabel: "Открыть привод-симулятор",
      },
    ],
  },
  {
    id: "relationships",
    index: "03",
    title: "Связывать рынки",
    description:
      "Фьючерс, базовый актив, индекс и валюта дают контекст друг другу.",
    outcome: "Понимать, какой рынок ведёт движение и где расхождение становится рабочим сигналом.",
    lessons: [
      {
        id: "futures-basis-and-carry",
        slug: "futures-basis-and-carry",
        title: "Базис и перенос во фьючерсах",
        description:
          "Как читать базис и переводить его из абстрактной цифры в торговый контекст.",
        duration: "10 мин",
        level: "Продвинутый",
        status: "live",
        practiceHref: "/screener/futures",
        practiceLabel: "Открыть фьючерсы",
      },
    ],
  },
  {
    id: "preparation",
    index: "04",
    title: "Собрать сценарий",
    description:
      "Контекст → инструмент → WHY NOW → триггер → отмена сценария.",
    outcome: "Перед открытием рынка иметь короткий список сценариев, а не набор новостей.",
    lessons: [
      {
        id: "session-preparation",
        slug: "session-preparation",
        title: "Подготовка к торговой сессии",
        description:
          "Следующий модуль строится на TQS Preparation и реальных рыночных кейсах.",
        duration: "15 мин",
        level: "Практика",
        status: "next",
        practiceHref: "/lab/preparation",
        practiceLabel: "Открыть TQS Preparation",
      },
    ],
  },
];

export const academyPracticeSurfaces = [
  {
    href: "/screener/stocks",
    eyebrow: "LIVE MARKET",
    title: "Скринер акций",
    text: "После урока найти диапазон, оборот и активность на реальном рынке.",
  },
  {
    href: "/lab/orderflow-simulator",
    eyebrow: "SIMULATION",
    title: "Привод-симулятор",
    text: "Без риска разобрать стакан, ленту, footprint и последовательность событий.",
  },
  {
    href: "/lab/preparation",
    eyebrow: "WORKFLOW",
    title: "Подготовка",
    text: "Собрать фокус, события, драйверы и порядок разбора перед торговой сессией.",
  },
] as const;

export const academyPrinciples = [
  {
    title: "Понять через действие",
    text: "Короткая сцена объясняет механику, затем ученик открывает связанный инструмент TQS и проверяет её руками.",
  },
  {
    title: "Один канон знаний",
    text: "Уроки собираются из тех же наблюдений, кейсов и исследований, которые живут в Trading QS.",
  },
  {
    title: "Реальные кейсы важнее слайдов",
    text: "Сильный урок показывает ситуацию, решение, ошибку, результат и то, что переносится в следующий эпизод.",
  },
] as const;

export const liveAcademyLessons = academyModules.flatMap((module) =>
  module.lessons.filter((lesson) => lesson.status === "live"),
);
