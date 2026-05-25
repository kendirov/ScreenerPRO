/** Матрица связей — корреляции акций MOEX с рыночными факторами. */

export type CorrelationFactorId = "index" | "ruble" | "oil" | "gold" | "america" | "sector";

export type CorrelationLabDataStatus = "live" | "partial" | "no-history" | "no-proxy" | "planned";

export type CorrelationLabOverviewStatus = "ok" | "partial" | "no-data" | "error";

export type CorrelationInstrumentLink = {
  ticker: string;
  corr20: number | null;
  corr60: number | null;
  beta: number | null;
  breakScore: number | null;
  linkKind: "strong" | "inverse" | "break" | "neutral";
};

export type CorrelationFactorCardData = {
  id: CorrelationFactorId;
  title: string;
  meaning: string;
  dataStatus: CorrelationLabDataStatus;
  proxyLabel: string | null;
  proxyTicker: string | null;
  sessionDays: number | null;
  strongCount: number;
  inverseCount: number;
  breakCount: number;
  strongSamples: string[];
  inverseSamples: string[];
  breakSamples: string[];
  instruments: CorrelationInstrumentLink[];
};

export type CorrelationLabOverviewResponse = {
  fetchedAt: string;
  status: CorrelationLabOverviewStatus;
  stockCount: number;
  alignedDays: number | null;
  factors: CorrelationFactorCardData[];
  briefingThemes: string[];
  warnings: string[];
};

export type CorrelationSourceAdapterStatus = "connected" | "experimental" | "planned" | "unavailable";

export type CorrelationSourceAdapter = {
  id: string;
  title: string;
  role: "candles" | "correlations" | "reference" | "external";
  status: CorrelationSourceAdapterStatus;
  description: string;
  limitation: string;
};

export type CorrelationLabSourcesResponse = {
  fetchedAt: string;
  adapters: CorrelationSourceAdapter[];
  warnings: string[];
};

export const CORRELATION_LAB_FACTORS: Array<{
  id: CorrelationFactorId;
  title: string;
  meaning: string;
  proxyHint: string;
}> = [
  {
    id: "index",
    title: "Индекс",
    meaning: "Кто сильнее или слабее широкого рынка",
    proxyHint: "IMOEX / IMOEXF",
  },
  {
    id: "ruble",
    title: "Рубль",
    meaning: "Экспортёры, импортёры, банки",
    proxyHint: "Si / CNYRUB / USDRUBF",
  },
  {
    id: "oil",
    title: "Нефть",
    meaning: "Нефтегаз, индекс, рубль",
    proxyHint: "BR / Brent futures",
  },
  {
    id: "gold",
    title: "Золото",
    meaning: "Золотодобытчики и защитный блок",
    proxyHint: "GOLD / GLDRUB / GDM",
  },
  {
    id: "america",
    title: "Америка",
    meaning: "Внешний risk-on / risk-off через MOEX",
    proxyHint: "S&P / Nasdaq futures on MOEX",
  },
  {
    id: "sector",
    title: "Сектор",
    meaning: "Лидер или аутсайдер внутри сектора",
    proxyHint: "Секторный индекс или группа",
  },
];

/** Секторные группы для расчёта sector-basket (упрощённо, TQBR). */
export const CORRELATION_SECTOR_GROUPS: Array<{ id: string; title: string; tickers: string[] }> = [
  { id: "oil-gas", title: "Нефть и газ", tickers: ["LKOH", "ROSN", "TATN", "SIBN", "GAZP", "NVTK"] },
  { id: "metals", title: "Металлы", tickers: ["GMKN", "RUAL", "NLMK", "MAGN", "CHMF", "PLZL"] },
  { id: "finance", title: "Финансы", tickers: ["SBER", "VTBR", "T", "MOEX", "SVCB"] },
  { id: "power", title: "Электроэнергетика", tickers: ["IRAO", "FEES", "HYDR", "MSNG"] },
  { id: "telecom", title: "Телеком", tickers: ["MTSS", "RTKM"] },
  { id: "transport", title: "Транспорт", tickers: ["FLOT", "AFLT", "NMTP"] },
];

export const CORRELATION_STRONG_THRESHOLD = 0.55;
export const CORRELATION_INVERSE_THRESHOLD = -0.35;
export const CORRELATION_BREAK_THRESHOLD = 0.38;

export const CORRELATION_DATA_STATUS_LABEL: Record<CorrelationLabDataStatus, string> = {
  live: "данные есть",
  partial: "частично",
  "no-history": "нужна история свечей",
  "no-proxy": "прокси недоступен",
  planned: "источник в плане",
};

export function formatCorrelationCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function formatBetaCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function buildBriefingThemes(factors: CorrelationFactorCardData[]): string[] {
  const themes: string[] = [];

  for (const factor of factors) {
    if (factor.dataStatus !== "live" && factor.dataStatus !== "partial") continue;

    if (factor.breakCount >= 3) {
      themes.push(`${factor.title}: ${factor.breakCount} бумаг оторвались от обычной связи`);
    } else if (factor.strongCount >= 5 && factor.id === "index") {
      themes.push("Широкий рынок: много бумаг идут вместе с индексом");
    } else if (factor.inverseCount >= 3 && factor.id === "ruble") {
      themes.push("Рубль: заметная группа с обратной связью — смотреть экспорт/импорт");
    } else if (factor.strongCount >= 4 && factor.id === "oil") {
      themes.push("Нефть: нефтегазовый блок синхронен с Brent");
    } else if (factor.breakCount >= 2 && factor.id === "sector") {
      themes.push("Сектор: есть аутсайдеры внутри групп — тема для брифинга");
    }
  }

  if (!themes.length) {
    themes.push("Сначала дождитесь загрузки истории MOEX — темы появятся после расчёта связей");
  }

  return themes.slice(0, 4);
}
