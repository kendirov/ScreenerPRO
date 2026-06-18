/**
 * Метаданные baseline для Vol x / Trades x и UI.
 * Same-time = накопленный оборот/сделки к текущему времени MSK vs среднее за N сессий к тому же времени.
 */

import type { ScreenerRow } from "@screenerpro/shared";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { formatTradesCompact } from "@/lib/domain/stocks-screener-signals";
import type { IntradayBaselineKind, IntradayBaselineMetric } from "@/lib/domain/intraday-baseline";
import { formatRatioMultiplier } from "@/lib/domain/intraday-baseline";
import { RADAR_METRIC_LABEL, RADAR_METRIC_TOOLTIP } from "@/lib/domain/radar-ui-labels";

export type BaselineMode = "same-time" | "full-day" | "missing";
export type BaselineSource = "yesterday" | "5d-average" | "20d-average" | "unknown";

export type BaselineInfo = {
  mode: BaselineMode;
  source: BaselineSource;
  currentTime: string;
  baselineTime: string;
  isReliable: boolean;
  kind: IntradayBaselineKind;
  currentTurnoverRub: number | null;
  currentTrades: number | null;
  baselineTurnoverRub: number | null;
  baselineTrades: number | null;
  volumeRatio: number | null;
  tradesRatio: number | null;
  sessionsCount: number;
  warning: string | null;
};

function finitePositive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function safeRatio(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline <= 0) return null;
  if (!Number.isFinite(current)) return null;
  return current / baseline;
}

function timesAligned(currentTime: string, baselineTime: string): boolean {
  if (currentTime === "—" || baselineTime === "—") return false;
  return currentTime === baselineTime;
}

/** Боевой Оборот x: intraday-ok, reliable, same-time, время совпадает, база > 0. */
export function isCombatVolumeRatio(info: BaselineInfo): boolean {
  return (
    info.kind === "intraday-ok" &&
    info.isReliable &&
    info.mode === "same-time" &&
    timesAligned(info.currentTime, info.baselineTime) &&
    info.baselineTurnoverRub != null &&
    info.baselineTurnoverRub > 0 &&
    info.volumeRatio != null
  );
}

/** Боевой Сделки x: те же правила + baseline по сделкам. */
export function isCombatTradesRatio(info: BaselineInfo): boolean {
  return (
    info.kind === "intraday-ok" &&
    info.isReliable &&
    info.mode === "same-time" &&
    timesAligned(info.currentTime, info.baselineTime) &&
    info.baselineTrades != null &&
    info.baselineTrades > 0 &&
    info.tradesRatio != null
  );
}

export function mapKindToBaselineMode(kind: IntradayBaselineKind | null | undefined): BaselineMode {
  if (kind === "intraday-ok" || kind === "intraday-partial") return "same-time";
  if (kind === "rough-day-avg" || kind === "previous-day") return "full-day";
  return "missing";
}

export function mapKindToBaselineSource(
  kind: IntradayBaselineKind | null | undefined,
  sessionsCount = 0,
): BaselineSource {
  if (kind === "previous-day") return "yesterday";
  if (kind === "intraday-ok" || kind === "intraday-partial" || kind === "rough-day-avg") {
    if (sessionsCount > 0 && sessionsCount < 10) return "5d-average";
    if (sessionsCount >= 10) return "20d-average";
    return "20d-average";
  }
  return "unknown";
}

/** Построить BaselineInfo из server intraday metric. */
export function baselineInfoFromIntradayMetric(metric: IntradayBaselineMetric | null | undefined): BaselineInfo {
  const kind = metric?.kind ?? "none";
  const mode = mapKindToBaselineMode(kind);
  const source = mapKindToBaselineSource(kind, metric?.baselineSessionsCount ?? 0);
  const time = metric?.timeMsk ?? "—";
  const isReliable = kind === "intraday-ok";

  const currentTurnoverRub = metric?.currentTurnover ?? null;
  const baselineTurnoverRub = metric?.avgTurnoverAtTime20d ?? null;
  const currentTrades = metric?.currentTrades ?? null;
  const baselineTrades = metric?.avgTradesAtTime20d ?? null;

  const volumeRatioRaw =
    metric?.volumeRatioNow ?? safeRatio(currentTurnoverRub, baselineTurnoverRub);
  const tradesRatioRaw =
    baselineTrades != null
      ? (metric?.tradesRatioNow ?? safeRatio(currentTrades, baselineTrades))
      : null;

  const volumeRatio =
    isReliable && mode === "same-time" && timesAligned(time, time) && baselineTurnoverRub != null
      ? finitePositive(volumeRatioRaw)
      : null;

  const tradesRatio =
    isReliable && mode === "same-time" && timesAligned(time, time) && baselineTrades != null
      ? finitePositive(tradesRatioRaw)
      : null;

  return {
    mode,
    source,
    currentTime: time,
    baselineTime: time,
    isReliable,
    kind,
    currentTurnoverRub,
    currentTrades,
    baselineTurnoverRub,
    baselineTrades,
    volumeRatio,
    tradesRatio,
    sessionsCount: metric?.baselineSessionsCount ?? 0,
    warning: metric?.baselineWarning ?? null,
  };
}

/** Построить из полей ScreenerRow (после API). */
export function buildBaselineInfoFromRow(row: ScreenerRow): BaselineInfo {
  const m = row.metrics;
  const kind = (m.intradayBaselineKind ?? "none") as IntradayBaselineKind;
  const mode = (m.baselineMode as BaselineMode | undefined) ?? mapKindToBaselineMode(kind);
  const source =
    (m.baselineSource as BaselineSource | undefined) ??
    mapKindToBaselineSource(kind, m.baselineSessionsCount ?? 0);
  const time = m.baselineTimeMsk ?? "—";
  const isReliable = kind === "intraday-ok" && m.baselineIsReliable === true;

  const currentTurnoverRub = m.currentTurnoverRub ?? row.turnover ?? null;
  const baselineTurnoverRub = m.avgTurnoverAtTimeRub ?? null;
  const currentTrades = row.tradesCount ?? null;
  const baselineTrades = m.avgTradesAtTimeRub ?? null;

  const volumeRatioRaw = finitePositive(m.volumeRatioNow);
  const volumeRatio =
    isReliable &&
    mode === "same-time" &&
    timesAligned(time, time) &&
    baselineTurnoverRub != null &&
    baselineTurnoverRub > 0
      ? volumeRatioRaw
      : null;

  const tradesRatioRaw = finitePositive(m.tradesRatioNow);
  const tradesRatio =
    isReliable &&
    mode === "same-time" &&
    timesAligned(time, time) &&
    baselineTrades != null &&
    baselineTrades > 0
      ? tradesRatioRaw
      : null;

  return {
    mode,
    source,
    currentTime: time,
    baselineTime: time,
    isReliable,
    kind,
    currentTurnoverRub,
    currentTrades,
    baselineTurnoverRub,
    baselineTrades,
    volumeRatio,
    tradesRatio,
    sessionsCount: m.baselineSessionsCount ?? 0,
    warning: m.baselineWarning ?? null,
  };
}

/** Честный Vol x — только same-time + reliable. */
export function resolveHonestVolumeRatio(row: ScreenerRow): number | null {
  const info = buildBaselineInfoFromRow(row);
  return isCombatVolumeRatio(info) ? info.volumeRatio : null;
}

/** Честный Trades x — только same-time + reliable + есть baseline по сделкам. */
export function resolveHonestTradesRatio(row: ScreenerRow): number | null {
  const info = buildBaselineInfoFromRow(row);
  return isCombatTradesRatio(info) ? info.tradesRatio : null;
}

export function isBaselineVolumeReliable(row: ScreenerRow): boolean {
  return isCombatVolumeRatio(buildBaselineInfoFromRow(row));
}

export function isBaselineTradesReliable(row: ScreenerRow): boolean {
  return isCombatTradesRatio(buildBaselineInfoFromRow(row));
}

/** Подпись baseline для UI. */
export function formatBaselineUiLabel(info: BaselineInfo): string {
  if (info.mode === "missing") return RADAR_METRIC_LABEL.noBaseline;

  const time = info.baselineTime !== "—" ? info.baselineTime : info.currentTime;

  if (info.source === "yesterday") return `база: вчера ${time}`;
  if (info.source === "5d-average") return `база: 5D ${time}`;
  if (info.source === "20d-average") {
    if (info.kind === "intraday-partial") return `база: 20D ${time} · частично`;
    return `база: 20D ${time}`;
  }
  if (info.mode === "full-day") return `база: полный день ${time}`;
  return RADAR_METRIC_LABEL.noBaseline;
}

export type RatioDisplayParts = {
  primary: string;
  suffix: string | null;
  baselineLabel: string;
  showAsVolX: boolean;
};

/** Отображение Vol x / Trades x в ячейке. */
export function formatVolumeRatioDisplayParts(row: ScreenerRow): RatioDisplayParts {
  const info = buildBaselineInfoFromRow(row);
  const baselineLabel = formatBaselineUiLabel(info);

  if (!isCombatVolumeRatio(info)) {
    return {
      primary: "—",
      suffix: null,
      baselineLabel,
      showAsVolX: false,
    };
  }

  const mult = formatRatioMultiplier(info.volumeRatio);
  if (!mult) {
    return { primary: "—", suffix: null, baselineLabel, showAsVolX: false };
  }

  return {
    primary: mult,
    suffix: info.baselineTime !== "—" ? info.baselineTime : null,
    baselineLabel,
    showAsVolX: true,
  };
}

export function formatTradesRatioDisplayParts(row: ScreenerRow): RatioDisplayParts {
  const info = buildBaselineInfoFromRow(row);
  const baselineLabel = formatBaselineUiLabel(info);

  if (!isCombatTradesRatio(info)) {
    return {
      primary: "—",
      suffix: null,
      baselineLabel,
      showAsVolX: false,
    };
  }

  const mult = formatRatioMultiplier(info.tradesRatio);
  if (!mult) {
    return { primary: "—", suffix: null, baselineLabel, showAsVolX: false };
  }

  return {
    primary: mult,
    suffix: info.baselineTime !== "—" ? info.baselineTime : null,
    baselineLabel,
    showAsVolX: true,
  };
}

export type RatioTooltipLines = {
  title: string;
  lines: string[];
};

function formatRubCompact(value: number | null): string {
  if (value == null) return "—";
  return formatTurnoverCompact(value) ?? "—";
}

export function buildVolumeRatioTooltip(row: ScreenerRow): RatioTooltipLines {
  const info = buildBaselineInfoFromRow(row);
  const mult = info.volumeRatio != null ? formatRatioMultiplier(info.volumeRatio) : null;

  if (!isCombatVolumeRatio(info)) {
    return {
      title: `${RADAR_METRIC_LABEL.turnoverX} — ${RADAR_METRIC_LABEL.noBaseline}`,
      lines: [
        RADAR_METRIC_TOOLTIP.noBaseline,
        formatBaselineUiLabel(info),
        info.warning ?? "Нужен intraday к этому же времени сессии.",
        "Колонка «средний день» в таблице — отдельная метрика, не Оборот x.",
      ].filter(Boolean),
    };
  }

  const sourceLabel =
    info.source === "yesterday"
      ? "вчера"
      : info.source === "5d-average"
        ? "5D среднее"
        : "20D среднее";

  return {
    title: mult ? `${RADAR_METRIC_LABEL.turnoverX} ${mult}` : RADAR_METRIC_LABEL.turnoverX,
    lines: [
      RADAR_METRIC_TOOLTIP.turnoverX,
      `Сегодня к ${info.currentTime}: ${formatRubCompact(info.currentTurnoverRub)}`,
      `База ${sourceLabel} к ${info.baselineTime}: ${formatRubCompact(info.baselineTurnoverRub)}`,
      mult ? `Коэффициент: ${mult}` : "",
      `Источник: intraday к этому времени (${info.sessionsCount} сессий)`,
    ].filter(Boolean),
  };
}

export function buildTradesRatioTooltip(row: ScreenerRow): RatioTooltipLines {
  const info = buildBaselineInfoFromRow(row);

  if (!isCombatTradesRatio(info)) {
    return {
      title: `${RADAR_METRIC_LABEL.tradesX} — ${RADAR_METRIC_LABEL.noBaseline}`,
      lines: [
        RADAR_METRIC_TOOLTIP.noBaseline,
        `${RADAR_METRIC_LABEL.trades} к ${info.currentTime}: ${formatTradesCompact(info.currentTrades) ?? "—"}`,
        "Intraday-история сделок по минутам пока не подключена.",
      ],
    };
  }

  const mult = formatRatioMultiplier(info.tradesRatio);
  return {
    title: mult ? `${RADAR_METRIC_LABEL.tradesX} ${mult}` : RADAR_METRIC_LABEL.tradesX,
    lines: [
      RADAR_METRIC_TOOLTIP.tradesX,
      `Сегодня к ${info.currentTime}: ${formatTradesCompact(info.currentTrades) ?? "—"}`,
      `База к ${info.baselineTime}: ${formatTradesCompact(info.baselineTrades) ?? "—"}`,
      mult ? `Коэффициент: ${mult}` : "",
    ],
  };
}

/** Поля metrics для записи из IntradayBaselineMetric. */
export function metricsFieldsFromIntraday(
  metric: IntradayBaselineMetric | null | undefined,
): Partial<ScreenerRow["metrics"]> {
  const info = baselineInfoFromIntradayMetric(metric);
  return {
    volumeRatioNow: info.volumeRatio,
    tradesRatioNow: info.tradesRatio,
    intradayBaselineStatus: metric?.status ?? "no-history",
    intradayBaselineKind: info.kind,
    baselineMode: info.mode,
    baselineSource: info.source,
    baselineTimeMsk: info.currentTime,
    baselineIsReliable: info.isReliable,
    avgTurnoverAtTimeRub: info.baselineTurnoverRub,
    avgTradesAtTimeRub: info.baselineTrades,
    baselineSessionsCount: info.sessionsCount,
    baselineWarning: info.warning,
    currentTurnoverRub: info.currentTurnoverRub,
  };
}
