import type { ScreenerRow } from "@screenerpro/shared";
import {
  CURRENCY_FAMILY_META,
  pickActiveContractForFamily,
  pickContractCandidatesForFamily,
  resolveCurrencyFamily,
  type CurrencyCorrelationFamily,
} from "@/lib/domain/currency-correlation";
import type {
  CurrencyContractSelection,
  CurrencyHistoryInstrument,
  CurrencyHistoryPairKey,
  CurrencyHistoryPoint,
  CurrencyHistoryResponse,
} from "@/lib/domain/currency-correlation-history";
import { fetchFuturesDailyCandles } from "@/lib/server/services/moex-futures-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

const VALID_FAMILIES: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];
const SELECTION_PROBE_DAYS = 90;
const MIN_POINTS_OK = 5;
const MIN_CHART_COMMON_DATES = 2;
const RECENT_DAYS = 7;
const MIN_ACTIVITY_FOR_CHART = 0.12;

type CandidateProbe = {
  ticker: string;
  family: CurrencyCorrelationFamily;
  activityRank: number;
  activityScore: number;
  points: CurrencyHistoryPoint[];
  status: "ok" | "empty" | "error";
  error?: string;
};

type ComboPick = Partial<Record<CurrencyCorrelationFamily, CandidateProbe>>;

type ComboScore = {
  pick: ComboPick;
  families: CurrencyCorrelationFamily[];
  commonDates: number;
  score: number;
  activitySum: number;
  recency: number;
};

function formatCoverage(inst: CurrencyHistoryInstrument): CurrencyHistoryInstrument {
  const pointsCount = inst.points.length;
  const closeCount = inst.points.filter((p) => Number.isFinite(p.close)).length;
  const firstDate = pointsCount ? inst.points[0]!.date : null;
  const lastDate = pointsCount ? inst.points[pointsCount - 1]!.date : null;
  const hasRecentData = lastDate
    ? Date.now() - new Date(`${lastDate}T12:00:00Z`).getTime() <= RECENT_DAYS * 24 * 3600 * 1000
    : false;

  let coverageStatus = inst.coverageStatus;
  if (!coverageStatus) {
    if (inst.status === "error") coverageStatus = "error";
    else if (inst.status === "empty" || pointsCount === 0) coverageStatus = "empty";
    else if (pointsCount < MIN_POINTS_OK) coverageStatus = "sparse";
    else coverageStatus = "ok";
  }

  return {
    ...inst,
    pointsCount,
    closeCount,
    firstDate,
    lastDate,
    hasRecentData,
    coverageStatus,
  };
}

function probeRecency(points: CurrencyHistoryPoint[]): number {
  if (!points.length) return 0;
  const lastDate = points[points.length - 1]!.date;
  const hasRecent =
    Date.now() - new Date(`${lastDate}T12:00:00Z`).getTime() <= RECENT_DAYS * 24 * 3600 * 1000;
  if (hasRecent) return 1;
  const ageDays = (Date.now() - new Date(`${lastDate}T12:00:00Z`).getTime()) / (24 * 3600 * 1000);
  if (ageDays <= 14) return 0.5;
  return 0.1;
}

function dateSet(points: CurrencyHistoryPoint[]): Set<string> {
  const set = new Set<string>();
  for (const p of points) {
    if (Number.isFinite(p.close)) set.add(p.date);
  }
  return set;
}

function intersectDateSets(sets: Set<string>[]): string[] {
  if (!sets.length) return [];
  let dates = [...sets[0]!].sort();
  for (let i = 1; i < sets.length; i++) {
    const other = sets[i]!;
    dates = dates.filter((d) => other.has(d));
  }
  return dates;
}

function isLiquidEnough(probe: CandidateProbe): boolean {
  return probe.activityScore >= MIN_ACTIVITY_FOR_CHART;
}

function scoreCombination(pick: ComboPick): ComboScore | null {
  const probes = VALID_FAMILIES.map((f) => pick[f]).filter(
    (p): p is CandidateProbe => p != null && p.points.length >= MIN_POINTS_OK,
  );

  if (probes.length < 2) return null;

  const liquid = probes.filter(isLiquidEnough);
  const used = liquid.length >= 2 ? liquid : probes;
  if (used.length < 2) return null;

  const commonDates = intersectDateSets(used.map((p) => dateSet(p.points))).length;
  if (commonDates < MIN_CHART_COMMON_DATES) return null;

  const activitySum = used.reduce((s, p) => s + p.activityScore, 0);
  const recency =
    used.reduce((s, p) => s + probeRecency(p.points), 0) / Math.max(used.length, 1);

  const score = commonDates * 0.6 + activitySum * 0.3 + recency * 0.1;

  const families = used.map((p) => p.family);
  const slimPick: ComboPick = {};
  for (const f of families) {
    slimPick[f] = pick[f];
  }

  return { pick: slimPick, families, commonDates, score, activitySum, recency };
}

function* cartesianCombos(
  byFamily: Record<CurrencyCorrelationFamily, CandidateProbe[]>,
  families: CurrencyCorrelationFamily[],
): Generator<ComboPick> {
  function* walk(idx: number, acc: ComboPick): Generator<ComboPick> {
    if (idx >= families.length) {
      yield { ...acc };
      return;
    }
    const family = families[idx]!;
    const list = byFamily[family];
    if (!list?.length) {
      yield* walk(idx + 1, acc);
      return;
    }
    for (const probe of list) {
      yield* walk(idx + 1, { ...acc, [family]: probe });
    }
  }
  yield* walk(0, {});
}

function findBestCombination(
  byFamily: Record<CurrencyCorrelationFamily, CandidateProbe[]>,
): ComboScore | null {
  let best: ComboScore | null = null;

  const tryFamilies = (families: CurrencyCorrelationFamily[]) => {
    for (const combo of cartesianCombos(byFamily, families)) {
      const hasAny = families.some((f) => combo[f] != null);
      if (!hasAny) continue;
      const scored = scoreCombination(combo);
      if (!scored) continue;
      if (!best || scored.score > best.score) best = scored;
    }
  };

  tryFamilies(VALID_FAMILIES);

  const pairs: CurrencyCorrelationFamily[][] = [
    ["SI", "CNY"],
    ["SI", "ED"],
    ["CNY", "ED"],
  ];
  for (const pair of pairs) {
    tryFamilies(pair);
  }

  return best;
}

function buildChartSelectionReason(
  family: CurrencyCorrelationFamily,
  activeTicker: string,
  chartProbe: CandidateProbe | null,
  commonDates: number,
  excluded: boolean,
): string {
  if (excluded || !chartProbe) {
    return chartProbe?.status === "error"
      ? `ошибка MOEX ISS: ${chartProbe.error ?? "неизвестно"}`
      : "нет свечей или общих дат с остальными семьями";
  }

  const n = chartProbe.points.length;
  if (chartProbe.ticker === activeTicker) {
    return `активный контракт, ${n} точек, ${commonDates} общих дат в связке`;
  }

  return `Для графика выбран ${chartProbe.ticker} вместо ${activeTicker}: больше общих дат (${commonDates} в связке, ${n} точек)`;
}

async function probeCandidate(
  row: ScreenerRow,
  family: CurrencyCorrelationFamily,
  activityRank: number,
  maxRank: number,
): Promise<CandidateProbe> {
  const fetched = await fetchFuturesDailyCandles(row.ticker, SELECTION_PROBE_DAYS);
  const activityScore = maxRank <= 0 ? 1 : 1 - activityRank / maxRank;
  return {
    ticker: row.ticker,
    family,
    activityRank,
    activityScore,
    points: fetched.points,
    status: fetched.status,
    error: fetched.error,
  };
}

async function probeAllCandidates(
  rows: ScreenerRow[],
): Promise<{
  byFamily: Record<CurrencyCorrelationFamily, CandidateProbe[]>;
  activeNow: Record<CurrencyCorrelationFamily, string>;
}> {
  const byFamily = {} as Record<CurrencyCorrelationFamily, CandidateProbe[]>;
  const activeNow = {} as Record<CurrencyCorrelationFamily, string>;

  for (const family of VALID_FAMILIES) {
    const active = pickActiveContractForFamily(rows, family);
    activeNow[family] = active?.ticker ?? "—";

    const candidates = pickContractCandidatesForFamily(rows, family).filter(
      (row) => (row.turnover ?? 0) > 0 || (row.tradesCount ?? 0) > 0,
    );
    const maxRank = Math.max(candidates.length - 1, 1);
    byFamily[family] = await Promise.all(
      candidates.map((row, idx) => probeCandidate(row, family, idx, maxRank)),
    );
  }

  return { byFamily, activeNow };
}

function probeToInstrument(
  probe: CandidateProbe | undefined,
  family: CurrencyCorrelationFamily,
  responseDays: number,
  activeNowTicker: string,
  commonDates: number,
  onChart: boolean,
): CurrencyHistoryInstrument {
  const meta = CURRENCY_FAMILY_META[family];

  if (!probe || !onChart || probe.points.length < MIN_POINTS_OK) {
    return formatCoverage({
      family,
      ticker: "—",
      label: meta.label,
      points: [],
      status: "empty",
      activeNowTicker,
      sameAsActiveNow: false,
      excludedReason: buildChartSelectionReason(family, activeNowTicker, probe ?? null, commonDates, true),
      selectedContractReason: buildChartSelectionReason(family, activeNowTicker, probe ?? null, commonDates, true),
      coverageStatus: onChart ? "no_overlap" : "excluded",
    });
  }

  const same = probe.ticker === activeNowTicker;
  const reason = buildChartSelectionReason(family, activeNowTicker, probe, commonDates, false);

  return formatCoverage({
    family,
    ticker: probe.ticker,
    label: meta.label,
    points: probe.points.slice(-responseDays),
    status: "ok",
    activeNowTicker,
    sameAsActiveNow: same,
    selectedContractReason: reason,
    coverageStatus: "ok",
  });
}

function buildContractSelections(
  activeNow: Record<CurrencyCorrelationFamily, string>,
  best: ComboScore | null,
  _byFamily: Record<CurrencyCorrelationFamily, CandidateProbe[]>,
  responseDays: number,
): CurrencyContractSelection[] {
  return VALID_FAMILIES.map((family) => {
    const meta = CURRENCY_FAMILY_META[family];
    const activeTicker = activeNow[family] ?? "—";
    const chartProbe = best?.pick[family];
    const onChart = Boolean(chartProbe && best?.families.includes(family));
    const excluded = !onChart;

    const chartTicker = onChart && chartProbe ? chartProbe.ticker : "—";
    const pointsCount = onChart && chartProbe ? Math.min(chartProbe.points.length, responseDays) : 0;
    const commonDates = onChart ? (best?.commonDates ?? 0) : 0;

    return {
      family,
      label: meta.label,
      activeNowTicker: activeTicker,
      chartTicker,
      pointsCount,
      selectionReason: buildChartSelectionReason(
        family,
        activeTicker,
        chartProbe ?? null,
        commonDates,
        excluded,
      ),
      sameAsActiveNow: chartTicker !== "—" && chartTicker === activeTicker,
      excludedFromChart: excluded,
    };
  });
}

function buildChartPlanFromCombo(
  instruments: CurrencyHistoryInstrument[],
  best: ComboScore | null,
): {
  chartInstruments: CurrencyCorrelationFamily[];
  chartWarnings: string[];
  basketInstrumentsCount: number;
  basketNote?: string;
  commonDatesOnChart: number;
} {
  if (!best || best.families.length < 2) {
    return {
      chartInstruments: [],
      chartWarnings: ["Недостаточно общих дат между инструментами для графика."],
      basketInstrumentsCount: 0,
      commonDatesOnChart: 0,
    };
  }

  const chartInstruments = best.families;
  const chartWarnings: string[] = [];

  for (const family of VALID_FAMILIES) {
    if (!chartInstruments.includes(family)) {
      const inst = instruments.find((i) => i.family === family);
      const meta = CURRENCY_FAMILY_META[family];
      chartWarnings.push(
        `${meta.label} (${family}) исключён: ${inst?.excludedReason ?? "нет общей истории в лучшей связке"}`,
      );
    }
  }

  return {
    chartInstruments,
    chartWarnings,
    basketInstrumentsCount: chartInstruments.length,
    basketNote:
      chartInstruments.length === 3
        ? "корзина по 3 инструментам"
        : chartInstruments.length === 2
          ? "корзина по 2 инструментам"
          : undefined,
    commonDatesOnChart: best.commonDates,
  };
}

function countPairDatesFromInstruments(
  a: CurrencyCorrelationFamily,
  b: CurrencyCorrelationFamily,
  instruments: CurrencyHistoryInstrument[],
): number {
  const instA = instruments.find((i) => i.family === a);
  const instB = instruments.find((i) => i.family === b);
  if (!instA?.points.length || !instB?.points.length) return 0;
  return intersectDateSets([dateSet(instA.points), dateSet(instB.points)]).length;
}

export async function buildCurrencyHistoryResponse(options: {
  days: number;
  interval: number;
  tickers?: string[];
  coverageSelect?: boolean;
}): Promise<CurrencyHistoryResponse> {
  const { days, interval } = options;
  let instruments: CurrencyHistoryInstrument[];
  let contractSelections: CurrencyContractSelection[];
  let best: ComboScore | null = null;

  if (options.coverageSelect !== false) {
    const screener = await getScreenerResponse("future");
    const rows = screener.rows ?? [];
    const { byFamily, activeNow } = await probeAllCandidates(rows);
    best = findBestCombination(byFamily);

    instruments = VALID_FAMILIES.map((family) =>
      probeToInstrument(
        best?.pick[family] ?? byFamily[family]?.find((p) => p.points.length >= MIN_POINTS_OK),
        family,
        days,
        activeNow[family] ?? "—",
        best?.commonDates ?? 0,
        Boolean(best?.families.includes(family)),
      ),
    );

    contractSelections = buildContractSelections(activeNow, best, byFamily, days);
  } else {
    const tickers = options.tickers ?? [];
    const results = await Promise.all(
      tickers.map(async (ticker) => {
        const family = resolveCurrencyFamily(ticker);
        const fetched = await fetchFuturesDailyCandles(ticker, days);
        const label = family ? CURRENCY_FAMILY_META[family].label : ticker;
        return formatCoverage({
          family: family ?? "SI",
          ticker,
          label,
          points: fetched.points,
          status: fetched.status,
          error: fetched.error,
          activeNowTicker: ticker,
          sameAsActiveNow: true,
          selectedContractReason:
            fetched.status === "ok"
              ? `запрошен тикер ${ticker}, ${fetched.points.length} свечей`
              : undefined,
        });
      }),
    );

    const byFamily = new Map<CurrencyCorrelationFamily, CurrencyHistoryInstrument>();
    for (const inst of results) {
      const family = resolveCurrencyFamily(inst.ticker);
      if (!family || !VALID_FAMILIES.includes(family)) continue;
      const existing = byFamily.get(family);
      if (!existing || (inst.pointsCount ?? inst.points.length) > (existing.pointsCount ?? existing.points.length)) {
        byFamily.set(family, { ...inst, family });
      }
    }

    instruments = VALID_FAMILIES.map((family) => {
      const hit = byFamily.get(family);
      if (hit) return hit;
      return formatCoverage({
        family,
        ticker: "—",
        label: CURRENCY_FAMILY_META[family].label,
        points: [],
        status: "empty",
        excludedReason: CURRENCY_FAMILY_META[family].emptyHint,
        coverageStatus: "empty",
      });
    });

    contractSelections = VALID_FAMILIES.map((family) => {
      const inst = instruments.find((i) => i.family === family);
      return {
        family,
        label: CURRENCY_FAMILY_META[family].label,
        activeNowTicker: inst?.ticker ?? "—",
        chartTicker: inst?.status === "ok" ? inst.ticker : "—",
        pointsCount: inst?.pointsCount ?? inst?.points.length ?? 0,
        selectionReason: inst?.selectedContractReason ?? "запрошенные тикеры",
        sameAsActiveNow: true,
        excludedFromChart: inst?.ticker === "—" || inst?.status !== "ok",
      };
    });

    const withData = instruments.filter((i) => i.status === "ok" && (i.pointsCount ?? i.points.length) >= MIN_POINTS_OK);
    if (withData.length >= 2) {
      const sets = withData.map((i) => dateSet(i.points));
      const commonDates = intersectDateSets(sets).length;
      if (commonDates >= MIN_CHART_COMMON_DATES) {
        best = {
          pick: Object.fromEntries(
            withData.map((i) => [
              i.family,
              {
                ticker: i.ticker,
                family: i.family,
                activityRank: 0,
                activityScore: 1,
                points: i.points,
                status: "ok" as const,
              },
            ]),
          ) as ComboPick,
          families: withData.map((i) => i.family),
          commonDates,
          score: commonDates,
          activitySum: withData.length,
          recency: 1,
        };
      }
    }
  }

  const commonDatesByPair: Record<CurrencyHistoryPairKey, number> = {
    "SI/CNY": countPairDatesFromInstruments("SI", "CNY", instruments),
    "SI/ED": countPairDatesFromInstruments("SI", "ED", instruments),
    "CNY/ED": countPairDatesFromInstruments("CNY", "ED", instruments),
  };

  const chartPlan = buildChartPlanFromCombo(instruments, best);

  return {
    source: "MOEX ISS",
    updatedAt: new Date().toISOString(),
    days,
    interval,
    endpointUsed: "candles",
    instruments,
    contractSelections,
    chartInstruments: chartPlan.chartInstruments,
    chartWarnings: chartPlan.chartWarnings,
    commonDatesByPair,
    commonDatesOnChart: chartPlan.commonDatesOnChart,
    basketInstrumentsCount: chartPlan.basketInstrumentsCount,
    basketNote: chartPlan.basketNote,
  };
}
