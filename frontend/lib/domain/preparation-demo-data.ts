import type { MarketDriver, PreparationEvent } from "@/lib/domain/preparation-events";

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function offsetDate(reference: Date, dayOffset: number): string {
  const copy = new Date(reference);
  copy.setDate(copy.getDate() + dayOffset);
  return toIsoDate(copy);
}

/** Демо-события с датами относительно «сегодня». Не реальный календарь. */
export function buildDemoPreparationEvents(reference = new Date()): PreparationEvent[] {
  const today = toIsoDate(reference);

  return [
    {
      id: "demo-cb-rate",
      date: today,
      timeMsk: "13:30",
      title: "Решение по ключевой ставке ЦБ",
      sourceName: "Банк России · ручной ввод",
      category: "cb",
      impact: "critical",
      driverState: "active",
      affectedMarkets: ["РФ", "TQBR", "OFZ"],
      affectedInstruments: ["SBER", "GAZP", "Si", "RGBI"],
      expectation: "Рынок ждёт паузу; спорят только формулировки и тон комментария.",
      scenarioAbove: "Жёсткий тон → давление на акции и рубль, рост доходностей ОФЗ.",
      scenarioBase: "Пауза как ожидали → локальная реакция, быстрый откат если нет сюрприза.",
      scenarioBelow: "Мягче ожиданий → короткий risk-on по акциям и Si.",
      note: "Шаблон события «ставка» — проверять реакцию, а не только факт.",
      isManual: true,
    },
    {
      id: "demo-inflation",
      date: offsetDate(reference, 2),
      timeMsk: "16:00",
      title: "Публикация инфляции (недельная / оперативная)",
      sourceName: "Росстат · демо",
      category: "macro",
      impact: "high",
      driverState: "potential",
      affectedMarkets: ["РФ"],
      affectedInstruments: ["Si", "SBER", "LKOH"],
      expectation: "Ожидание умеренного замедления; рынок чувствителен к сюрпризу.",
      scenarioAbove: "Выше консенсуса → тема ставки оживает, давление на риск.",
      scenarioBase: "В консенсусе → тема фоном, без сильного импульса.",
      scenarioBelow: "Ниже → краткий relief по рублю и ставочным историям.",
      isManual: true,
    },
    {
      id: "demo-eia-oil",
      date: offsetDate(reference, 3),
      timeMsk: "18:30",
      title: "Запасы нефти EIA (США)",
      sourceName: "EIA · демо",
      category: "oil",
      impact: "high",
      driverState: "active",
      affectedMarkets: ["США", "FORTS", "РФ"],
      affectedInstruments: ["BR", "LKOH", "ROSN", "TATN"],
      expectation: "Консенсус: небольшое снижение запасов; рынок смотрит на бензин и дистилляты.",
      scenarioAbove: "Сильное снижение → импульс в BR и нефтянке на открытии MOEX.",
      scenarioBase: "В ожиданиях → движение умеренное, важнее контекст Ормуза / геополитики.",
      scenarioBelow: "Рост запасов → давление на нефть, риск для экспортёров.",
      isManual: true,
    },
    {
      id: "demo-dividends",
      date: offsetDate(reference, 4),
      timeMsk: "10:00",
      title: "Дивидендный календарь: отсечка / объявление",
      sourceName: "Компания · ручной ввод",
      category: "dividends",
      impact: "medium",
      driverState: "fading",
      affectedMarkets: ["РФ", "TQBR"],
      affectedInstruments: ["SBER", "LKOH", "NVTK"],
      expectation: "Размер близок к ожиданиям; рынок уже частично заложил payout.",
      scenarioAbove: "Выше ожиданий → краткий перекос в бумагу, затем фокус на дату отсечки.",
      scenarioBase: "Как ждали → локальный отклик, без системного драйвера.",
      scenarioBelow: "Ниже / отмена → пересмотр истории, давление на сектор.",
      note: "После отсечки тема часто «остывает» — следить за статусом драйвера.",
      isManual: true,
    },
    {
      id: "demo-earnings",
      date: today,
      timeMsk: "19:00",
      title: "Отчётность компании (МСФО / операционные)",
      sourceName: "Эмитент · демо",
      category: "earnings",
      impact: "high",
      driverState: "active",
      affectedMarkets: ["РФ", "TQBR"],
      affectedInstruments: ["GAZP", "NVTK"],
      expectation: "Консенсус по EBITDA и FCF; рынок смотрит на guidance.",
      scenarioAbove: "Beat + позитивный guidance → импульс в бумагу и сектор.",
      scenarioBase: "Inline → реакция короткая, если нет сюрприза в комментарии.",
      scenarioBelow: "Miss / слабый outlook → gap и давление на одногруппников.",
      isManual: true,
    },
    {
      id: "demo-geopolitics-oil",
      date: offsetDate(reference, 1),
      timeMsk: "—",
      title: "Геополитика / нефть (Ормуз, логистика)",
      sourceName: "Новости · ручной ввод",
      category: "geopolitics",
      impact: "critical",
      driverState: "active",
      affectedMarkets: ["США", "Ближний Восток", "FORTS", "РФ"],
      affectedInstruments: ["BR", "LKOH", "ROSN", "Si"],
      expectation: "Рынок в режиме headline-чувствительности; важна реакция, а не сам факт новости.",
      scenarioAbove: "Эскалация → risk-off, рост нефти, волатильность Si.",
      scenarioBase: "Шум без эскалации → откат премии, фокус на фундамент.",
      scenarioBelow: "Деэскалация → снятие премии в нефти, relief по экспортёрам.",
      note: "Тема может быть «горячей» без календарной даты.",
      isManual: true,
    },
    {
      id: "demo-expiry",
      date: offsetDate(reference, 5),
      timeMsk: "18:50",
      title: "Экспирация фьючерсов FORTS",
      sourceName: "MOEX · демо",
      category: "expiry",
      impact: "medium",
      driverState: "potential",
      affectedMarkets: ["FORTS", "РФ"],
      affectedInstruments: ["Si", "BR", "GD", "RTS"],
      expectation: "Повышенный rollover и всплески волатильности у ближних контрактов.",
      scenarioAbove: "Аномальный open interest → расширение спредов и slippage.",
      scenarioBase: "Обычный rollover → локальные движения, без системного шока.",
      scenarioBelow: "Низкая активность → тема «спит» до клиринга.",
      isManual: true,
    },
  ];
}

/** Демо-драйверы рынка — ручная модель, не live-новости. */
export const DEMO_MARKET_DRIVERS: MarketDriver[] = [
  {
    id: "drv-rate",
    title: "Ставка ЦБ",
    state: "active",
    whyMatters: "Задаёт дисконт и тон по рублю, банкам и облигациям.",
    affectedInstruments: ["SBER", "Si", "RGBI"],
    evidence: "Рынок торгует формулировки решения, а не только цифру.",
    lastReaction: "Демо: повышенная чувствительность TQBR после прошлого заседания.",
  },
  {
    id: "drv-ruble",
    title: "Рубль / Si",
    state: "active",
    whyMatters: "Связка экспортёров, импортёров и carry-тем.",
    affectedInstruments: ["Si", "SBER", "LKOH", "GMKN"],
    evidence: "Si в in-play при расширении диапазона.",
    lastReaction: "Демо: рынок реагирует на внешний FX и нефть.",
  },
  {
    id: "drv-oil-hormuz",
    title: "Нефть / Ормуз",
    state: "active",
    whyMatters: "Драйвер для BR, нефтянки и risk-appetite на MOEX.",
    affectedInstruments: ["BR", "LKOH", "ROSN", "TATN"],
    evidence: "Headline-режим: новость без даты, но с реакцией стакана.",
    lastReaction: "Демо: BR и LKOH двигаются синхронно с внешним Brent.",
  },
  {
    id: "drv-dividends",
    title: "Дивиденды",
    state: "fading",
    whyMatters: "Локальные перекосы до/после отсечки; после — тема слабеет.",
    affectedInstruments: ["SBER", "LKOH", "NVTK"],
    evidence: "Оборот смещается в «следующую» историю сектора.",
    lastReaction: "Демо: post-cut drift без продолжения тренда.",
  },
  {
    id: "drv-earnings",
    title: "Отчётности",
    state: "potential",
    whyMatters: "Может стать горячей после публикации, если beat/miss сильный.",
    affectedInstruments: ["GAZP", "NVTK", "TCSG"],
    evidence: "До релиза — в календаре; драйвер «спит» до факта.",
    lastReaction: "Демо: ждём реакцию в вечернем/утреннем окне.",
  },
  {
    id: "drv-expiry",
    title: "Экспирация",
    state: "potential",
    whyMatters: "Rollover, клиринг, техничные движения у ближних серий.",
    affectedInstruments: ["Si", "BR", "RTS"],
    evidence: "Растёт open interest и спред календаря.",
    lastReaction: "Демо: активность до клиринга 18:50.",
  },
  {
    id: "drv-forum",
    title: "ПМЭФ / форумные темы",
    state: "sleeping",
    whyMatters: "Сезонные corporate/gov headlines — вне окна форума не драйвер.",
    affectedInstruments: ["GAZP", "SBER"],
    evidence: "Нет свежих триггеров в ленте.",
    lastReaction: "Демо: рынок не реагирует на повторы старых тем.",
  },
];

export const DEMO_PREPARATION_EVENTS = buildDemoPreparationEvents();
