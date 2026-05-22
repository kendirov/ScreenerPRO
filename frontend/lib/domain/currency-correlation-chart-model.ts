import {
  CURRENCY_FAMILY_META,
  type CurrencyCorrelationFamily,
} from "@/lib/domain/currency-correlation";
import type {
  CurrencyHistoryPairKey,
  CurrencyHistoryResponse,
} from "@/lib/domain/currency-correlation-history";
import {
  alignPairByDate,
  alignSeriesByDate,
  calcDailyReturns,
  calcDivergence,
  findDivergenceEvents,
  normalizeToBase100,
  pearsonCorrelation,
  type DivergenceEvent,
} from "@/lib/domain/currency-correlation-series";

export type CurrencyChartMode =
  | "points"
  | "spread"
  | "trajectory"
  | "weeks"
  | "normalize"
  | "returns"
  | "divergence";

export const INTRADAY_CHART_MODES: CurrencyChartMode[] = [
  "points",
  "spread",
  "trajectory",
  "weeks",
];
export const DAILY_CHART_MODES: CurrencyChartMode[] = ["normalize", "returns", "divergence"];
export type CurrencyChartDays = 5 | 20 | 60;
export type CurrencyChartDataMode = "full" | "partial" | "diagnostic";

export const FAMILY_CHART_COLORS: Record<CurrencyCorrelationFamily, string> = {
  SI: "#22d3ee",
  CNY: "#fbbf24",
  ED: "#a78bfa",
};

export type ChartLinePoint = { time: string; value: number };

export type ChartFamilySeries = {
  family: CurrencyCorrelationFamily;
  label: string;
  ticker: string;
  color: string;
  data: ChartLinePoint[];
};

export type ChartMarkerItem = {
  time: string;
  family: CurrencyCorrelationFamily;
  text: string;
  color: string;
  strength: number;
};

export type ExcludedInstrument = {
  family: CurrencyCorrelationFamily;
  label: string;
  ticker: string;
  reason: string;
};

export type CorrelationLinkStatus = {
  label:
    | "сильная связь"
    | "средняя связь"
    | "слабая связь"
    | "расходятся"
    | "нет данных"
    | "недостаточно данных"
    | "нет общих дат";
  tone: "strong" | "medium" | "weak" | "negative" | "muted";
};

export type CurrencyChartModel = {
  mode: CurrencyChartMode;
  days: CurrencyChartDays;
  dataMode: CurrencyChartDataMode;
  chartInstruments: CurrencyCorrelationFamily[];
  excludedInstruments: ExcludedInstrument[];
  canRenderChart: boolean;
  partialModePill: string | null;
  diagnosticHints: string[];
  dates: string[];
  series: ChartFamilySeries[];
  markers: ChartMarkerItem[];
  correlations: {
    "SI/CNY": number | null;
    "SI/ED": number | null;
    "CNY/ED": number | null;
  };
  commonDates: number;
  tickersByFamily: Partial<Record<CurrencyCorrelationFamily, string>>;
  tooltipIndex: Map<
    string,
    Record<
      CurrencyCorrelationFamily,
      { normalized: number; dailyReturnPct: number; divergence: number; ticker: string } | undefined
    >
  >;
  nowSummary: string;
  chartWarnings: string[];
  basketNote?: string;
  commonDatesByPair: Record<CurrencyHistoryPairKey, number>;
};

const ALL_FAMILIES: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];
const MIN_CHART_POINTS = 5;

export function correlationLinkStatus(corr: number | null, commonDates?: number): CorrelationLinkStatus {
  if (commonDates != null && commonDates === 0) {
    return { label: "нет общих дат", tone: "muted" };
  }
  if (commonDates != null && commonDates < 3) {
    return { label: "недостаточно данных", tone: "muted" };
  }
  if (corr == null || !Number.isFinite(corr)) {
    return { label: "нет данных", tone: "muted" };
  }
  if (corr < 0) return { label: "расходятся", tone: "negative" };
  if (corr > 0.75) return { label: "сильная связь", tone: "strong" };
  if (corr >= 0.4) return { label: "средняя связь", tone: "medium" };
  return { label: "слабая связь", tone: "weak" };
}

function exclusionReason(
  family: CurrencyCorrelationFamily,
  inst: CurrencyHistoryResponse["instruments"][number],
  onChart: boolean,
): string {
  if (onChart) return "";
  if (inst.excludedReason) return inst.excludedReason;
  if (inst.coverageStatus === "no_overlap") return "нет общей истории с остальными";
  if (inst.coverageStatus === "empty" || (inst.pointsCount ?? inst.points.length) === 0) {
    return "нет свечей MOEX ISS за период";
  }
  if (inst.status === "error") return inst.error ?? "ошибка загрузки";
  if ((inst.pointsCount ?? inst.points.length) < MIN_CHART_POINTS) return "мало точек истории";
  return "не попал в общий ряд графика";
}

function buildExcludedList(
  history: CurrencyHistoryResponse,
  chartFamilies: CurrencyCorrelationFamily[],
): ExcludedInstrument[] {
  return ALL_FAMILIES.filter((f) => !chartFamilies.includes(f))
    .map((family) => {
      const inst = history.instruments.find((i) => i.family === family);
      const sel = history.contractSelections?.find((s) => s.family === family);
      const meta = CURRENCY_FAMILY_META[family];
      return {
        family,
        label: meta.label,
        ticker: inst?.activeNowTicker ?? inst?.ticker ?? "—",
        reason:
          sel?.selectionReason ??
          (inst ? exclusionReason(family, inst, false) : meta.emptyHint),
      };
    });
}

function buildPartialModePill(excluded: ExcludedInstrument[]): string | null {
  if (!excluded.length) return null;
  if (excluded.length === 1) {
    const e = excluded[0]!;
    return `Частичный режим: ${e.family} исключён, ${e.reason}.`;
  }
  const list = excluded.map((e) => `${e.family} (${e.reason})`).join("; ");
  return `Частичный режим: исключены ${list}.`;
}

function buildDiagnosticHints(
  history: CurrencyHistoryResponse,
  excluded: ExcludedInstrument[],
): string[] {
  const hints: string[] = [];
  const withPoints = history.instruments.filter((i) => (i.pointsCount ?? i.points.length) > 0);

  if (withPoints.length === 0) {
    hints.push("Проверьте торговый день MOEX и доступность ISS.");
    hints.push("Убедитесь, что в скринере фьючерсов есть активные контракты Si / CNY / ED.");
  } else if (withPoints.length === 1) {
    hints.push("Для графика нужны минимум два инструмента с общими датами.");
    hints.push("Проверьте альтернативный контракт семьи с большей историей (см. диагностику).");
  } else {
    hints.push("Есть история по отдельным контрактам, но нет пересечения дат для совместного графика.");
    hints.push("Дождитесь следующего торгового дня или проверьте соседние серии (ближний/дальний месяц).");
  }

  for (const e of excluded) {
    hints.push(`${e.family} (${e.label}): ${e.reason}`);
  }

  return hints;
}

function correlationForPair(
  history: CurrencyHistoryResponse,
  pair: CurrencyHistoryPairKey,
  days: CurrencyChartDays,
): number | null {
  const [fa, fb] = pair.split("/") as [CurrencyCorrelationFamily, CurrencyCorrelationFamily];
  const instA = history.instruments.find((i) => i.family === fa);
  const instB = history.instruments.find((i) => i.family === fb);
  if (!instA?.points.length || !instB?.points.length) return null;

  const aligned = alignPairByDate(
    { key: fa, points: instA.points },
    { key: fb, points: instB.points },
  );
  const sliceFrom = Math.max(0, aligned.dates.length - days);
  if (aligned.dates.length - sliceFrom < 3) return null;

  const ra = calcDailyReturns(aligned.closes[fa]?.slice(sliceFrom) ?? []);
  const rb = calcDailyReturns(aligned.closes[fb]?.slice(sliceFrom) ?? []);
  return pearsonCorrelation(ra, rb);
}

function buildAllCorrelations(history: CurrencyHistoryResponse, days: CurrencyChartDays) {
  return {
    "SI/CNY": correlationForPair(history, "SI/CNY", days),
    "SI/ED": correlationForPair(history, "SI/ED", days),
    "CNY/ED": correlationForPair(history, "CNY/ED", days),
  };
}

function findReturnToBundleEvents(
  dates: string[],
  divergenceZ: Record<string, number[]>,
  familyByKey: Record<string, CurrencyCorrelationFamily>,
): DivergenceEvent[] {
  const events: DivergenceEvent[] = [];
  for (const [key, zSeries] of Object.entries(divergenceZ)) {
    for (let i = 1; i < zSeries.length; i++) {
      const prev = zSeries[i - 1]!;
      const cur = zSeries[i]!;
      if (Math.abs(prev) >= 1.5 && Math.abs(cur) < 0.5) {
        events.push({
          date: dates[i] ?? "",
          key,
          family: familyByKey[key] ?? "SI",
          direction: "ниже корзины",
          strength: Math.abs(prev),
          divergenceZ: cur,
        });
      }
    }
  }
  return events;
}

function markerLabel(event: DivergenceEvent, isReturn: boolean): string {
  if (isReturn) return "возврат к связке";
  if (Math.abs(event.divergenceZ) >= 2) return "отрыв от корзины";
  return "расхождение";
}

function buildMarkers(
  dates: string[],
  divergenceZ: Record<string, number[]>,
  familyByKey: Record<string, CurrencyCorrelationFamily>,
): ChartMarkerItem[] {
  const diverge = findDivergenceEvents(dates, divergenceZ, familyByKey, 1.5);
  const returns = findReturnToBundleEvents(dates, divergenceZ, familyByKey);
  const returnKeys = new Set(returns.map((e) => `${e.date}|${e.family}`));

  const items: ChartMarkerItem[] = [
    ...diverge.map((e) => ({
      time: e.date,
      family: e.family,
      text: markerLabel(e, false),
      color: Math.abs(e.divergenceZ) >= 2 ? "#fb7185" : "#c4b5fd",
      strength: e.strength,
    })),
    ...returns.map((e) => ({
      time: e.date,
      family: e.family,
      text: "возврат к связке",
      color: "#34d399",
      strength: e.strength,
    })),
  ];

  const seen = new Set<string>();
  return items
    .filter((m) => {
      const id = `${m.time}|${m.family}|${m.text}`;
      if (seen.has(id)) return false;
      seen.add(id);
      if (returnKeys.has(`${m.time}|${m.family}`) && m.text === "расхождение") return false;
      return true;
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
}

function buildNowSummary(
  dataMode: CurrencyChartDataMode,
  chartFamilies: CurrencyCorrelationFamily[],
  excluded: ExcludedInstrument[],
  dates: string[],
  normalizedByKey: Record<string, number[]>,
  divergence: Record<string, number[]>,
  correlations: CurrencyChartModel["correlations"],
  tickersByFamily: Partial<Record<CurrencyCorrelationFamily, string>>,
): string {
  if (dataMode === "diagnostic" || chartFamilies.length < 2) {
    return "Недостаточно истории для анализа связки.";
  }

  if (dataMode === "partial" && chartFamilies.length === 2) {
    const labels = chartFamilies.map((f) => CURRENCY_FAMILY_META[f].label);
    const codes = chartFamilies.join(" и ");
    const excludedText =
      excluded.length > 0
        ? `${excluded.map((e) => e.family).join(", ")} исключён из-за отсутствия общей истории.`
        : "";
    return `Сравнение построено по двум доступным контрактам: ${codes} (${labels.join(", ")}). ${excludedText}`.trim();
  }

  if (dates.length < 2) {
    return "Недостаточно общих точек для вывода по текущему срезу.";
  }

  const last = dates.length - 1;
  const parts: string[] = [];

  if (chartFamilies.includes("SI") && chartFamilies.includes("CNY")) {
    const siNorm = normalizedByKey.SI?.[last];
    const cnyNorm = normalizedByKey.CNY?.[last];
    if (siNorm != null && cnyNorm != null && Number.isFinite(siNorm) && Number.isFinite(cnyNorm)) {
      const diffPp = cnyNorm - siNorm;
      if (Math.abs(diffPp) >= 0.15) {
        const word = diffPp < 0 ? "отстаёт от" : "опережает";
        parts.push(
          `${CURRENCY_FAMILY_META.CNY.label} ${word} ${CURRENCY_FAMILY_META.SI.label.toLowerCase()} на ${Math.abs(diffPp).toFixed(1)} п.п.`,
        );
      }
    }
    const siCny = correlations["SI/CNY"];
    if (siCny != null) {
      if (siCny > 0.75) parts.push("Корреляция доллар/рубль и юань/рубль высокая.");
      else if (siCny < 0.4) parts.push("Связь между рублёвыми парами ослабла.");
    }
  }

  if (chartFamilies.includes("ED")) {
    const siEd = correlations["SI/ED"];
    const cnyEd = correlations["CNY/ED"];
    if ((siEd != null && siEd < 0.35) || (cnyEd != null && cnyEd < 0.35)) {
      parts.push("Евро/доллар движется отдельно от рублёвых пар.");
    } else if (siEd != null && siEd > 0.65) {
      parts.push("Евро/доллар идёт в связке с доллар/рубль.");
    }
  }

  let maxDev = { family: chartFamilies[0]!, gap: 0 };
  for (const family of chartFamilies) {
    const div = divergence[family]?.[last];
    if (div == null || !Number.isFinite(div)) continue;
    const gap = Math.abs(div);
    if (gap > maxDev.gap) maxDev = { family, gap };
  }
  if (maxDev.gap >= 0.5) {
    const meta = CURRENCY_FAMILY_META[maxDev.family];
    parts.push(`${meta.label} сильнее всех отклонился от корзины (${tickersByFamily[maxDev.family] ?? maxDev.family}).`);
  }

  parts.push(`Общих точек на графике: ${dates.length}.`);
  return parts.length ? parts.join(" ") : "Ряды движутся близко к корзине, выраженных расхождений нет.";
}

function resolveChartFamilies(history: CurrencyHistoryResponse): CurrencyCorrelationFamily[] {
  if (history.chartInstruments.length >= 2) {
    return history.chartInstruments;
  }
  return history.instruments
    .filter((i) => i.status === "ok" && (i.pointsCount ?? i.points.length) >= MIN_CHART_POINTS)
    .map((i) => i.family);
}

export function buildCurrencyChartModel(
  history: CurrencyHistoryResponse | undefined,
  days: CurrencyChartDays,
  mode: CurrencyChartMode,
): CurrencyChartModel | null {
  if (!history) return null;

  const correlations = buildAllCorrelations(history, days);
  const chartFamilies = resolveChartFamilies(history);
  const excludedInstruments = buildExcludedList(history, chartFamilies);
  const dataMode: CurrencyChartDataMode =
    chartFamilies.length >= 3 ? "full" : chartFamilies.length === 2 ? "partial" : "diagnostic";
  const canRenderChart = chartFamilies.length >= 2;
  const partialModePill = dataMode === "partial" ? buildPartialModePill(excludedInstruments) : null;
  const diagnosticHints = dataMode === "diagnostic" ? buildDiagnosticHints(history, excludedInstruments) : [];

  const emptyChart: Omit<CurrencyChartModel, "series" | "markers" | "dates" | "tooltipIndex"> = {
    mode,
    days,
    dataMode,
    chartInstruments: chartFamilies,
    excludedInstruments,
    canRenderChart,
    partialModePill,
    diagnosticHints,
    correlations,
    commonDates: 0,
    tickersByFamily: Object.fromEntries(
      history.instruments.map((i) => [i.family, i.ticker]),
    ) as Partial<Record<CurrencyCorrelationFamily, string>>,
    nowSummary: buildNowSummary(
      dataMode,
      chartFamilies,
      excludedInstruments,
      [],
      {},
      {},
      correlations,
      {},
    ),
    chartWarnings: history.chartWarnings,
    basketNote: history.basketNote,
    commonDatesByPair: history.commonDatesByPair,
  };

  if (!canRenderChart) {
    return {
      ...emptyChart,
      dates: [],
      series: [],
      markers: [],
      tooltipIndex: new Map(),
    };
  }

  const ok = history.instruments.filter(
    (i) => chartFamilies.includes(i.family) && i.status === "ok" && i.points.length > 0,
  );
  const aligned = alignSeriesByDate(ok.map((i) => ({ key: i.family, points: i.points })));
  const slicedDates = aligned.dates.slice(-days);
  if (slicedDates.length < 2) {
    return {
      ...emptyChart,
      dataMode: "diagnostic",
      canRenderChart: false,
      diagnosticHints: buildDiagnosticHints(history, excludedInstruments),
      dates: [],
      series: [],
      markers: [],
      tooltipIndex: new Map(),
      nowSummary: "Недостаточно истории для анализа связки.",
    };
  }

  const sliceIndex = aligned.dates.length - slicedDates.length;
  const closes: Record<string, number[]> = {};
  for (const [key, values] of Object.entries(aligned.closes)) {
    closes[key] = values.slice(sliceIndex);
  }

  const normalizedByKey: Record<string, number[]> = {};
  const returnsByKey: Record<string, number[]> = {};
  for (const [key, series] of Object.entries(closes)) {
    normalizedByKey[key] = normalizeToBase100(series);
    returnsByKey[key] = calcDailyReturns(series);
  }

  const { byKey: divergence, divergenceZ } = calcDivergence(slicedDates, normalizedByKey);
  const familyByKey = Object.fromEntries(ok.map((i) => [i.family, i.family])) as Record<
    string,
    CurrencyCorrelationFamily
  >;

  const tickersByFamily = Object.fromEntries(ok.map((i) => [i.family, i.ticker])) as Partial<
    Record<CurrencyCorrelationFamily, string>
  >;

  const returnsByKeyPct: Record<string, number[]> = {};
  for (const [key, rets] of Object.entries(returnsByKey)) {
    returnsByKeyPct[key] = [0, ...rets.map((r) => (Number.isFinite(r) ? r * 100 : NaN))];
  }

  const tooltipIndex = new Map<
    string,
    Record<
      CurrencyCorrelationFamily,
      { normalized: number; dailyReturnPct: number; divergence: number; ticker: string } | undefined
    >
  >();

  for (let i = 0; i < slicedDates.length; i++) {
    const date = slicedDates[i]!;
    const row: Record<
      CurrencyCorrelationFamily,
      { normalized: number; dailyReturnPct: number; divergence: number; ticker: string } | undefined
    > = { SI: undefined, CNY: undefined, ED: undefined };
    for (const family of chartFamilies) {
      if (!closes[family]) continue;
      row[family] = {
        ticker: tickersByFamily[family] ?? family,
        normalized: normalizedByKey[family]?.[i] ?? NaN,
        dailyReturnPct: returnsByKeyPct[family]?.[i] ?? NaN,
        divergence: divergence[family]?.[i] ?? NaN,
      };
    }
    tooltipIndex.set(date, row);
  }

  const series: ChartFamilySeries[] = [];
  for (const inst of ok) {
    const family = inst.family;
    let data: ChartLinePoint[] = [];

    if (mode === "normalize") {
      data = slicedDates.map((time, i) => ({ time, value: normalizedByKey[family]![i]! }));
    } else if (mode === "returns") {
      data = slicedDates.map((time, i) => ({ time, value: returnsByKeyPct[family]![i]! }));
    } else {
      data = slicedDates.map((time, i) => ({ time, value: divergence[family]![i]! }));
    }

    data = data.filter((p) => Number.isFinite(p.value));
    if (!data.length) continue;

    series.push({
      family,
      label: inst.label,
      ticker: inst.ticker,
      color: FAMILY_CHART_COLORS[family],
      data,
    });
  }

  const markers =
    mode === "divergence" || mode === "normalize"
      ? buildMarkers(slicedDates, divergenceZ, familyByKey)
      : [];

  const nowSummary = buildNowSummary(
    dataMode,
    chartFamilies,
    excludedInstruments,
    slicedDates,
    normalizedByKey,
    divergence,
    correlations,
    tickersByFamily,
  );

  const basketSuffix = history.basketNote ? ` ${history.basketNote}.` : "";

  return {
    mode,
    days,
    dataMode,
    chartInstruments: chartFamilies,
    excludedInstruments,
    canRenderChart: series.length >= 2,
    partialModePill,
    diagnosticHints,
    dates: slicedDates,
    series,
    markers,
    correlations,
    commonDates: slicedDates.length,
    tickersByFamily,
    tooltipIndex,
    nowSummary: `${nowSummary}${basketSuffix}`.trim(),
    chartWarnings: history.chartWarnings,
    basketNote: history.basketNote,
    commonDatesByPair: history.commonDatesByPair,
  };
}
