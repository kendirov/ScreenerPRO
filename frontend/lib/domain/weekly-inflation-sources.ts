import type { WeeklyInflationPoint } from "@/lib/domain/weekly-inflation";

export type WeeklyInflationAdapterStatus =
  | "connected"
  | "experimental"
  | "manual"
  | "error"
  | "not-configured"
  | "planned";

export type WeeklyInflationAdapterRole = "number" | "calendar" | "verification" | "commentary";

export type WeeklyInflationSourceAdapter = {
  id: string;
  title: string;
  status: WeeklyInflationAdapterStatus;
  description: string;
  priority: number;
  role: WeeklyInflationAdapterRole;
  provides: string;
  limitation: string;
  checkable: boolean;
};

export type WeeklyInflationSourceStatusResponse = {
  updatedAt: string;
  adapters: WeeklyInflationSourceAdapter[];
  warnings: string[];
};

export type WeeklyInflationFetchStatus = "ok" | "not-configured" | "unsupported" | "error";

export type WeeklyInflationFetchDiagnostics = {
  url?: string;
  contentType?: string;
  parsedPoints: number;
  warnings: string[];
};

export type WeeklyInflationFetchResponse = {
  source: "rosstat" | "fedstat";
  status: WeeklyInflationFetchStatus;
  updatedAt: string;
  points: WeeklyInflationPoint[];
  diagnostics: WeeklyInflationFetchDiagnostics;
};

export const ADAPTER_STATUS_LABELS: Record<WeeklyInflationAdapterStatus, string> = {
  connected: "работает",
  experimental: "эксперимент",
  manual: "ручной",
  error: "ошибка",
  "not-configured": "не настроен",
  planned: "план",
};

export const ADAPTER_ROLE_LABELS: Record<WeeklyInflationAdapterRole, string> = {
  number: "источник цифры",
  verification: "проверка",
  calendar: "источник календаря",
  commentary: "комментарий",
};

export function getWeeklyInflationSourceAdapters(): WeeklyInflationSourceAdapter[] {
  const adapters: WeeklyInflationSourceAdapter[] = [
    {
      id: "manual-csv",
      title: "Ручной CSV",
      status: "connected",
      description: "Импорт недельного ряда через CSV/JSON в localStorage.",
      priority: 1,
      role: "number",
      provides: "Headline, категории и история недель — полный контроль ввода.",
      limitation: "Цифры вводятся вручную; перед эфиром сверять с официальной публикацией.",
      checkable: false,
    },
    {
      id: "official-url",
      title: "Official URL",
      status: "connected",
      description: "Ручная ссылка на официальную публикацию Росстат/ЕМИСС.",
      priority: 2,
      role: "verification",
      provides: "URL, название источника и дата публикации для быстрой проверки перед брифингом.",
      limitation: "Не подставляет цифры автоматически — только ссылка для сверки.",
      checkable: false,
    },
    {
      id: "rosstat",
      title: "Росстат",
      status: "experimental",
      description: "Экспериментальный автоадаптер официального недельного ряда.",
      priority: 3,
      role: "number",
      provides: "Попытка загрузки CSV/HTML по указанному URL.",
      limitation: "Без проверенного indicator id; парсинг ограничен — при сомнении используйте CSV.",
      checkable: true,
    },
    {
      id: "fedstat",
      title: "Fedstat / ЕМИСС",
      status: "experimental",
      description: "Экспериментальный автоадаптер ЕМИСС.",
      priority: 4,
      role: "number",
      provides: "Попытка загрузки файла/страницы по URL или env.",
      limitation: "Агрессивный парсинг не используется; при неясной структуре — ручной импорт.",
      checkable: true,
    },
    {
      id: "smartlab-calendar",
      title: "Smart-Lab Calendar",
      status: "planned",
      description: "Календарь макро-событий — не источник недельной цифры.",
      priority: 5,
      role: "calendar",
      provides: "События и контекст вокруг публикаций (см. /lab/preparation).",
      limitation: "Не подставляет headline недельной инфляции.",
      checkable: false,
    },
    {
      id: "economy-ministry",
      title: "Минэкономразвития",
      status: "planned",
      description: "Еженедельный обзор потребительских цен.",
      priority: 6,
      role: "commentary",
      provides: "Комментарий и narrative к неделе.",
      limitation: "Не основной числовой ряд — только текстовый слой.",
      checkable: false,
    },
  ];

  return adapters.sort((a, b) => a.priority - b.priority);
}

export function buildWeeklyInflationSourceStatusResponse(
  warnings: string[] = [],
): WeeklyInflationSourceStatusResponse {
  return {
    updatedAt: new Date().toISOString(),
    adapters: getWeeklyInflationSourceAdapters(),
    warnings,
  };
}

export function isWeeklyInflationFetchSource(value: string | null): value is "rosstat" | "fedstat" {
  return value === "rosstat" || value === "fedstat";
}

export function resolveEnvIndicatorUrl(source: "rosstat" | "fedstat"): string | null {
  if (source === "rosstat") {
    return process.env.WEEKLY_INFLATION_ROSSTAT_INDICATOR_URL?.trim() || null;
  }
  return process.env.WEEKLY_INFLATION_FEDSTAT_INDICATOR_URL?.trim() || null;
}

export function resolveEnvIndicatorId(source: "rosstat" | "fedstat"): string | null {
  if (source === "rosstat") {
    return process.env.WEEKLY_INFLATION_ROSSTAT_INDICATOR_ID?.trim() || null;
  }
  return process.env.WEEKLY_INFLATION_FEDSTAT_INDICATOR_ID?.trim() || null;
}

export function formatFetchResultLabel(response: WeeklyInflationFetchResponse): string {
  if (response.status === "not-configured") {
    return "не настроен — укажите URL или загрузите CSV вручную";
  }
  if (response.status === "error") {
    return "ошибка загрузки — нужен ручной импорт";
  }
  if (response.status === "unsupported") {
    return response.diagnostics.parsedPoints > 0
      ? `файл найден, но формат не распознан полностью (${response.diagnostics.parsedPoints} строк)`
      : "формат не распознан — нужен ручной импорт";
  }
  if (response.diagnostics.parsedPoints > 0 && response.points.length > 0) {
    return `доступен · распознано ${response.points.length} нед.`;
  }
  if (response.diagnostics.contentType) {
    return `доступен · ${response.diagnostics.contentType}`;
  }
  return "доступен · нужен ручной импорт CSV";
}
