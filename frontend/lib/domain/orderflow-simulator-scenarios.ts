import type { SimScenarioName, SimSide } from "./orderflow-simulator";

export type ScenarioStepAction =
  | "addLimitBid"
  | "addLimitAsk"
  | "marketBuy"
  | "marketSell"
  | "cancelLimit"
  | "replenishIceberg"
  | "setupIceberg"
  | "setupMarketMakerGrid"
  | "annotation";

export type ScenarioAnnotationKind =
  | "large-order"
  | "large-bid-density"
  | "large-ask-density"
  | "hit-bid"
  | "hit-ask"
  | "level-held"
  | "level-broken"
  | "volume-replenished"
  | "possible-iceberg"
  | "iceberg-refill"
  | "density-pulled"
  | "mm-grid";

/** Структурированные строки журнала сценария */
export type ScenarioJournalDetail = {
  appeared?: string;
  aggressor?: string;
  levelOutcome?: string;
  watchBook?: string;
};

export type ScenarioStep = {
  atTick: number;
  action: ScenarioStepAction;
  payload: Record<string, unknown>;
  explanation: string;
  watchHint?: string;
  whyImportant?: string;
  journal?: ScenarioJournalDetail;
};

export type OrderflowScenario = {
  id: SimScenarioName;
  title: string;
  description: string;
  learningGoal: string;
  /** Условная стартовая цена для урока */
  initialPrice?: number;
  steps: ScenarioStep[];
};

/** Сценарии в полосе «Сценарии» (учебные модели стакана) */
export const LESSON_SCENARIO_IDS: SimScenarioName[] = [
  "large-bid-bounce",
  "breakdown",
  "large-ask-rejection",
  "iceberg-buy",
  "market-maker-grid",
  "density-pulled",
  "absorption",
];

export const ORDERFLOW_SCENARIOS: OrderflowScenario[] = [
  {
    id: "calm",
    title: "Спокойный рынок",
    description: "Небольшие сделки в обе стороны — стакан живёт без явного уровня.",
    learningGoal: "Увидеть обычный фон: мелкие принты, смена bid/ask без доминирующей плотности.",
    initialPrice: 123.34,
    steps: [
      {
        atTick: 0,
        action: "annotation",
        payload: { label: "спокойный фон", kind: "large-order" },
        explanation: "Старт: рынок без крупных плотностей — только мелкий поток.",
        watchHint: "Ленту и объёмы внизу графика.",
        whyImportant: "Отличать фон от ситуации с явным уровнем.",
      },
      { atTick: 1, action: "marketBuy", payload: { size: 80 }, explanation: "Небольшая рыночная покупка — ask чуть проседает." },
      { atTick: 2, action: "marketSell", payload: { size: 60 }, explanation: "Небольшая продажа — цена возвращается." },
      { atTick: 3, action: "marketBuy", payload: { size: 100 }, explanation: "Ещё покупка — движение минимальное." },
      { atTick: 4, action: "marketSell", payload: { size: 90 }, explanation: "Продажа в ответ — баланс сохраняется." },
      { atTick: 5, action: "marketBuy", payload: { size: 70 }, explanation: "Поток остаётся двусторонним." },
      { atTick: 6, action: "marketSell", payload: { size: 110 }, explanation: "Нет уровня, который бы всё удерживал — цена дрейфует." },
    ],
  },
  {
    id: "large-bid-bounce",
    title: "Крупная bid-плотность",
    description:
      "На 123.00 bid ~20K: сверху мелкие заявки, продажи бьют в плотность, уровень держат — отскок. Учебная модель.",
    learningGoal:
      "Увидеть крупную bid-плотность, удары продавцов в ленте и удержание уровня — без обещания отскока на MOEX.",
    initialPrice: 123.08,
    steps: [
      {
        atTick: 0,
        action: "addLimitBid",
        payload: { price: 123.0, size: 20_000, large: true },
        explanation: "На 123.00 появилась крупная bid-плотность ~20 000 лотов.",
        watchHint: "Янтарный bid-bar на 123.00.",
        whyImportant: "Плотность — зона, где агрессивные продажи встречают лимитного покупателя.",
        journal: {
          appeared: "Bid 20K на 123.00",
          watchBook: "Янтарная подсветка и ширина bid-bar",
        },
      },
      {
        atTick: 0,
        action: "addLimitBid",
        payload: { price: 123.06, size: 2200 },
        explanation: "Выше плотности — обычные заявки 500–2500 лотов (модель).",
        journal: { appeared: "Мелкие bid выше 123.00", watchBook: "Тонкие строки над плотностью" },
      },
      {
        atTick: 0,
        action: "addLimitBid",
        payload: { price: 123.1, size: 900 },
        explanation: "Ещё один уровень ликвидности над крупной плотностью.",
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.0, label: "крупная bid-плотность", kind: "large-bid-density" },
        explanation: "Подпись: крупная bid-плотность на 123.00.",
        journal: { watchBook: "Подпись у янтарного уровня" },
      },
      {
        atTick: 2,
        action: "marketSell",
        payload: { size: 3500 },
        explanation: "Рыночные продажи ударили в bid 123.00 — объём частично съедается.",
        watchHint: "Красные пузыри в ленте на цене 123.00.",
        journal: {
          aggressor: "Продавцы (рыночные продажи)",
          levelOutcome: "Плотность частично исполнена, цена пока не ниже 123.00",
          watchBook: "Лента + остаток bid-bar",
        },
      },
      {
        atTick: 3,
        action: "marketSell",
        payload: { size: 4200 },
        explanation: "Вторая волна продаж — bid ещё держит, лента снова красная на 123.00.",
        journal: {
          aggressor: "Продавцы",
          levelOutcome: "Уровень всё ещё держит",
          watchBook: "Серия красных принтов на одной цене",
        },
      },
      {
        atTick: 4,
        action: "annotation",
        payload: { price: 123.0, label: "уровень удержали", kind: "level-held" },
        explanation: "Плотность удержали — цена не закрепилась ниже 123.00.",
        journal: {
          levelOutcome: "Удержание — отскок возможен в модели",
          watchBook: "Остаток крупного bid",
        },
      },
      {
        atTick: 5,
        action: "marketBuy",
        payload: { size: 2800 },
        explanation: "Покупки от зоны bid — цена отскакивает вверх (симуляция).",
        watchHint: "Зелёные принты, рост цены от 123.00.",
        journal: {
          aggressor: "Покупатели",
          levelOutcome: "Отскок от удержанной плотности",
          watchBook: "Лента и строка текущей цены",
        },
      },
    ],
  },
  {
    id: "breakdown",
    title: "Пробой bid",
    description: "Тот же 123.00: плотность съедают полностью — пробой и ускорение вниз. Пара к сценарию bid-плотности.",
    learningGoal: "Сравнить удержание и пробой одной зоны — учебная модель, не торговый сигнал.",
    initialPrice: 123.05,
    steps: [
      {
        atTick: 0,
        action: "addLimitBid",
        payload: { price: 123.0, size: 20_000, large: true },
        explanation: "Снова крупная bid-плотность 20K на 123.00.",
        journal: { appeared: "Bid 20K на 123.00", watchBook: "Янтарный bid-bar" },
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.0, label: "крупная bid-плотность", kind: "large-bid-density" },
        explanation: "Следим за полным исполнением плотности.",
      },
      {
        atTick: 2,
        action: "marketSell",
        payload: { size: 8000 },
        explanation: "Первая крупная волна продаж в плотность.",
        journal: { aggressor: "Продавцы", watchBook: "Красная лента на 123.00" },
      },
      {
        atTick: 3,
        action: "marketSell",
        payload: { size: 14_000 },
        explanation: "Плотность съели — 123.00 пробили.",
        watchHint: "Bid-bar исчез или почти пуст.",
        journal: {
          aggressor: "Продавцы",
          levelOutcome: "Пробой — ликвидность исчерпана",
          watchBook: "Пустой bid на 123.00",
        },
      },
      {
        atTick: 4,
        action: "annotation",
        payload: { price: 123.0, label: "уровень пробили", kind: "level-broken" },
        explanation: "Подпись: уровень пробили.",
        journal: { levelOutcome: "Цена ниже 123.00" },
      },
      {
        atTick: 5,
        action: "marketSell",
        payload: { size: 4500 },
        explanation: "Импульс ниже пробитого уровня — быстрый ход вниз (модель).",
        journal: { aggressor: "Продавцы", watchBook: "Лента ниже 123.00" },
      },
    ],
  },
  {
    id: "large-ask-rejection",
    title: "Крупная ask-плотность",
    description: "Ask ~20K на 123.80: покупки бьют в уровень, вспышки исполнения, удержание или отбой.",
    learningGoal: "Зеркало bid: крупная ask-плотность и зелёная лента покупок — модель, не рекомендация.",
    initialPrice: 123.62,
    steps: [
      {
        atTick: 0,
        action: "addLimitAsk",
        payload: { price: 123.8, size: 20_000, large: true },
        explanation: "На 123.80 появилась крупная ask-плотность ~20 000 лотов.",
        watchHint: "Янтарный ask-bar.",
        journal: { appeared: "Ask 20K на 123.80", watchBook: "Янтарная строка ask" },
      },
      {
        atTick: 0,
        action: "addLimitAsk",
        payload: { price: 123.72, size: 1800 },
        explanation: "Ниже крупной плотности — обычные ask 500–2000 лотов.",
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.8, label: "крупная ask-плотность", kind: "large-ask-density" },
        explanation: "Подпись у крупной ask-плотности.",
      },
      {
        atTick: 2,
        action: "marketBuy",
        payload: { size: 4000 },
        explanation: "Рыночные покупки бьют в ask 123.80 — вспышка исполнения.",
        watchHint: "Зелёные пузыри на 123.80, dom-hit на ask.",
        journal: {
          aggressor: "Покупатели",
          levelOutcome: "Частичное исполнение ask",
          watchBook: "Лента + вспышка строки ask",
        },
      },
      {
        atTick: 3,
        action: "marketBuy",
        payload: { size: 4500 },
        explanation: "Вторая волна покупок — плотность ещё держит.",
        journal: { aggressor: "Покупатели", levelOutcome: "Уровень держит", watchBook: "Зелёная цепочка пузырей" },
      },
      {
        atTick: 4,
        action: "annotation",
        payload: { price: 123.8, label: "уровень удержали", kind: "level-held" },
        explanation: "Ask удержали — цена не закрепилась выше 123.80.",
        journal: { levelOutcome: "Удержание ask-плотности" },
      },
      {
        atTick: 5,
        action: "marketSell",
        payload: { size: 2200 },
        explanation: "Откат после отбоя от ask (модель).",
        journal: { aggressor: "Продавцы", watchBook: "Красные принты ниже 123.80" },
      },
    ],
  },
  {
    id: "iceberg-buy",
    title: "Айсберг bid",
    description: "Видимый bid 2K, скрытый 30K: после продаж объём по 2K восстанавливается, цена не уходит ниже.",
    learningGoal: "Айсберг: метка ice, восстановление visible, счётчик скрытого исполнения — учебная модель.",
    initialPrice: 123.16,
    steps: [
      {
        atTick: 0,
        action: "setupIceberg",
        payload: { price: 123.14, side: "bid", visibleSize: 2000, hiddenSize: 30_000, refillSize: 2000 },
        explanation: "Айсберг bid: видимо 2 000 лотов, скрытый резерв 30 000.",
        watchHint: "Фиолетовый контур, метка «i» / ice.",
        journal: { appeared: "Видимый bid 2K + скрытый 30K", watchBook: "Контур айсберга на bid" },
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.14, label: "айсберг bid", kind: "possible-iceberg" },
        explanation: "Уровень помечен как айсберг.",
      },
      {
        atTick: 2,
        action: "marketSell",
        payload: { size: 2000 },
        explanation: "Продажи съели видимый 2K — bid восстановится из скрытого.",
        journal: {
          aggressor: "Продавцы",
          watchBook: "Красная лента на одной цене",
        },
      },
      {
        atTick: 3,
        action: "marketSell",
        payload: { size: 2000 },
        explanation: "Снова продажи по 123.14 — видимый объём снова 2K.",
        journal: {
          aggressor: "Продавцы",
          levelOutcome: "Цена не проходит ниже — уровень «живой»",
          watchBook: "Восстановление bid-bar",
        },
      },
      {
        atTick: 4,
        action: "replenishIceberg",
        payload: { price: 123.14, side: "bid" },
        explanation: "Подпись: видимый объём восстановился. Смотрите счётчик исполненного скрытого объёма в подсказке уровня.",
        watchHint: "Стакан: снова 2K на bid, фиолетовая пульсация.",
        journal: {
          levelOutcome: "Видимый объём восстановлен из скрытого",
          watchBook: "Метка ice и ширина bid",
        },
      },
      {
        atTick: 5,
        action: "marketSell",
        payload: { size: 2000 },
        explanation: "Четвёртая волна — лента снова красная на 123.14, цена удерживается.",
        journal: {
          aggressor: "Продавцы",
          levelOutcome: "Абсорбция продаж на айсберге (модель)",
          watchBook: "Лента + инспектор / tooltip уровня",
        },
      },
    ],
  },
  {
    id: "absorption",
    title: "Абсорбция",
    description: "Много продаж в bid, цена не уходит — красные кластера, восстановление объёма. Учебная модель.",
    learningGoal: "Абсорбция: агрессивные продажи без падения цены — не гарантия разворота на MOEX.",
    initialPrice: 123.22,
    steps: [
      {
        atTick: 0,
        action: "addLimitBid",
        payload: { price: 123.2, size: 12_000, large: true },
        explanation: "Крупный bid на 123.20 — зона поглощения продаж.",
        journal: { appeared: "Толстый bid 123.20", watchBook: "Янтарный bid-bar" },
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.2, label: "зона абсорбции", kind: "large-bid-density" },
        explanation: "Уровень отмечен для разбора абсорбции.",
      },
      {
        atTick: 2,
        action: "marketSell",
        payload: { size: 3500 },
        explanation: "Волна продаж — красная лента, цена у 123.20.",
        journal: {
          aggressor: "Продавцы",
          levelOutcome: "Цена не уходит далеко вниз",
          watchBook: "Лента + кластер",
        },
      },
      {
        atTick: 3,
        action: "marketSell",
        payload: { size: 4000 },
        explanation: "Ещё продажи — bid подставляет объём.",
        journal: { aggressor: "Продавцы", watchBook: "Серия красных пузырей" },
      },
      {
        atTick: 4,
        action: "marketSell",
        payload: { size: 3200 },
        explanation: "Третья волна — абсорбция в модели: много sell, узкий ход цены.",
        journal: {
          levelOutcome: "Поглощение агрессии лимитным bid",
          watchBook: "Стакан: bid остаётся толстым",
        },
      },
      {
        atTick: 5,
        action: "addLimitBid",
        payload: { price: 123.2, size: 4000 },
        explanation: "Объём на уровне восстановили — «кормят» bid.",
        journal: { appeared: "Дополнительный bid", levelOutcome: "Восстановление плотности" },
      },
      {
        atTick: 6,
        action: "annotation",
        payload: { price: 123.2, label: "абсорбция", kind: "volume-replenished" },
        explanation: "Подпись: объём восстановился после серии продаж.",
        journal: { watchBook: "Сравните ленту и остаток bid" },
      },
    ],
  },
  {
    id: "market-maker-grid",
    title: "Маркетмейкерская сетка",
    description: "Симметричные заявки вокруг спреда, равномерная плотность — модель поддержки ликвидности.",
    learningGoal:
      "Маркетмейкер выставляет ликвидность по обе стороны цены. При движении сетка в симуляции переставляется.",
    initialPrice: 123.34,
    steps: [
      {
        atTick: 0,
        action: "setupMarketMakerGrid",
        payload: {},
        explanation:
          "Маркетмейкерская сетка: заявки симметрично от лучшего bid/ask, метки MM.",
        watchHint: "Маленькие «MM» у строк, равномерные объёмы.",
        journal: {
          appeared: "Сетка bid/ask вокруг спреда",
          watchBook: "Метки MM и симметрия от best bid/ask",
        },
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { label: "сетка MM", kind: "mm-grid" },
        explanation:
          "Маркетмейкер поддерживает ликвидность, выставляя заявки по обе стороны цены. Это учебная модель, не реальная котировка.",
        whyImportant: "Равноудалённые уровни от спреда часто связаны с MM — не всегда «крупный игрок».",
      },
      {
        atTick: 2,
        action: "marketBuy",
        payload: { size: 1200 },
        explanation: "Покупки снимают ближний ask — сетка может переставиться при следующем тике симуляции.",
        journal: { aggressor: "Покупатели", watchBook: "Сдвиг best ask" },
      },
      {
        atTick: 3,
        action: "marketSell",
        payload: { size: 1100 },
        explanation: "Продажи — симметричный ответ сетки в модели.",
        journal: { aggressor: "Продавцы", watchBook: "Bid/ask вокруг новой цены" },
      },
      {
        atTick: 4,
        action: "setupMarketMakerGrid",
        payload: {},
        explanation: "Сетка переставлена вокруг текущей цены (симуляция).",
        journal: {
          levelOutcome: "MM-уровни снова симметричны от спреда",
          watchBook: "Метки MM на новых строках",
        },
      },
    ],
  },
  {
    id: "density-pulled",
    title: "Снятие плотности",
    description: "Крупную ask снимают перед ударом — цена проходит уровень без сопротивления.",
    learningGoal: "Если плотность сняли, ликвидность исчезла — движение может ускориться. Модель, не сигнал.",
    initialPrice: 123.48,
    steps: [
      {
        atTick: 0,
        action: "addLimitAsk",
        payload: { price: 123.5, size: 18_000, large: true },
        explanation: "Крупная ask-плотность на 123.50 — кажется сопротивлением.",
        journal: { appeared: "Ask 18K на 123.50", watchBook: "Янтарный ask-bar" },
      },
      {
        atTick: 1,
        action: "annotation",
        payload: { price: 123.5, label: "крупная ask", kind: "large-ask-density" },
        explanation: "Уровень отмечен как крупная плотность.",
      },
      {
        atTick: 2,
        action: "cancelLimit",
        payload: { price: 123.5, side: "ask" },
        explanation: "Плотность сняли — объём исчез перед ударом.",
        watchHint: "Ask-bar на 123.50 пуст.",
        journal: {
          levelOutcome: "Ликвидность убрали — сопротивления нет",
          watchBook: "Пустая строка 123.50",
        },
      },
      {
        atTick: 3,
        action: "annotation",
        payload: { price: 123.5, label: "плотность сняли", kind: "density-pulled" },
        explanation: "Подпись: плотность сняли — ликвидность исчезла.",
        whyImportant: "Часто снимают перед тем, как пустить цену — учебный приём, не доказательство манипуляции.",
      },
      {
        atTick: 4,
        action: "marketBuy",
        payload: { size: 5000 },
        explanation: "Покупки проходят 123.50 без крупного ask — быстрый ход вверх.",
        journal: {
          aggressor: "Покупатели",
          levelOutcome: "Цена прошла уровень",
          watchBook: "Зелёная лента выше 123.50",
        },
      },
    ],
  },
];

export function getScenarioById(id: SimScenarioName): OrderflowScenario | undefined {
  return ORDERFLOW_SCENARIOS.find((s) => s.id === id);
}

export function getScenarioMaxTick(scenario: OrderflowScenario): number {
  return Math.max(0, ...scenario.steps.map((s) => s.atTick));
}

export function getStepsAtTick(scenario: OrderflowScenario, tick: number): ScenarioStep[] {
  return scenario.steps.filter((s) => s.atTick === tick);
}

export function parseScenarioSide(payload: Record<string, unknown>): SimSide {
  return payload.side === "ask" ? "ask" : "bid";
}
