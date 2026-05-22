import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import { FAMILY_CHART_COLORS, type ChartFamilySeries, type ChartMarkerItem } from "@/lib/domain/currency-correlation-chart-model";
import type {
  IntradayCandlePoint,
  IntradayCurrencyResponse,
} from "@/lib/domain/currency-correlation-intraday";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import {
  CURRENCY_PAIR_CONFIGS,
  getPairConfig,
  PAIR_DEFS,
  type PointsPairKey,
} from "@/lib/domain/currency-pair-config";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
  formatPairLegValue,
  formatPairSpreadValue,
  getPairStrengthLabel,
  pairChartPriceFormatter,
  zScoreBadgeFromZ,
  type PairZBadge,
} from "@/lib/domain/currency-pair-divergence";
import {
  alignIntradayByTimestamp,
  findSpreadEvents,
  type SpreadEvent,
} from "@/lib/domain/currency-intraday-series";
import {
  alignIntradayForPair,
  insufficientPairAlignmentMessage,
  type PairAlignmentResult,
  type PairAlignmentStats,
} from "@/lib/domain/currency-time-series-align";
import {
  formatAlignedLegTooltip,
} from "@/lib/domain/currency-pair-divergence";
import {
  resolveSpreadUnitMode,
  type ContractPointSpec,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import {
  analyzeSpreadPairLifecycle,
  pickGlobalLifecycleMarkers,
  type SpreadLifecycleChartMarker,
  type SpreadLifecycleSensitivity,
  type SpreadPairLifecycleModel,
} from "@/lib/domain/spread-lifecycle";
import type { WeeklySpreadSeries } from "@/lib/domain/currency-correlation-weeks";
import { buildSpreadWeeklyContext } from "@/lib/domain/spread-lifecycle-weekly";
import { buildSpreadTrajectoryBundle, type SpreadTrajectoryBundle } from "@/lib/domain/spread-trajectory";
import {
  DEFAULT_SPREAD_ANCHOR_MODE,
  divergenceOptionsFromResolution,
  formatAnchorTimestamp,
  resolveSpreadAnchor,
  SPREAD_ANCHOR_HINT,
  SPREAD_ANCHOR_MODE_LABELS,
  type SpreadAnchorMode,
  type SpreadAnchorResolution,
} from "@/lib/domain/currency-spread-anchor";

export type { PointsPairKey } from "@/lib/domain/currency-pair-config";
export type PointsPairFilter = PointsPairKey | "all";
export type PointsBetaMode = "1:1" | "auto";

export type SpreadStatusLabel = PairZBadge;

export type PairTooltipPairDetail = {
  pairKey: PointsPairKey;
  legALabel: string;
  legAFormatted: string;
  legADetail: string;
  legBLabel: string;
  legBFormatted: string;
  legBDetail: string;
  spreadFormatted: string;
  strengthLabel: string;
  z: number | null;
};

export type PairSpreadSnapshot = {
  pairKey: PointsPairKey;
  label: string;
  familyA: CurrencyCorrelationFamily;
  familyB: CurrencyCorrelationFamily;
  calculationMode: "percent" | "points";
  unit: "%" | "п.";
  modeLabelRu: string;
  experimental: boolean;
  currentSpread: number | null;
  minSpread: number | null;
  maxSpread: number | null;
  currentZ: number | null;
  status: SpreadStatusLabel;
  strengthLabel: string;
};

export type PointsTooltipRow = {
  family: CurrencyCorrelationFamily;
  label: string;
  ticker: string;
  /** Значение на графике (в effectiveUnitMode). */
  points: number;
  rawPoints: number | null;
  normalizedSteps: number | null;
  moneyRub: number | null;
  color: string;
};

export type PointsTooltipSnapshot = {
  timeLabel: string;
  rows: PointsTooltipRow[];
  pairs: Partial<Record<PointsPairKey, PairTooltipPairDetail>>;
  diffSiCny: number | null;
  diffSiEd: number | null;
  diffCnyEd: number | null;
  zSiCny: number | null;
  zSiEd: number | null;
  zCnyEd: number | null;
  anchorSpread: number | null;
  anchorZ: number | null;
};

export type SpreadAnchorDisplay = {
  timestamp: string;
  timestampFormatted: string;
  modeLabel: string;
  effectiveModeLabel: string;
  chartTime: string;
  markerLabel: string;
  forwardFilledNote: string | null;
  fallbackWarning: string | null;
  hint: string;
};

export type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";

export type CurrencyPointsChartModel = {
  chartKind: "points" | "spread" | "trajectory";
  canRenderChart: boolean;
  partialMode: boolean;
  partialModePill: string | null;
  chartInstruments: CurrencyCorrelationFamily[];
  excludedFamilies: CurrencyCorrelationFamily[];
  commonTimestamps: number;
  usedInterval: number;
  requestedInterval: number;
  intervalNotice?: string;
  days: number;
  dates: string[];
  series: ChartFamilySeries[];
  markers: ChartMarkerItem[];
  spreads: PairSpreadSnapshot[];
  tooltipIndex: Map<string, PointsTooltipSnapshot>;
  tickersByFamily: Partial<Record<CurrencyCorrelationFamily, string>>;
  diagnosticMessage: string | null;
  requestedUnitMode: SpreadUnitMode;
  effectiveUnitMode: SpreadUnitMode;
  unitWarning: string | null;
  specsByFamily: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>;
  lifecycleByPair?: Partial<Record<PointsPairKey, SpreadPairLifecycleModel>>;
  lifecycleMarkers?: SpreadLifecycleChartMarker[];
  spreadChartUsesZ?: boolean;
  trajectory?: SpreadTrajectoryBundle | null;
  focusPair: PointsPairKey;
  focusPairChartTitle: string;
  focusPairPriceFormatter: (v: number) => string;
  /** Точное пересечение SI+CNY+ED (legacy, для справки). */
  exactCommonTimestamps: number;
  focusAlignmentStats: PairAlignmentStats | null;
  pairAlignmentStats: Partial<Record<PointsPairKey, PairAlignmentStats>>;
  anchor?: SpreadAnchorDisplay;
  isoByChartTime: Map<string, string>;
};

const SPREAD_LINE_COLORS: Record<PointsPairKey, string> = {
  "SI/CNY": "#22d3ee",
  "SI/ED": "#a78bfa",
  "CNY/ED": "#fbbf24",
};

const ALL_FAMILIES: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];
const MIN_POINTS = 5;
const Z_WINDOW = DEFAULT_PAIR_Z_WINDOW;

export function spreadStatusFromZ(z: number | null): SpreadStatusLabel {
  return zScoreBadgeFromZ(z);
}

function toChartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return String(Math.floor(ms / 1000));
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function spreadEventMarkerText(
  event: SpreadEvent,
  familyA: CurrencyCorrelationFamily,
  familyB: CurrencyCorrelationFamily,
): string {
  const metaA = CURRENCY_FAMILY_META[familyA];
  const metaB = CURRENCY_FAMILY_META[familyB];

  if (familyA === "ED" || familyB === "ED") {
    const other = familyA === "ED" ? familyB : familyA;
    if (event.direction === "A_above_B" && event.pair.startsWith("ED")) {
      return "ED отдельно";
    }
    if (event.direction === "B_above_A" && event.pair.endsWith("ED")) {
      return "ED отдельно";
    }
    return `ED vs ${other}`;
  }

  if (event.direction === "A_above_B") {
    return `${familyA} убежал от ${familyB}`;
  }
  return `${familyB} убежал от ${familyA}`;
}

function buildPairAlignments(
  seriesInput: Record<string, IntradayCandlePoint[]>,
  intervalMinutes: number,
  chartFamilies: CurrencyCorrelationFamily[],
): Partial<Record<PointsPairKey, PairAlignmentResult>> {
  const out: Partial<Record<PointsPairKey, PairAlignmentResult>> = {};
  for (const p of PAIR_DEFS) {
    if (!chartFamilies.includes(p.a) || !chartFamilies.includes(p.b)) continue;
    const result = alignIntradayForPair(p.pairKey, seriesInput, intervalMinutes);
    if (result) out[p.pairKey] = result;
  }
  return out;
}

function buildSpreadSnapshot(
  aligned: AlignedIntradayRow[],
  pairKey: PointsPairKey,
  hedgeRatio: number,
  anchorResolution: SpreadAnchorResolution | null,
): PairSpreadSnapshot {
  const config = getPairConfig(pairKey);
  const divergence = calculatePairDivergence(
    aligned,
    pairKey,
    hedgeRatio,
    Z_WINDOW,
    anchorResolution ? divergenceOptionsFromResolution(anchorResolution) : undefined,
  );
  const emptyBase = {
    pairKey,
    label: config.label,
    familyA: config.leftInstrument,
    familyB: config.rightInstrument,
    calculationMode: config.calculationMode,
    unit: config.unit,
    modeLabelRu: config.modeLabelRu,
    experimental: config.availability === "experimental",
    currentSpread: null,
    minSpread: null,
    maxSpread: null,
    currentZ: null,
    status: "—" as const,
    strengthLabel: "—",
  };

  if (!divergence) return emptyBase;

  const finiteSpread = divergence.spread.filter(Number.isFinite);
  const last = finiteSpread.length ? finiteSpread[finiteSpread.length - 1]! : null;
  const lastZ = divergence.zScores.length
    ? divergence.zScores[divergence.zScores.length - 1]!
    : null;

  return {
    ...emptyBase,
    currentSpread: last != null && Number.isFinite(last) ? last : null,
    minSpread: finiteSpread.length ? Math.min(...finiteSpread) : null,
    maxSpread: finiteSpread.length ? Math.max(...finiteSpread) : null,
    currentZ: lastZ,
    status: spreadStatusFromZ(lastZ),
    strengthLabel: getPairStrengthLabel(config, last),
  };
}

function buildPairTooltipDetail(
  divergence: NonNullable<ReturnType<typeof calculatePairDivergence>>,
  index: number,
  alignment?: PairAlignmentResult | null,
): PairTooltipPairDetail {
  const { config, legA, legB, spread, zScores } = divergence;
  const aVal = legA[index]!;
  const bVal = legB[index]!;
  const sp = spread[index]!;
  const pt = alignment?.points[index];
  const aFmt = formatPairLegValue(aVal, config);
  const bFmt = formatPairLegValue(bVal, config);
  return {
    pairKey: divergence.pairKey,
    legALabel: config.leftInstrument,
    legAFormatted: aFmt,
    legADetail: formatAlignedLegTooltip(config.leftInstrument, aFmt, pt, "left"),
    legBLabel: config.rightInstrument,
    legBFormatted: bFmt,
    legBDetail: formatAlignedLegTooltip(config.rightInstrument, bFmt, pt, "right"),
    spreadFormatted: formatPairSpreadValue(sp, config),
    strengthLabel: getPairStrengthLabel(config, sp),
    z: zScores[index] ?? null,
  };
}

export type BuildPointsModelOptions = {
  unitMode?: SpreadUnitMode;
  specsByFamily?: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>;
  lifecycleSensitivity?: SpreadLifecycleSensitivity;
  lifecycleFocusPair?: PointsPairKey | null;
  anchorMode?: SpreadAnchorMode;
  manualAnchorTime?: string | null;
  /** Недельные ряды по паре (текущая + прошлые) для недельного контекста lifecycle. */
  weeklyWeeksByPair?: Partial<Record<PointsPairKey, WeeklySpreadSeries[]>>;
};

function anchorDisplayFromResolution(
  resolution: SpreadAnchorResolution,
): SpreadAnchorDisplay {
  return {
    timestamp: resolution.timestamp,
    timestampFormatted: formatAnchorTimestamp(resolution.timestamp),
    modeLabel: SPREAD_ANCHOR_MODE_LABELS[resolution.requestedMode],
    effectiveModeLabel: SPREAD_ANCHOR_MODE_LABELS[resolution.effectiveMode],
    chartTime: toChartTime(resolution.timestamp),
    markerLabel: SPREAD_ANCHOR_MODE_LABELS[resolution.effectiveMode],
    forwardFilledNote: resolution.forwardFilledAtAnchor
      ? "якорь с протянутой ценой"
      : null,
    fallbackWarning: resolution.fallbackWarning,
    hint: SPREAD_ANCHOR_HINT,
  };
}

function resolvePairAnchor(
  alignment: PairAlignmentResult | null | undefined,
  options: BuildPointsModelOptions,
  intervalMinutes: number,
): SpreadAnchorResolution | null {
  if (!alignment?.rows.length) return null;
  return resolveSpreadAnchor(
    alignment.rows,
    alignment.points,
    options.anchorMode ?? DEFAULT_SPREAD_ANCHOR_MODE,
    { manualAnchorTime: options.manualAnchorTime, intervalMinutes },
  );
}

function buildMarkersFromEvents(
  events: SpreadEvent[],
  familyA: CurrencyCorrelationFamily,
  familyB: CurrencyCorrelationFamily,
  pairFilter: PointsPairFilter,
): ChartMarkerItem[] {
  const filtered =
    pairFilter === "all"
      ? events
      : events.filter((e) => e.pair === pairFilter || e.pair.replace("/", "-") === pairFilter);

  return filtered
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 10)
    .map((e) => {
      const leader =
        e.direction === "A_above_B"
          ? familyA
          : familyB;
      return {
        time: toChartTime(e.timestamp),
        family: leader,
        text: spreadEventMarkerText(e, familyA, familyB),
        color: Math.abs(e.zScore) >= 2 ? "#fb7185" : "#fbbf24",
        strength: Math.abs(e.zScore),
      };
    });
}

export function buildCurrencyPointsModel(
  response: IntradayCurrencyResponse | undefined,
  pairFilter: PointsPairFilter = "all",
  hedgeRatio = 1,
  options: BuildPointsModelOptions = {},
): CurrencyPointsChartModel | null {
  if (!response) return null;

  const requestedUnitMode = options.unitMode ?? "raw-points";
  const specsByFamily = options.specsByFamily ?? {};

  const okInstruments = response.instruments.filter(
    (i) => i.status === "ok" && i.points.length > 0,
  );
  const seriesInput: Record<string, (typeof okInstruments)[0]["points"]> = {};
  for (const inst of okInstruments) {
    seriesInput[inst.family] = inst.points;
  }

  const exactAligned = alignIntradayByTimestamp(seriesInput, response.usedInterval);
  const pairAlignments = buildPairAlignments(
    seriesInput,
    response.usedInterval,
    ALL_FAMILIES.filter((f) => seriesInput[f]?.length),
  );
  const pairAlignmentStats = Object.fromEntries(
    Object.entries(pairAlignments).map(([k, v]) => [k, v!.stats]),
  ) as Partial<Record<PointsPairKey, PairAlignmentStats>>;

  const chartFamilies = ALL_FAMILIES.filter((f) => seriesInput[f]?.length);
  const excludedFamilies = ALL_FAMILIES.filter((f) => !chartFamilies.includes(f));

  const focusPair: PointsPairKey =
    options.lifecycleFocusPair ?? (pairFilter !== "all" ? pairFilter : "SI/CNY");
  const focusConfig = getPairConfig(focusPair);
  const focusAlignment = pairAlignments[focusPair] ?? null;
  const focusAligned = focusAlignment?.rows ?? [];
  const focusStats = focusAlignment?.stats ?? null;
  const focusAnchorResolution = resolvePairAnchor(
    focusAlignment,
    options,
    response.usedInterval,
  );
  const focusAnchorDisplay = focusAnchorResolution
    ? anchorDisplayFromResolution(focusAnchorResolution)
    : undefined;

  const focusLegsAvailable =
    chartFamilies.includes(focusConfig.leftInstrument) &&
    chartFamilies.includes(focusConfig.rightInstrument);
  const canRenderChart = focusLegsAvailable && focusAligned.length >= MIN_POINTS;
  const partialMode = chartFamilies.length === 2;
  const partialModePill = partialMode
    ? `Частичный режим: график по ${chartFamilies.join(" и ")}.`
    : null;

  const tickersByFamily = Object.fromEntries(
    response.instruments.map((i) => [i.family, i.ticker]),
  ) as Partial<Record<CurrencyCorrelationFamily, string>>;

  const { effective: effectiveUnitMode, warning: unitWarning } = resolveSpreadUnitMode(
    requestedUnitMode,
    specsByFamily,
    chartFamilies.length ? chartFamilies : ALL_FAMILIES,
  );

  const focusMeta = {
    focusPair,
    focusPairChartTitle: focusConfig.chartTitle,
    focusPairPriceFormatter: pairChartPriceFormatter(focusConfig),
    exactCommonTimestamps: exactAligned.length,
    focusAlignmentStats: focusStats,
    pairAlignmentStats,
  };

  const anchorByPair: Partial<Record<PointsPairKey, SpreadAnchorResolution>> = {};
  for (const p of PAIR_DEFS) {
    const resolution = resolvePairAnchor(
      pairAlignments[p.pairKey],
      options,
      response.usedInterval,
    );
    if (resolution) anchorByPair[p.pairKey] = resolution;
  }

  const emptySpreads = CURRENCY_PAIR_CONFIGS.map((c) => {
    const rows = pairAlignments[c.pairKey]?.rows ?? [];
    return buildSpreadSnapshot(rows, c.pairKey, hedgeRatio, anchorByPair[c.pairKey] ?? null);
  });

  const alignDiagnostic = insufficientPairAlignmentMessage(focusStats, focusConfig.label);

  const empty: CurrencyPointsChartModel = {
    chartKind: "points",
    canRenderChart: false,
    partialMode,
    partialModePill,
    chartInstruments: chartFamilies,
    excludedFamilies,
    commonTimestamps: focusAligned.length,
    usedInterval: response.usedInterval,
    requestedInterval: response.requestedInterval,
    intervalNotice: response.intervalNotice,
    days: response.days,
    dates: [],
    series: [],
    markers: [],
    spreads: emptySpreads,
    tooltipIndex: new Map(),
    isoByChartTime: new Map(),
    tickersByFamily,
    diagnosticMessage:
      !focusLegsAvailable
        ? "Нужны минимум два инструмента с реальными свечами."
        : alignDiagnostic || null,
    requestedUnitMode,
    effectiveUnitMode,
    unitWarning,
    specsByFamily,
    anchor: focusAnchorDisplay,
    ...focusMeta,
  };

  if (!canRenderChart) return empty;

  const divergenceByPair: Partial<
    Record<PointsPairKey, NonNullable<ReturnType<typeof calculatePairDivergence>>>
  > = {};
  for (const p of PAIR_DEFS) {
    if (!chartFamilies.includes(p.a) || !chartFamilies.includes(p.b)) continue;
    const rows = pairAlignments[p.pairKey]?.rows ?? [];
    const div = calculatePairDivergence(
      rows,
      p.pairKey,
      hedgeRatio,
      Z_WINDOW,
      anchorByPair[p.pairKey]
        ? divergenceOptionsFromResolution(anchorByPair[p.pairKey]!)
        : undefined,
    );
    if (div) divergenceByPair[p.pairKey] = div;
  }

  const chartTimes = focusAligned.map((r) => toChartTime(r.timestamp));
  const isoByChartTime = new Map(
    focusAligned.map((r, i) => [chartTimes[i]!, r.timestamp] as const),
  );
  const tooltipIndex = new Map<string, PointsTooltipSnapshot>();
  const focusDiv = divergenceByPair[focusPair];

  for (let i = 0; i < focusAligned.length; i++) {
    const row = focusAligned[i]!;
    const time = chartTimes[i]!;
    const pairs: Partial<Record<PointsPairKey, PairTooltipPairDetail>> = {};

    for (const p of PAIR_DEFS) {
      const div = divergenceByPair[p.pairKey];
      if (div) {
        pairs[p.pairKey] = buildPairTooltipDetail(div, i, pairAlignments[p.pairKey]);
      }
    }

    const pickSpread = (key: PointsPairKey) => divergenceByPair[key]?.spread[i] ?? null;
    const pickZ = (key: PointsPairKey) => divergenceByPair[key]?.zScores[i] ?? null;

    const legRows: PointsTooltipRow[] = focusDiv
      ? [
          {
            family: focusConfig.leftInstrument,
            label: CURRENCY_FAMILY_META[focusConfig.leftInstrument].label,
            ticker: tickersByFamily[focusConfig.leftInstrument] ?? focusConfig.leftInstrument,
            points: focusDiv.legA[i]!,
            rawPoints: null,
            normalizedSteps: null,
            moneyRub: null,
            color: FAMILY_CHART_COLORS[focusConfig.leftInstrument],
          },
          {
            family: focusConfig.rightInstrument,
            label: CURRENCY_FAMILY_META[focusConfig.rightInstrument].label,
            ticker: tickersByFamily[focusConfig.rightInstrument] ?? focusConfig.rightInstrument,
            points: focusDiv.legB[i]!,
            rawPoints: null,
            normalizedSteps: null,
            moneyRub: null,
            color: FAMILY_CHART_COLORS[focusConfig.rightInstrument],
          },
        ]
      : [];

    tooltipIndex.set(time, {
      timeLabel: formatTimeLabel(row.timestamp),
      rows: legRows,
      pairs,
      diffSiCny: pickSpread("SI/CNY"),
      diffSiEd: pickSpread("SI/ED"),
      diffCnyEd: pickSpread("CNY/ED"),
      zSiCny: pickZ("SI/CNY"),
      zSiEd: pickZ("SI/ED"),
      zCnyEd: pickZ("CNY/ED"),
      anchorSpread: focusDiv?.spread[i] ?? null,
      anchorZ: focusDiv?.zScores[i] ?? null,
    });
  }

  const legFamilies = [focusConfig.leftInstrument, focusConfig.rightInstrument].filter((f) =>
    chartFamilies.includes(f),
  );

  const series: ChartFamilySeries[] =
    focusDiv && legFamilies.length >= 2
      ? legFamilies.map((family) => {
          const inst = response.instruments.find((i) => i.family === family)!;
          const legData = family === focusConfig.leftInstrument ? focusDiv.legA : focusDiv.legB;
          return {
            family,
            label: `${family} (${focusConfig.modeLabelRu})`,
            ticker: inst.ticker,
            color: FAMILY_CHART_COLORS[family],
            data: chartTimes.map((time, i) => ({
              time,
              value: legData[i]!,
            })),
          };
        })
      : [];

  const spreads = PAIR_DEFS.filter(
    (p) => chartFamilies.includes(p.a) && chartFamilies.includes(p.b),
  ).map((p) =>
    buildSpreadSnapshot(
      pairAlignments[p.pairKey]?.rows ?? [],
      p.pairKey,
      hedgeRatio,
      anchorByPair[p.pairKey] ?? null,
    ),
  );

  let allEvents: SpreadEvent[] = [];
  for (const p of PAIR_DEFS) {
    if (!chartFamilies.includes(p.a) || !chartFamilies.includes(p.b)) continue;
    const rows = pairAlignments[p.pairKey]?.rows ?? [];
    const anchorOpts = anchorByPair[p.pairKey]
      ? divergenceOptionsFromResolution(anchorByPair[p.pairKey]!)
      : undefined;
    allEvents = allEvents.concat(
      findSpreadEvents(rows, p.pairKey, hedgeRatio, Z_WINDOW, 1.5, anchorOpts),
    );
  }

  const markerPairs =
    pairFilter === "all"
      ? PAIR_DEFS.filter((p) => chartFamilies.includes(p.a) && chartFamilies.includes(p.b))
      : PAIR_DEFS.filter((p) => p.pairKey === pairFilter);

  const markers: ChartMarkerItem[] = [];
  for (const p of markerPairs) {
    markers.push(
      ...buildMarkersFromEvents(
        allEvents.filter((e) => e.pair === p.pairKey),
        p.a,
        p.b,
        pairFilter,
      ),
    );
  }

  const uniqueMarkers = [...markers]
    .sort((a, b) => b.strength - a.strength)
    .filter((m, idx, arr) => arr.findIndex((x) => x.time === m.time && x.family === m.family) === idx)
    .slice(0, 10);

  return {
    chartKind: "points",
    canRenderChart: true,
    partialMode,
    partialModePill,
    chartInstruments: chartFamilies,
    excludedFamilies,
    commonTimestamps: focusAligned.length,
    usedInterval: response.usedInterval,
    requestedInterval: response.requestedInterval,
    intervalNotice: response.intervalNotice,
    days: response.days,
    dates: chartTimes,
    series,
    markers: uniqueMarkers,
    spreads,
    tooltipIndex,
    isoByChartTime,
    tickersByFamily,
    diagnosticMessage: null,
    requestedUnitMode,
    effectiveUnitMode,
    unitWarning,
    specsByFamily,
    anchor: focusAnchorDisplay,
    ...focusMeta,
  };
}

/** График расхождения пары (в % или п.) по интрадей. */
export function buildSpreadChartModel(
  response: IntradayCurrencyResponse | undefined,
  pairFilter: PointsPairFilter = "all",
  hedgeRatio = 1,
  options: BuildPointsModelOptions = {},
): CurrencyPointsChartModel | null {
  const base = buildCurrencyPointsModel(response, pairFilter, hedgeRatio, options);
  if (!base) return null;

  if (!base.canRenderChart) {
    return { ...base, chartKind: "spread", series: [], markers: [], tooltipIndex: new Map() };
  }

  const okInstruments = response!.instruments.filter(
    (i) => i.status === "ok" && i.points.length > 0,
  );
  const seriesInput: Record<string, (typeof okInstruments)[0]["points"]> = {};
  for (const inst of okInstruments) {
    seriesInput[inst.family] = inst.points;
  }
  const chartTimes = base.dates;
  const focus = base.focusPair;
  const pairDefs = PAIR_DEFS.filter(
    (p) =>
      base.chartInstruments.includes(p.a) &&
      base.chartInstruments.includes(p.b) &&
      (pairFilter === "all" || p.pairKey === pairFilter),
  );

  const pairAlignments: Partial<Record<PointsPairKey, PairAlignmentResult>> = {};
  const divergenceByPair: Partial<
    Record<PointsPairKey, NonNullable<ReturnType<typeof calculatePairDivergence>>>
  > = {};

  for (const p of pairDefs) {
    const alignment = alignIntradayForPair(p.pairKey, seriesInput, response!.usedInterval);
    if (!alignment) continue;
    pairAlignments[p.pairKey] = alignment;
    const anchorResolution = resolvePairAnchor(
      alignment,
      options,
      response!.usedInterval,
    );
    const anchorOpts = anchorResolution
      ? divergenceOptionsFromResolution(anchorResolution)
      : undefined;
    const div = calculatePairDivergence(
      alignment.rows,
      p.pairKey,
      hedgeRatio,
      Z_WINDOW,
      anchorOpts,
    );
    if (div) divergenceByPair[p.pairKey] = div;
  }

  const focusRows = pairAlignments[focus]?.rows ?? [];
  const focusDiv = divergenceByPair[focus];

  const lifecycleSensitivity = options.lifecycleSensitivity ?? "standard";
  const lifecycleByPair: Partial<Record<PointsPairKey, SpreadPairLifecycleModel>> = {};
  for (const p of pairDefs) {
    const alignment = pairAlignments[p.pairKey];
    const rows = alignment?.rows ?? [];
    const anchorResolution = resolvePairAnchor(
      alignment,
      options,
      response!.usedInterval,
    );
    const anchorOpts = anchorResolution
      ? divergenceOptionsFromResolution(anchorResolution)
      : undefined;
    const divForWeekly = calculatePairDivergence(
      rows,
      p.pairKey,
      hedgeRatio,
      Z_WINDOW,
      anchorOpts,
    );
    const weeklyCtx = divForWeekly
      ? buildSpreadWeeklyContext(
          rows.map((r) => r.timestamp),
          divForWeekly.spread,
          options.weeklyWeeksByPair?.[p.pairKey],
        )
      : null;
    const model = analyzeSpreadPairLifecycle(
      rows,
      p.pairKey,
      p.a,
      p.b,
      lifecycleSensitivity,
      hedgeRatio,
      anchorOpts,
      anchorResolution ?? undefined,
      weeklyCtx,
    );
    if (model) lifecycleByPair[p.pairKey] = model;
  }

  const lifecycleMarkers = pickGlobalLifecycleMarkers(lifecycleByPair, focus, 12);

  const series: ChartFamilySeries[] = focusDiv
    ? [
        {
          family: getPairConfig(focus).leftInstrument,
          label: `${getPairConfig(focus).label} · ${getPairConfig(focus).modeLabelRu}`,
          ticker: focus,
          color: SPREAD_LINE_COLORS[focus],
          data: chartTimes.map((time, i) => ({
            time,
            value: focusDiv.spread[i] ?? NaN,
          })),
        },
      ]
    : [];

  const tooltipIndex = new Map<string, PointsTooltipSnapshot>();
  for (let i = 0; i < focusRows.length; i++) {
    const time = chartTimes[i]!;
    const row = focusRows[i]!;
    const pairs: Partial<Record<PointsPairKey, PairTooltipPairDetail>> = {};
    if (focusDiv) {
      pairs[focus] = buildPairTooltipDetail(focusDiv, i, pairAlignments[focus]);
    }

    tooltipIndex.set(time, {
      timeLabel: formatTimeLabel(row.timestamp),
      rows: [],
      pairs,
      diffSiCny: focus === "SI/CNY" ? focusDiv?.spread[i] ?? null : null,
      diffSiEd: focus === "SI/ED" ? focusDiv?.spread[i] ?? null : null,
      diffCnyEd: focus === "CNY/ED" ? focusDiv?.spread[i] ?? null : null,
      zSiCny: focus === "SI/CNY" ? focusDiv?.zScores[i] ?? null : null,
      zSiEd: focus === "SI/ED" ? focusDiv?.zScores[i] ?? null : null,
      zCnyEd: focus === "CNY/ED" ? focusDiv?.zScores[i] ?? null : null,
      anchorSpread: focusDiv?.spread[i] ?? null,
      anchorZ: focusDiv?.zScores[i] ?? null,
    });
  }

  const filteredSeries = series.filter((s) => s.data.some((d) => Number.isFinite(d.value)));

  return {
    ...base,
    chartKind: "spread",
    series: filteredSeries,
    markers: [],
    tooltipIndex,
    diagnosticMessage: filteredSeries.length ? null : "Нет пар для графика спреда.",
    canRenderChart: filteredSeries.length >= 1,
    lifecycleByPair,
    lifecycleMarkers,
    spreadChartUsesZ: false,
    focusPairPriceFormatter: pairChartPriceFormatter(
      getPairConfig(base.focusPair),
    ),
  };
}

/** Z-score / траектория одной пары с цветом по lifecycle. */
export function buildTrajectoryChartModel(
  response: IntradayCurrencyResponse | undefined,
  pairFilter: PointsPairFilter = "all",
  hedgeRatio = 1,
  options: BuildPointsModelOptions = {},
): CurrencyPointsChartModel | null {
  const base = buildCurrencyPointsModel(response, pairFilter, hedgeRatio, options);
  if (!base) return null;

  if (!base.canRenderChart) {
    return { ...base, chartKind: "trajectory", series: [], trajectory: null };
  }

  const okInstruments = response!.instruments.filter(
    (i) => i.status === "ok" && i.points.length > 0,
  );
  const seriesInput: Record<string, IntradayCandlePoint[]> = {};
  for (const inst of okInstruments) {
    seriesInput[inst.family] = inst.points;
  }
  const chartTimes = base.dates;
  const focus = options.lifecycleFocusPair ?? base.focusPair;
  const focusAlignment = alignIntradayForPair(focus, seriesInput, response!.usedInterval);
  const focusRows = focusAlignment?.rows ?? [];

  const lifecycleSensitivity = options.lifecycleSensitivity ?? "standard";
  const lifecycleByPair: Partial<Record<PointsPairKey, SpreadPairLifecycleModel>> = {};
  const pairDefs = PAIR_DEFS.filter(
    (p) => base.chartInstruments.includes(p.a) && base.chartInstruments.includes(p.b),
  );
  const focusAnchorResolution = resolvePairAnchor(
    focusAlignment,
    options,
    response!.usedInterval,
  );
  const focusAnchorOpts = focusAnchorResolution
    ? divergenceOptionsFromResolution(focusAnchorResolution)
    : undefined;

  for (const p of pairDefs) {
    const alignment =
      p.pairKey === focus
        ? focusAlignment
        : alignIntradayForPair(p.pairKey, seriesInput, response!.usedInterval);
    const rows = alignment?.rows ?? [];
    const anchorResolution = resolvePairAnchor(
      alignment,
      options,
      response!.usedInterval,
    );
    const anchorOpts = anchorResolution
      ? divergenceOptionsFromResolution(anchorResolution)
      : undefined;
    const divForWeekly = calculatePairDivergence(
      rows,
      p.pairKey,
      hedgeRatio,
      Z_WINDOW,
      anchorOpts,
    );
    const weeklyCtx = divForWeekly
      ? buildSpreadWeeklyContext(
          rows.map((r) => r.timestamp),
          divForWeekly.spread,
          options.weeklyWeeksByPair?.[p.pairKey],
        )
      : null;
    const model = analyzeSpreadPairLifecycle(
      rows,
      p.pairKey,
      p.a,
      p.b,
      lifecycleSensitivity,
      hedgeRatio,
      anchorOpts,
      anchorResolution ?? undefined,
      weeklyCtx,
    );
    if (model) lifecycleByPair[p.pairKey] = model;
  }

  const lifecycle = lifecycleByPair[focus];
  const trajectory = buildSpreadTrajectoryBundle(
    lifecycle,
    focusRows,
    chartTimes,
    response!.usedInterval,
  );

  const focusDiv = calculatePairDivergence(
    focusRows,
    focus,
    hedgeRatio,
    Z_WINDOW,
    focusAnchorOpts,
  );
  const zSeries: ChartFamilySeries[] = focusDiv
    ? [
        {
          family: getPairConfig(focus).leftInstrument,
          label: `${getPairConfig(focus).label} · z-score`,
          ticker: focus,
          color: SPREAD_LINE_COLORS[focus],
          data: chartTimes.map((time, i) => ({
            time,
            value: focusDiv.zScores[i] ?? NaN,
          })),
        },
      ]
    : [];

  const canRender =
    trajectory != null && trajectory.segmentSeries.some((s) => s.data.length >= 2);

  return {
    ...base,
    chartKind: "trajectory",
    series: zSeries.filter((s) => s.data.some((d) => Number.isFinite(d.value))),
    markers: [],
    tooltipIndex: new Map(),
    spreads: base.spreads,
    lifecycleByPair,
    trajectory,
    spreadChartUsesZ: true,
    focusPairChartTitle: `${getPairConfig(focus).label}: z-score расхождения`,
    focusPairPriceFormatter: (v) => v.toFixed(2),
    canRenderChart: canRender || zSeries.some((s) => s.data.length >= 2),
    diagnosticMessage: canRender
      ? null
      : insufficientPairAlignmentMessage(focusAlignment?.stats ?? null, getPairConfig(focus).label),
  };
}

/** Отдельный график z-score (для режима, совместимого со SpreadZChart). */
export function buildZScoreChartModel(
  response: IntradayCurrencyResponse | undefined,
  pairFilter: PointsPairFilter = "all",
  hedgeRatio = 1,
  options: BuildPointsModelOptions = {},
): CurrencyPointsChartModel | null {
  const spreadBase = buildSpreadChartModel(response, pairFilter, hedgeRatio, options);
  if (!spreadBase) return null;

  const focus = spreadBase.focusPair;
  const div = calculatePairDivergence(
    alignIntradayByTimestamp(
      Object.fromEntries(
        response!.instruments
          .filter((i) => i.status === "ok" && i.points.length)
          .map((i) => [i.family, i.points]),
      ),
      response!.usedInterval,
    ),
    focus,
    hedgeRatio,
    Z_WINDOW,
  );

  if (!div) return { ...spreadBase, spreadChartUsesZ: true, canRenderChart: false };

  const series: ChartFamilySeries[] = [
    {
      family: getPairConfig(focus).leftInstrument,
      label: `${getPairConfig(focus).label} z`,
      ticker: focus,
      color: SPREAD_LINE_COLORS[focus],
      data: spreadBase.dates.map((time, i) => ({
        time,
        value: div.zScores[i] ?? NaN,
      })),
    },
  ];

  return {
    ...spreadBase,
    chartKind: "spread",
    series: series.filter((s) => s.data.some((d) => Number.isFinite(d.value))),
    spreadChartUsesZ: true,
    focusPairChartTitle: `${getPairConfig(focus).label}: z-score расхождения`,
  };
}
