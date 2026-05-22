import {
  buildWeekCompareBands,
  type WeekCompareBandPoint,
} from "@/lib/domain/currency-correlation-weeks-compare";
import type { WeeklySpreadSeries } from "@/lib/domain/currency-correlation-weeks";
import { minuteOfWeekFromTimestamp } from "@/lib/domain/trading-week";

export type WeeklyContextLabel =
  | "inside_norm"
  | "outside_corridor"
  | "new_week_extreme"
  | "outside_week_context";

export const WEEKLY_CONTEXT_LABEL_RU: Record<WeeklyContextLabel, string> = {
  inside_norm: "внутри нормы",
  outside_corridor: "вне коридора",
  new_week_extreme: "новый экстремум недели",
  outside_week_context: "вне недельного контекста",
};

export type SpreadWeeklyBarContext = {
  minuteOfWeek: number;
  insideP25P75: boolean | null;
  insideP10P90: boolean | null;
  exceedsPastMinuteRange: boolean;
  isNewWeekExtreme: boolean;
  historicalMean: number | null;
  label: WeeklyContextLabel;
};

export type SpreadWeeklyContext = {
  hasHistory: boolean;
  pastWeekCount: number;
  bands: WeekCompareBandPoint[];
  perBar: (SpreadWeeklyBarContext | null)[];
};

export const OUTSIDE_P10P90_BREAKDOWN_BARS = 6;
export const WEEKS_LOOKBACK_FOR_EXTREME = 3;

function bandAtMinute(
  bands: WeekCompareBandPoint[],
  minute: number,
): WeekCompareBandPoint | null {
  return bands.find((b) => b.minuteOfWeek === minute) ?? null;
}

function spreadsAtMinute(weeks: WeeklySpreadSeries[], minute: number): number[] {
  const out: number[] = [];
  for (const w of weeks) {
    const pt = w.points.find((p) => p.minuteOfWeek === minute);
    if (pt && Number.isFinite(pt.spreadPoints)) out.push(pt.spreadPoints);
  }
  return out;
}

function classifyBar(
  spread: number,
  minute: number,
  band: WeekCompareBandPoint | null,
  pastAtMinute: number[],
  pastGlobalMax: number | null,
  pastGlobalMin: number | null,
  weekRunningMax: number,
  weekRunningMin: number,
): SpreadWeeklyBarContext {
  const insideP25P75 =
    band?.p25 != null && band?.p75 != null
      ? spread >= band.p25 && spread <= band.p75
      : null;
  const insideP10P90 =
    band?.p10 != null && band?.p90 != null
      ? spread >= band.p10 && spread <= band.p90
      : null;

  const pastMax = pastAtMinute.length ? Math.max(...pastAtMinute) : null;
  const pastMin = pastAtMinute.length ? Math.min(...pastAtMinute) : null;
  const exceedsPastMinuteRange =
    pastMax != null && pastMin != null && (spread > pastMax || spread < pastMin);

  const isNewWeekExtreme =
    (pastGlobalMax != null && weekRunningMax > pastGlobalMax) ||
    (pastGlobalMin != null && weekRunningMin < pastGlobalMin);

  let label: WeeklyContextLabel = "inside_norm";
  if (isNewWeekExtreme) label = "new_week_extreme";
  else if (insideP10P90 === false || exceedsPastMinuteRange) label = "outside_week_context";
  else if (insideP25P75 === false) label = "outside_corridor";

  return {
    minuteOfWeek: minute,
    insideP25P75,
    insideP10P90,
    exceedsPastMinuteRange,
    isNewWeekExtreme,
    historicalMean: band?.mean ?? null,
    label,
  };
}

/** Недельный контекст для каждой интрадей-свечи (по timestamp). */
export function buildSpreadWeeklyContext(
  alignedTimestamps: string[],
  spreadRaw: number[],
  weeks: WeeklySpreadSeries[] | undefined,
): SpreadWeeklyContext | null {
  if (!weeks?.length || alignedTimestamps.length !== spreadRaw.length) return null;

  const pastWeeks = weeks.slice(1).filter((w) => w.points.length >= 5);
  const hasHistory = pastWeeks.length >= 2;
  const bands = buildWeekCompareBands(pastWeeks);

  const lookback = pastWeeks.slice(0, WEEKS_LOOKBACK_FOR_EXTREME);
  const pastGlobalSpreads = lookback.flatMap((w) =>
    w.points.map((p) => p.spreadPoints).filter(Number.isFinite),
  );
  const pastGlobalMax = pastGlobalSpreads.length ? Math.max(...pastGlobalSpreads) : null;
  const pastGlobalMin = pastGlobalSpreads.length ? Math.min(...pastGlobalSpreads) : null;
  const weekStart = weeks[0]?.weekStart ?? "";

  let weekRunningMax = -Infinity;
  let weekRunningMin = Infinity;

  const perBar: (SpreadWeeklyBarContext | null)[] = [];

  for (let i = 0; i < alignedTimestamps.length; i++) {
    const sp = spreadRaw[i]!;
    if (!Number.isFinite(sp)) {
      perBar.push(null);
      continue;
    }

    const minute = weekStart
      ? minuteOfWeekFromTimestamp(alignedTimestamps[i]!, weekStart)
      : 0;
    const band = bandAtMinute(bands, minute);
    const pastAtMinute = spreadsAtMinute(pastWeeks, minute);

    weekRunningMax = Math.max(weekRunningMax, sp);
    weekRunningMin = Math.min(weekRunningMin, sp);

    perBar.push(
      classifyBar(
        sp,
        minute,
        band,
        pastAtMinute,
        pastGlobalMax,
        pastGlobalMin,
        weekRunningMax,
        weekRunningMin,
      ),
    );
  }

  return {
    hasHistory,
    pastWeekCount: pastWeeks.length,
    bands,
    perBar,
  };
}

export function weeklyContextLabelAt(
  ctx: SpreadWeeklyContext | null | undefined,
  index: number,
): string {
  const bar = ctx?.perBar[index];
  if (!bar) return ctx?.hasHistory ? "нет данных по минуте" : "мало недель для статистики";
  return WEEKLY_CONTEXT_LABEL_RU[bar.label];
}
