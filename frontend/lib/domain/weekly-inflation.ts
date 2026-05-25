/** Целевой годовой темп инфляции ЦБ РФ, % */
export const CBR_INFLATION_TARGET_PCT = 4;

export const WEEKLY_INFLATION_STORAGE_KEY = "screenerpro.weekly-inflation.manual";
export const WEEKLY_INFLATION_OFFICIAL_PUBLICATION_KEY = "screenerpro.weekly-inflation.official-publication";

export type WeeklyInflationOfficialPublication = {
  url: string;
  sourceName: string;
  publishedAt: string;
  verifiedManually: boolean;
  savedAt: string;
};

export type WeeklyInflationSource =
  | "manual"
  | "rosstat"
  | "fedstat"
  | "economy-ministry"
  | "smartlab"
  | "unknown";

export type WeeklyInflationPoint = {
  id: string;
  periodStart: string;
  periodEnd: string;
  publishedAt?: string;
  headlinePct: number | null;
  ytdPct?: number | null;
  foodPct?: number | null;
  nonFoodPct?: number | null;
  servicesPct?: number | null;
  fruitVegPct?: number | null;
  fuelPct?: number | null;
  source: WeeklyInflationSource;
  sourceUrl?: string;
  note?: string;
  isManual: boolean;
};

export type InflationRegime = "disinflation" | "neutral" | "pressure" | "shock" | "no-data";

export type WeeklyInflationDashboardMetrics = {
  avg4w: number | null;
  avg8w: number | null;
  avg12w: number | null;
  annualizedLatest: number | null;
  annualized4w: number | null;
  gapToTarget: number | null;
  regime: InflationRegime;
};

export type WeeklyInflationDashboard = {
  latest: WeeklyInflationPoint | null;
  points: WeeklyInflationPoint[];
  metrics: WeeklyInflationDashboardMetrics;
};

export type InflationMomentumDirection = "acceleration" | "deceleration" | "neutral";

export type WeeklyInflationCategoryRow = {
  id: string;
  label: string;
  valuePct: number;
};

export type WeeklyInflationCategoryComparisonRow = {
  id: string;
  label: string;
  currentPct: number;
  previousPct: number | null;
  deltaPct: number | null;
};

export type WeeklyInflationChartPoint = {
  point: WeeklyInflationPoint;
  index: number;
  headlinePct: number;
  avg4w: number | null;
  annualizedLatest: number | null;
  annualized4w: number | null;
};

export type WeeklyInflationAnnualizedPoint = {
  point: WeeklyInflationPoint;
  annualizedLatest: number | null;
  annualized4w: number | null;
};

/** Условно «нормальный» диапазон недельной инфляции, % */
export const WEEKLY_INFLATION_NORMAL_ZONE = { min: 0.05, max: 0.1 } as const;

export type ManualWeekFormValues = {
  periodStart: string;
  periodEnd: string;
  headlinePct: string;
  ytdPct: string;
  foodPct: string;
  nonFoodPct: string;
  servicesPct: string;
  fruitVegPct: string;
  fuelPct: string;
  source: WeeklyInflationSource;
  sourceUrl: string;
  note: string;
};

export type QuickWeekFormValues = {
  periodStart: string;
  periodEnd: string;
  headlinePct: string;
  ytdPct: string;
  sourceUrl: string;
};

export type WeeklyInflationWeekTableRow = {
  point: WeeklyInflationPoint;
  avg4w: number | null;
  annualized: number | null;
  verificationLabel: string;
};

export type WeeklyInflationCsvImportResult =
  | { ok: true; points: WeeklyInflationPoint[] }
  | { ok: false; error: string };

export const WEEKLY_INFLATION_SOURCE_LABELS: Record<WeeklyInflationSource, string> = {
  manual: "ручной",
  rosstat: "Росстат",
  fedstat: "Федстат",
  "economy-ministry": "Минэкономразвития",
  smartlab: "Smart-Lab",
  unknown: "неизвестно",
};

export const INFLATION_REGIME_LABELS: Record<InflationRegime, string> = {
  disinflation: "дезинфляция",
  neutral: "нейтрально",
  pressure: "инфляционное давление",
  shock: "инфляционный шок",
  "no-data": "нет данных",
};

export const MOMENTUM_DIRECTION_LABELS: Record<InflationMomentumDirection, string> = {
  acceleration: "ускорение",
  deceleration: "замедление",
  neutral: "нейтрально",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MOMENTUM_EPSILON = 0.02;

export const WEEKLY_INFLATION_CSV_COLUMNS =
  "periodStart,periodEnd,publishedAt,headlinePct,ytdPct,foodPct,nonFoodPct,servicesPct,fruitVegPct,fuelPct,sourceUrl,note";

/** CSV-шаблон без реальных значений */
export const WEEKLY_INFLATION_CSV_TEMPLATE = `${WEEKLY_INFLATION_CSV_COLUMNS}
YYYY-MM-DD,YYYY-MM-DD,,,,,,,,,,`;

/** Пример формата для UI — не реальные данные */
export const WEEKLY_INFLATION_CSV_FORMAT_EXAMPLE = `${WEEKLY_INFLATION_CSV_COLUMNS}
2026-00-00,2026-00-00,2026-00-00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,https://example.org/source,пример строки`;

export function sortWeeklyInflationPoints(points: WeeklyInflationPoint[]): WeeklyInflationPoint[] {
  return [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

export function calcAverage(points: WeeklyInflationPoint[], weeks: number): number | null {
  const sorted = sortWeeklyInflationPoints(points);
  const values = sorted
    .map((p) => p.headlinePct)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  if (values.length < weeks) return null;
  const slice = values.slice(-weeks);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

export function calcAnnualizedFromWeekly(weeklyPct: number | null): number | null {
  if (weeklyPct == null || Number.isNaN(weeklyPct)) return null;
  return (Math.pow(1 + weeklyPct / 100, 52) - 1) * 100;
}

export function calcAnnualizedFromAverage(avgWeeklyPct: number | null): number | null {
  return calcAnnualizedFromWeekly(avgWeeklyPct);
}

export function calcGapToTarget(annualizedPct: number | null, target = CBR_INFLATION_TARGET_PCT): number | null {
  if (annualizedPct == null || Number.isNaN(annualizedPct)) return null;
  return annualizedPct - target;
}

export function classifyInflationRegime(
  annualized4w: number | null,
  latestHeadline: number | null,
): InflationRegime {
  if (annualized4w == null && latestHeadline == null) return "no-data";
  if (latestHeadline != null && latestHeadline >= 0.3) return "shock";
  if (annualized4w != null && annualized4w >= 8) return "shock";
  if (annualized4w == null) return "no-data";
  if (annualized4w <= CBR_INFLATION_TARGET_PCT - 0.5) return "disinflation";
  if (annualized4w >= CBR_INFLATION_TARGET_PCT + 1.5) return "pressure";
  return "neutral";
}

export function buildWeeklyInflationDashboard(points: WeeklyInflationPoint[]): WeeklyInflationDashboard {
  const sorted = sortWeeklyInflationPoints(points);
  const latest = sorted.at(-1) ?? null;
  const avg4w = calcAverage(sorted, 4);
  const avg8w = calcAverage(sorted, 8);
  const avg12w = calcAverage(sorted, 12);
  const annualizedLatest = calcAnnualizedFromWeekly(latest?.headlinePct ?? null);
  const annualized4w = calcAnnualizedFromAverage(avg4w);
  const gapToTarget = calcGapToTarget(annualized4w ?? annualizedLatest);

  return {
    latest,
    points: sorted,
    metrics: {
      avg4w,
      avg8w,
      avg12w,
      annualizedLatest,
      annualized4w,
      gapToTarget,
      regime: classifyInflationRegime(annualized4w, latest?.headlinePct ?? null),
    },
  };
}

export function calcMomentumDirection(points: WeeklyInflationPoint[]): InflationMomentumDirection | null {
  const sorted = sortWeeklyInflationPoints(points);
  const values = sorted
    .map((p) => p.headlinePct)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  if (values.length < 8) return null;
  const recent = values.slice(-4);
  const prior = values.slice(-8, -4);
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  const delta = recentAvg - priorAvg;
  if (Math.abs(delta) < MOMENTUM_EPSILON) return "neutral";
  return delta > 0 ? "acceleration" : "deceleration";
}

export function formatInflationPct(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "нет данных";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDeviationPp(value: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)} п.п.`;
}

export function formatPeriodLabel(point: WeeklyInflationPoint | null): string | null {
  if (!point) return null;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
  };
  return `${fmt(point.periodStart)} — ${fmt(point.periodEnd)}`;
}

export function extractCategoryRows(point: WeeklyInflationPoint | null): WeeklyInflationCategoryRow[] {
  if (!point) return [];
  const rows: WeeklyInflationCategoryRow[] = [];
  if (point.foodPct != null) rows.push({ id: "food", label: "Продовольствие", valuePct: point.foodPct });
  if (point.nonFoodPct != null) rows.push({ id: "non-food", label: "Непродовольственные", valuePct: point.nonFoodPct });
  if (point.servicesPct != null) rows.push({ id: "services", label: "Услуги", valuePct: point.servicesPct });
  if (point.fruitVegPct != null) rows.push({ id: "fruit-veg", label: "Фрукты и овощи", valuePct: point.fruitVegPct });
  if (point.fuelPct != null) rows.push({ id: "fuel", label: "Топливо", valuePct: point.fuelPct });
  return rows;
}

export function extractCategoryComparison(
  latest: WeeklyInflationPoint | null,
  previous: WeeklyInflationPoint | null,
): WeeklyInflationCategoryComparisonRow[] {
  const currentRows = extractCategoryRows(latest);
  if (currentRows.length === 0) return [];

  const previousById = new Map(extractCategoryRows(previous).map((row) => [row.id, row.valuePct]));

  return currentRows.map((row) => {
    const previousPct = previousById.get(row.id) ?? null;
    return {
      id: row.id,
      label: row.label,
      currentPct: row.valuePct,
      previousPct,
      deltaPct: previousPct != null ? row.valuePct - previousPct : null,
    };
  });
}

export function buildWeeklyInflationChartSeries(points: WeeklyInflationPoint[]): WeeklyInflationChartPoint[] {
  const sorted = sortWeeklyInflationPoints(points).filter(
    (p) => p.headlinePct != null && !Number.isNaN(p.headlinePct),
  );

  return sorted.map((point, index) => {
    const slice = sorted.slice(0, index + 1);
    const avg4w = calcAverage(slice, 4);
    return {
      point,
      index,
      headlinePct: point.headlinePct as number,
      avg4w,
      annualizedLatest: calcAnnualizedFromWeekly(point.headlinePct),
      annualized4w: calcAnnualizedFromAverage(avg4w),
    };
  });
}

export function buildAnnualizedSeries(points: WeeklyInflationPoint[]): WeeklyInflationAnnualizedPoint[] {
  const sorted = sortWeeklyInflationPoints(points).filter(
    (p) => p.headlinePct != null && !Number.isNaN(p.headlinePct),
  );

  return sorted.map((point, index) => {
    const slice = sorted.slice(0, index + 1);
    const avg4w = calcAverage(slice, 4);
    return {
      point,
      annualizedLatest: calcAnnualizedFromWeekly(point.headlinePct),
      annualized4w: calcAnnualizedFromAverage(avg4w),
    };
  });
}

export function groupPointsByMonth(points: WeeklyInflationPoint[]): { monthKey: string; label: string; points: WeeklyInflationPoint[] }[] {
  const sorted = sortWeeklyInflationPoints(points).filter((p) => p.headlinePct != null);
  const groups = new Map<string, WeeklyInflationPoint[]>();

  for (const point of sorted) {
    const date = new Date(`${point.periodEnd}T12:00:00`);
    const monthKey = Number.isNaN(date.getTime())
      ? point.periodEnd.slice(0, 7)
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = groups.get(monthKey) ?? [];
    bucket.push(point);
    groups.set(monthKey, bucket);
  }

  return [...groups.entries()].map(([monthKey, monthPoints]) => ({
    monthKey,
    label: monthPoints[0]
      ? new Date(`${monthPoints[0].periodEnd}T12:00:00`).toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })
      : monthKey,
    points: monthPoints,
  }));
}

export function hasManualPoints(points: WeeklyInflationPoint[]): boolean {
  return points.some((p) => p.isManual);
}

export function createDefaultManualWeekForm(): ManualWeekFormValues {
  return {
    periodStart: "",
    periodEnd: "",
    headlinePct: "",
    ytdPct: "",
    foodPct: "",
    nonFoodPct: "",
    servicesPct: "",
    fruitVegPct: "",
    fuelPct: "",
    source: "manual",
    sourceUrl: "",
    note: "",
  };
}

export function createDefaultQuickWeekForm(): QuickWeekFormValues {
  return {
    periodStart: "",
    periodEnd: "",
    headlinePct: "",
    ytdPct: "",
    sourceUrl: "",
  };
}

function parseOptionalNumber(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return value;
}

function parseRequiredNumber(raw: string, field: string): number {
  const value = parseOptionalNumber(raw);
  if (value == null) throw new Error(`Укажите «${field}».`);
  return value;
}

function assertIsoDate(value: string, field: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) {
    throw new Error(`«${field}» должна быть в формате YYYY-MM-DD.`);
  }
  return trimmed;
}

function createPointId(periodEnd: string): string {
  return `manual-${periodEnd}-${Date.now().toString(36)}`;
}

export function manualFormToPoint(form: ManualWeekFormValues): WeeklyInflationPoint {
  const periodStart = assertIsoDate(form.periodStart, "Дата начала периода");
  const periodEnd = assertIsoDate(form.periodEnd, "Дата конца периода");
  if (periodEnd < periodStart) {
    throw new Error("Дата конца периода не может быть раньше даты начала.");
  }

  return {
    id: createPointId(periodEnd),
    periodStart,
    periodEnd,
    headlinePct: parseRequiredNumber(form.headlinePct, "headline %"),
    ytdPct: parseOptionalNumber(form.ytdPct),
    foodPct: parseOptionalNumber(form.foodPct),
    nonFoodPct: parseOptionalNumber(form.nonFoodPct),
    servicesPct: parseOptionalNumber(form.servicesPct),
    fruitVegPct: parseOptionalNumber(form.fruitVegPct),
    fuelPct: parseOptionalNumber(form.fuelPct),
    source: form.source,
    sourceUrl: form.sourceUrl.trim() || undefined,
    note: form.note.trim() || undefined,
    isManual: true,
  };
}

export function quickFormToPoint(form: QuickWeekFormValues): WeeklyInflationPoint {
  const periodStart = assertIsoDate(form.periodStart, "Период с");
  const periodEnd = assertIsoDate(form.periodEnd, "Период по");
  if (periodEnd < periodStart) {
    throw new Error("Период «по» не может быть раньше «с».");
  }

  return {
    id: createPointId(periodEnd),
    periodStart,
    periodEnd,
    headlinePct: parseRequiredNumber(form.headlinePct, "недельная инфляция"),
    ytdPct: parseOptionalNumber(form.ytdPct),
    source: "manual",
    sourceUrl: form.sourceUrl.trim() || undefined,
    isManual: true,
  };
}

export function removeWeeklyInflationPoint(points: WeeklyInflationPoint[], periodEnd: string): WeeklyInflationPoint[] {
  return sortWeeklyInflationPoints(points.filter((point) => point.periodEnd !== periodEnd));
}

export function resolveWeekVerificationLabel(
  point: WeeklyInflationPoint,
  officialPublication: WeeklyInflationOfficialPublication | null,
): string {
  if (officialPublication?.verifiedManually && officialPublication.url) {
    if (point.sourceUrl && point.sourceUrl === officialPublication.url) return "проверено";
    if (point.periodEnd === officialPublication.publishedAt) return "проверено";
  }
  if (point.sourceUrl) return "есть URL";
  return "не проверено";
}

export function buildRecentWeeksTableRows(
  points: WeeklyInflationPoint[],
  officialPublication: WeeklyInflationOfficialPublication | null,
  limit = 10,
): WeeklyInflationWeekTableRow[] {
  const sorted = sortWeeklyInflationPoints(points).filter(
    (point) => point.headlinePct != null && !Number.isNaN(point.headlinePct),
  );
  const recent = sorted.slice(-limit).reverse();

  return recent.map((point) => {
    const index = sorted.findIndex((candidate) => candidate.periodEnd === point.periodEnd);
    const slice = sorted.slice(0, index + 1);
    const avg4w = calcAverage(slice, 4);
    return {
      point,
      avg4w,
      annualized: calcAnnualizedFromWeekly(point.headlinePct),
      verificationLabel: resolveWeekVerificationLabel(point, officialPublication),
    };
  });
}

export function mergeWeeklyInflationPoints(
  existing: WeeklyInflationPoint[],
  incoming: WeeklyInflationPoint[],
): WeeklyInflationPoint[] {
  const map = new Map<string, WeeklyInflationPoint>();
  for (const point of existing) map.set(point.periodEnd, point);
  for (const point of incoming) map.set(point.periodEnd, point);
  return sortWeeklyInflationPoints([...map.values()]);
}

function parseCsvNumber(raw: string | undefined, field: string, required = false): number | null {
  if (raw == null || raw.trim() === "") {
    if (required) throw new Error(`Не указано поле «${field}».`);
    return null;
  }
  const value = parseOptionalNumber(raw);
  if (value == null) throw new Error(`Некорректное число в «${field}»: ${raw}`);
  return value;
}

type CsvDelimiter = "," | ";" | "\t";

function detectCsvDelimiter(headerLine: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [",", ";", "\t"];
  let best: CsvDelimiter = ",";
  let bestCount = 0;
  for (const delimiter of candidates) {
    const count = headerLine.split(delimiter).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  if (bestCount === 0) {
    throw new Error("Не удалось определить разделитель CSV — используйте запятую, точку с запятой или таб.");
  }
  return best;
}

function splitCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  return line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
}

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function buildCsvColumnIndex(headers: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headers.forEach((header, i) => {
    index.set(normalizeCsvHeader(header), i);
  });
  return index;
}

function pickCsvValue(parts: string[], columnIndex: Map<string, number>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const idx = columnIndex.get(normalizeCsvHeader(key));
    if (idx != null && parts[idx] != null) return parts[idx];
  }
  return undefined;
}

function pointFromCsvRow(
  parts: string[],
  columnIndex: Map<string, number> | null,
  lineNo: number,
  source: WeeklyInflationSource = "manual",
): WeeklyInflationPoint {
  const get = (position: number, ...keys: string[]) =>
    columnIndex ? pickCsvValue(parts, columnIndex, ...keys) : parts[position];

  const legacyWeekEnd = get(0, "weekenddate", "periodend");
  const periodStartRaw = get(0, "periodstart") ?? legacyWeekEnd;
  const periodEndRaw = get(1, "periodend") ?? legacyWeekEnd;
  const publishedAtRaw = get(2, "publishedat");
  const headlineRaw =
    get(3, "headlinepct") ?? get(1, "weeklyinflationpct") ?? get(2, "headlinepct");
  const ytdRaw = get(4, "ytdpct");
  const foodRaw = get(5, "foodpct");
  const nonFoodRaw = get(6, "nonfoodpct");
  const servicesRaw = get(7, "servicespct");
  const fruitVegRaw = get(8, "fruitvegpct");
  const fuelRaw = get(9, "fuelpct");
  const sourceUrlRaw = get(10, "sourceurl");
  const noteRaw = get(11, "note");

  if (!periodEndRaw?.trim()) {
    throw new Error(`Строка ${lineNo}: не указан periodEnd.`);
  }
  if (headlineRaw == null || headlineRaw.trim() === "") {
    throw new Error(`Строка ${lineNo}: нет headlinePct — недельная инфляция обязательна.`);
  }

  const periodStart = assertIsoDate(periodStartRaw ?? periodEndRaw, `строка ${lineNo}: periodStart`);
  const periodEnd = assertIsoDate(periodEndRaw, `строка ${lineNo}: periodEnd`);
  if (periodEnd < periodStart) {
    throw new Error(`Строка ${lineNo}: periodEnd раньше periodStart.`);
  }

  const publishedAt = publishedAtRaw?.trim()
    ? assertIsoDate(publishedAtRaw, `строка ${lineNo}: publishedAt`)
    : undefined;

  return {
    id: createPointId(periodEnd),
    periodStart,
    periodEnd,
    publishedAt,
    headlinePct: parseCsvNumber(headlineRaw, "headlinePct", true),
    ytdPct: parseCsvNumber(ytdRaw, "ytdPct"),
    foodPct: parseCsvNumber(foodRaw, "foodPct"),
    nonFoodPct: parseCsvNumber(nonFoodRaw, "nonFoodPct"),
    servicesPct: parseCsvNumber(servicesRaw, "servicesPct"),
    fruitVegPct: parseCsvNumber(fruitVegRaw, "fruitVegPct"),
    fuelPct: parseCsvNumber(fuelRaw, "fuelPct"),
    source,
    sourceUrl: sourceUrlRaw?.trim() || undefined,
    note: noteRaw?.trim() || undefined,
    isManual: true,
  };
}

export function parseWeeklyInflationCsv(
  text: string,
  options?: { source?: WeeklyInflationSource },
): WeeklyInflationCsvImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "CSV пуст — вставьте данные или загрузите файл." };

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { ok: false, error: "CSV пуст." };

  try {
    const delimiter = detectCsvDelimiter(lines[0]!);
    const firstParts = splitCsvLine(lines[0]!, delimiter);
    const headerLower = firstParts.map((h) => normalizeCsvHeader(h)).join("|");
    const hasHeader =
      headerLower.includes("periodstart") ||
      headerLower.includes("periodend") ||
      headerLower.includes("weekenddate") ||
      headerLower.includes("headlinepct") ||
      headerLower.includes("weeklyinflationpct");

    const columnIndex = hasHeader ? buildCsvColumnIndex(firstParts) : null;
    const dataLines = hasHeader ? lines.slice(1) : lines;

    if (dataLines.length === 0) {
      return { ok: false, error: "В CSV нет строк данных после заголовка." };
    }

    const points: WeeklyInflationPoint[] = [];
    const seenPeriods = new Set<string>();

    for (let i = 0; i < dataLines.length; i += 1) {
      const line = dataLines[i]!;
      if (line.startsWith("YYYY-MM-DD") || line.includes("пример строки")) continue;

      const parts = splitCsvLine(line, delimiter);
      if (parts.length === 1 && !hasHeader) {
        throw new Error(
          `Строка ${i + 1}: неправильный разделитель или формат — ожидается ${WEEKLY_INFLATION_CSV_COLUMNS}.`,
        );
      }

      const point = pointFromCsvRow(parts, columnIndex, i + 1, options?.source ?? "manual");
      if (seenPeriods.has(point.periodEnd)) {
        throw new Error(`Строка ${i + 1}: дубликат периода ${point.periodEnd}.`);
      }
      seenPeriods.add(point.periodEnd);
      points.push(point);
    }

    if (points.length === 0) {
      return { ok: false, error: "Нет валидных строк данных — проверьте headlinePct и даты." };
    }

    return { ok: true, points };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось разобрать CSV.",
    };
  }
}

export function loadManualPointsFromStorage(): WeeklyInflationPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WEEKLY_INFLATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sortWeeklyInflationPoints(parsed as WeeklyInflationPoint[]);
  } catch {
    return [];
  }
}

export function saveManualPointsToStorage(points: WeeklyInflationPoint[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEEKLY_INFLATION_STORAGE_KEY, JSON.stringify(points));
}

export function clearManualPointsStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WEEKLY_INFLATION_STORAGE_KEY);
}

export function loadOfficialPublicationFromStorage(): WeeklyInflationOfficialPublication | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEEKLY_INFLATION_OFFICIAL_PUBLICATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyInflationOfficialPublication;
    if (!parsed?.url?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOfficialPublicationToStorage(publication: WeeklyInflationOfficialPublication): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEEKLY_INFLATION_OFFICIAL_PUBLICATION_KEY, JSON.stringify(publication));
}

export function clearOfficialPublicationStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WEEKLY_INFLATION_OFFICIAL_PUBLICATION_KEY);
}

export function createDefaultOfficialPublicationForm(): Omit<
  WeeklyInflationOfficialPublication,
  "savedAt" | "verifiedManually"
> & { verifiedManually: boolean } {
  return {
    url: "",
    sourceName: "Росстат / ЕМИСС",
    publishedAt: "",
    verifiedManually: false,
  };
}

export function downloadWeeklyInflationCsvTemplate(): void {
  const blob = new Blob([WEEKLY_INFLATION_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "weekly-inflation-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
