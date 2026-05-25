export type PreparationSourceType =
  | "calendar"
  | "broker-review"
  | "telegram"
  | "market-data"
  | "manual";

export type PreparationSourceStatus = "connected" | "manual" | "planned" | "disabled" | "experimental";

export type PreparationSource = {
  id: string;
  title: string;
  type: PreparationSourceType;
  url?: string;
  status: PreparationSourceStatus;
  note: string;
  /** Что даёт источник в контексте подготовки */
  provides: string;
  /** Ограничение / почему не автоматизируем сейчас */
  limitation: string;
};

export const PREPARATION_SOURCE_TYPE_LABELS: Record<PreparationSourceType, string> = {
  calendar: "календарь",
  "broker-review": "обзор брокера",
  telegram: "Telegram",
  "market-data": "рыночные данные",
  manual: "ручной ввод",
};

export const PREPARATION_SOURCE_STATUS_LABELS: Record<PreparationSourceStatus, string> = {
  connected: "подключён",
  manual: "вручную",
  planned: "в планах",
  disabled: "отключён",
  experimental: "эксперимент",
};

export const PREPARATION_SOURCES: PreparationSource[] = [
  {
    id: "moex-iss",
    title: "MOEX ISS",
    type: "market-data",
    url: "https://iss.moex.com/iss",
    status: "connected",
    note: "Скринер, свечи 5д, котировки FORTS/TQBR через /api/screener.",
    provides: "In-play, оборот, свечи, резолв фронтов.",
    limitation: "Нет макро-календаря и новостной ленты — только рынок MOEX.",
  },
  {
    id: "bcs-calendar",
    title: "БКС · календарь",
    type: "calendar",
    url: "https://bcs.ru",
    status: "planned",
    note: "Календарь событий и обзоры — ручной перенос.",
    provides: "Макро, отчётность, дивиденды, время публикаций.",
    limitation: "Автопарсинг не делаем — только ручной импорт / paste.",
  },
  {
    id: "finam",
    title: "Финам",
    type: "broker-review",
    url: "https://www.finam.ru",
    status: "planned",
    note: "Обзоры и календарь — копировать вручную.",
    provides: "Утренние/вечерние обзоры, повестка дня.",
    limitation: "Без scraping — вставка текста или форма.",
  },
  {
    id: "investing",
    title: "Investing · календарь",
    type: "calendar",
    url: "https://www.investing.com",
    status: "planned",
    note: "Глобальный экономический календарь.",
    provides: "Макро США/ЕС/РФ, время релизов.",
    limitation: "Только ручной перенос; парсер — следующий этап.",
  },
  {
    id: "trading-economics",
    title: "Trading Economics",
    type: "calendar",
    url: "https://tradingeconomics.com",
    status: "planned",
    note: "Макро-статистика и консенсус.",
    provides: "Инфляция, ставки, ВВП, payroll.",
    limitation: "Платный API позже; сейчас — paste / форма.",
  },
  {
    id: "markettwits",
    title: "MarketTwits",
    type: "manual",
    status: "manual",
    note: "Telegram/сайт — списки событий копируются в paste-поле.",
    provides: "Быстрая повестка дня, тезисы трейдеров.",
    limitation: "Не подключаем Telegram-бота — только вставка текста.",
  },
  {
    id: "smart-lab-calendar",
    title: "Smart-Lab · календарь",
    type: "calendar",
    url: "https://smart-lab.ru/calendar/",
    status: "experimental",
    note: "Экспериментальный импорт открытой страницы календаря. При ошибке используйте ручной импорт.",
    provides: "События MOEX: отчёты, СД, макро, корпоративные даты.",
    limitation: "Парсинг HTML может сломаться; кэш ~45 мин; не для продакшена.",
  },
  {
    id: "smart-lab-dividends",
    title: "Smart-Lab · дивиденды",
    type: "calendar",
    url: "https://smart-lab.ru/dividends/",
    status: "experimental",
    note: "Дивиденды, отсечки, закрытия реестров.",
    provides: "Тикер, размер див., даты реестра и выплат.",
    limitation: "Эксперимент · только открытая таблица · без гарантий точности.",
  },
  {
    id: "smart-lab",
    title: "Smart-Lab · обсуждения",
    type: "broker-review",
    url: "https://smart-lab.ru",
    status: "manual",
    note: "Обсуждения, обзоры, идеи — ручные заметки.",
    provides: "Настроение рынка, темы дня, мнения.",
    limitation: "Форум не парсим — paste или форма.",
  },
  {
    id: "telegram-notes",
    title: "Telegram · заметки",
    type: "telegram",
    status: "manual",
    note: "Личные каналы и чаты — только ручной ввод.",
    provides: "Headlines, ссылки, быстрые триггеры.",
    limitation: "Автоимпорт из Telegram не делаем на этом шаге.",
  },
  {
    id: "manual-form",
    title: "Ручная форма",
    type: "manual",
    status: "manual",
    note: "События, добавленные через форму на этой странице.",
    provides: "Полный контроль: время, сценарии, инструменты.",
    limitation: "Хранится только в сессии браузера (без backend).",
  },
];

/** Источники для выбора в форме импорта */
export const MANUAL_IMPORT_SOURCE_OPTIONS = PREPARATION_SOURCES.filter((s) =>
  ["manual", "planned", "telegram", "calendar", "broker-review"].includes(s.type) &&
  s.id !== "moex-iss",
);

export function resolveMoexIssSourceStatus(isLiveMoex: boolean): PreparationSourceStatus {
  return isLiveMoex ? "connected" : "manual";
}

export function sourcesWithMoexStatus(isLiveMoex: boolean): PreparationSource[] {
  return PREPARATION_SOURCES.map((source) =>
    source.id === "moex-iss"
      ? { ...source, status: resolveMoexIssSourceStatus(isLiveMoex) }
      : source,
  );
}

export function findSourceById(id: string): PreparationSource | undefined {
  return PREPARATION_SOURCES.find((s) => s.id === id);
}
