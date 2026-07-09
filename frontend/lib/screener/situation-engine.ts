import type { ScreenerRow } from "@screenerpro/shared";
import { resolveHonestTradesRatio, resolveHonestVolumeRatio } from "@/lib/domain/baseline-info";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";

export type SituationTag =
  | "volume_ignition"
  | "range_expansion"
  | "near_high"
  | "near_low"
  | "breakout_attempt"
  | "active_liquidity"
  | "spread_risk"
  | "late_move"
  | "leader"
  | "laggard"
  | "quiet";

export type SituationSeverity = "neutral" | "info" | "attention" | "hot" | "risk";

export type SituationReason = {
  code: string;
  label: string;
  value?: string | number;
  severity: SituationSeverity;
};

export type InstrumentSituation = {
  tags: SituationTag[];
  primaryTag: SituationTag;
  score: number;
  reasons: SituationReason[];
};

export type SituationContext = {
  /** Для относительных порогов ликвидности (опционально). */
  maxTurnover?: number;
  /** Если известен спред — иначе spread_risk не ставится. */
  spreadPct?: number | null;
  /** Минуты от полуночи MSK — для late_move. */
  sessionMins?: number;
};

const THRESHOLDS = {
  volumeRatio: 1.8,
  tradesRatio: 1.8,
  activityRatio: 1.45,
  inPlayScoreFallback: 72,
  rangeExpansionPct: 2.5,
  nearEdgeDistancePct: 0.35,
  nearEdgePositionHigh: 0.85,
  nearEdgePositionLow: 0.15,
  leaderChangePct: 1.2,
  laggardChangePct: -1.2,
  breakoutMinChangePct: 0.4,
  spreadRiskPct: 0.55,
  activeLiquidityTurnoverPct: 55,
  activeLiquidityMinTrades: 800,
  activeLiquidityMinTurnoverRub: 25_000_000,
  lateMoveSessionProgress: 0.58,
  lateMoveMinMins: 13 * 60,
} as const;

const TAG_LABELS: Record<SituationTag, string> = {
  volume_ignition: "Объём выше нормы",
  range_expansion: "Расширение диапазона",
  near_high: "У high дня",
  near_low: "У low дня",
  breakout_attempt: "Попытка пробоя",
  active_liquidity: "Ликвидность ок",
  spread_risk: "Спред широкий",
  late_move: "Позднее движение",
  leader: "Лидер роста",
  laggard: "Лидер падения",
  quiet: "Тихо",
};

const TAG_SHORT: Record<SituationTag, string> = {
  volume_ignition: "объём",
  range_expansion: "диапазон",
  near_high: "у high",
  near_low: "у low",
  breakout_attempt: "пробой",
  active_liquidity: "ликвид",
  spread_risk: "спред",
  late_move: "поздний",
  leader: "лидер+",
  laggard: "лидер−",
  quiet: "тихо",
};

/** Приоритет primaryTag — выше = важнее для трейдера. */
const TAG_PRIORITY: Record<SituationTag, number> = {
  breakout_attempt: 100,
  volume_ignition: 92,
  leader: 88,
  laggard: 86,
  late_move: 78,
  range_expansion: 72,
  near_high: 68,
  near_low: 66,
  active_liquidity: 55,
  spread_risk: 45,
  quiet: 0,
};

export const TAG_DEFAULT_SEVERITY: Record<SituationTag, SituationSeverity> = {
  volume_ignition: "hot",
  range_expansion: "attention",
  near_high: "attention",
  near_low: "attention",
  breakout_attempt: "hot",
  active_liquidity: "info",
  spread_risk: "risk",
  late_move: "attention",
  leader: "hot",
  laggard: "hot",
  quiet: "neutral",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 100));
}

function finite(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function formatRatio(value: number): string {
  return `${value.toFixed(1)}×`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function distanceToHighPct(row: ScreenerRow): number | null {
  const last = finite(row.lastPrice);
  const high = finite(row.high);
  if (last == null || high == null || last <= 0) return null;
  if (high <= last) return 0;
  return ((high - last) / last) * 100;
}

function distanceToLowPct(row: ScreenerRow): number | null {
  const last = finite(row.lastPrice);
  const low = finite(row.low);
  if (last == null || low == null || last <= 0) return null;
  if (low >= last) return 0;
  return ((last - low) / last) * 100;
}

function resolveVolumeRatio(row: ScreenerRow): number | null {
  return finite(resolveHonestVolumeRatio(row) ?? row.metrics.volumeRatioNow ?? row.metrics.turnoverVsAverage);
}

function resolveTradesRatio(row: ScreenerRow): number | null {
  return finite(resolveHonestTradesRatio(row) ?? row.metrics.tradesRatioNow ?? row.metrics.tradesVsAverage);
}

function resolveActivityRatio(row: ScreenerRow): number | null {
  return finite(row.metrics.activityRatio);
}

function resolveInPlayScore(row: ScreenerRow): number | null {
  return finite(row.metrics.inPlayScore);
}

function isLateSession(ctx: SituationContext, row: ScreenerRow): boolean {
  const progress = finite(row.metrics.sessionProgress);
  if (progress != null && progress >= THRESHOLDS.lateMoveSessionProgress) return true;
  if (ctx.sessionMins != null && ctx.sessionMins >= THRESHOLDS.lateMoveMinMins) return true;
  return false;
}

function buildReason(
  code: string,
  label: string,
  severity: SituationSeverity,
  value?: string | number,
): SituationReason {
  return value !== undefined ? { code, label, value, severity } : { code, label, severity };
}

function pickPrimaryTag(tags: SituationTag[]): SituationTag {
  const actionable = tags.filter((tag) => tag !== "quiet");
  if (actionable.length === 0) return "quiet";
  return [...actionable].sort((a, b) => TAG_PRIORITY[b] - TAG_PRIORITY[a])[0] ?? "quiet";
}

function computeScore(input: {
  volumeRatio: number | null;
  tradesRatio: number | null;
  activityRatio: number | null;
  inPlayScore: number | null;
  rangePct: number | null;
  turnoverPct: number | null;
  tradesPct: number | null;
  nearEdge: boolean;
  spreadRisk: boolean;
  tagCount: number;
}): number {
  let score = 0;

  const vol = input.volumeRatio ?? 0;
  const trd = input.tradesRatio ?? 0;
  const act = input.activityRatio ?? 0;
  const activityPeak = Math.max(vol > 0 ? clamp(vol / 3, 0, 1) : 0, trd > 0 ? clamp(trd / 3, 0, 1) : 0, act > 0 ? clamp(act / 2.5, 0, 1) : 0);
  if (activityPeak === 0 && input.inPlayScore != null) {
    score += clamp(input.inPlayScore, 0, 100) * 0.28;
  } else {
    score += activityPeak * 35;
  }

  const range = Math.abs(input.rangePct ?? 0);
  score += clamp(range / 6, 0, 1) * 25;

  const liqPct = Math.max(input.turnoverPct ?? 0, input.tradesPct ?? 0);
  score += clamp(liqPct / 100, 0, 1) * 20;

  if (input.nearEdge) score += 12;

  if (input.spreadRisk) score -= 15;

  if (input.tagCount >= 3) score += 5;

  return roundScore(score);
}

export function getSituationTagLabel(tag: SituationTag): string {
  return TAG_LABELS[tag];
}

export function getSituationTagShort(tag: SituationTag): string {
  return TAG_SHORT[tag];
}

export function getSituationSeverityClass(severity: SituationSeverity): string {
  switch (severity) {
    case "hot":
      return "border-cyan-500/35 bg-cyan-950/40 text-cyan-200/95 shadow-[0_0_8px_rgba(34,211,238,0.12)]";
    case "attention":
      return "border-amber-500/30 bg-amber-950/30 text-amber-200/90";
    case "risk":
      return "border-rose-800/35 bg-rose-950/25 text-rose-300/85";
    case "info":
      return "border-slate-600/40 bg-slate-900/50 text-slate-300/90";
    default:
      return "border-slate-700/35 bg-slate-950/45 text-slate-500/85";
  }
}

export function computeInstrumentSituation(row: ScreenerRow, context: SituationContext = {}): InstrumentSituation {
  const tags: SituationTag[] = [];
  const reasons: SituationReason[] = [];

  const volumeRatio = resolveVolumeRatio(row);
  const tradesRatio = resolveTradesRatio(row);
  const activityRatio = resolveActivityRatio(row);
  const inPlayScore = resolveInPlayScore(row);
  const rangePct = finite(row.metrics.dayRangePct);
  const changePct = finite(row.percentChange);
  const turnover = finite(row.turnover);
  const trades = finite(row.tradesCount);
  const turnoverPct = finite(row.metrics.turnoverPercentile);
  const tradesPct = finite(row.metrics.tradesPercentile);
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const distHigh = distanceToHighPct(row);
  const distLow = distanceToLowPct(row);
  const spreadPct = finite(context.spreadPct);

  const hasVolumeIgnition =
    (volumeRatio != null && volumeRatio >= THRESHOLDS.volumeRatio) ||
    (tradesRatio != null && tradesRatio >= THRESHOLDS.tradesRatio) ||
    (activityRatio != null && activityRatio >= THRESHOLDS.activityRatio) ||
    (volumeRatio == null &&
      tradesRatio == null &&
      activityRatio == null &&
      inPlayScore != null &&
      inPlayScore >= THRESHOLDS.inPlayScoreFallback &&
      ((turnover ?? 0) > 0 || (trades ?? 0) > 0));

  if (hasVolumeIgnition) {
    tags.push("volume_ignition");
    const value =
      volumeRatio != null
        ? formatRatio(volumeRatio)
        : tradesRatio != null
          ? formatRatio(tradesRatio)
          : inPlayScore != null
            ? `score ${Math.round(inPlayScore)}`
            : undefined;
    reasons.push(buildReason("volume_ignition", TAG_LABELS.volume_ignition, "hot", value));
  }

  const hasRangeExpansion = rangePct != null && rangePct >= THRESHOLDS.rangeExpansionPct;
  if (hasRangeExpansion) {
    tags.push("range_expansion");
    reasons.push(
      buildReason("range_expansion", TAG_LABELS.range_expansion, "attention", formatPct(rangePct)),
    );
  }

  const nearHigh =
    (distHigh != null && distHigh <= THRESHOLDS.nearEdgeDistancePct) ||
    (position != null && position >= THRESHOLDS.nearEdgePositionHigh);
  if (nearHigh) {
    tags.push("near_high");
    reasons.push(
      buildReason(
        "near_high",
        TAG_LABELS.near_high,
        "attention",
        distHigh != null ? formatPct(distHigh) : undefined,
      ),
    );
  }

  const nearLow =
    (distLow != null && distLow <= THRESHOLDS.nearEdgeDistancePct) ||
    (position != null && position <= THRESHOLDS.nearEdgePositionLow);
  if (nearLow) {
    tags.push("near_low");
    reasons.push(
      buildReason("near_low", TAG_LABELS.near_low, "attention", distLow != null ? formatPct(distLow) : undefined),
    );
  }

  if (nearHigh && hasRangeExpansion && changePct != null && changePct >= THRESHOLDS.breakoutMinChangePct) {
    tags.push("breakout_attempt");
    reasons.push(
      buildReason(
        "breakout_attempt",
        TAG_LABELS.breakout_attempt,
        "hot",
        changePct != null ? formatPct(changePct) : undefined,
      ),
    );
  }

  const hasActiveLiquidity =
    ((turnoverPct != null && turnoverPct >= THRESHOLDS.activeLiquidityTurnoverPct) ||
      (turnover != null && turnover >= THRESHOLDS.activeLiquidityMinTurnoverRub)) &&
    (trades ?? 0) >= THRESHOLDS.activeLiquidityMinTrades;

  if (hasActiveLiquidity) {
    tags.push("active_liquidity");
    reasons.push(buildReason("active_liquidity", TAG_LABELS.active_liquidity, "info"));
  }

  if (spreadPct != null && spreadPct >= THRESHOLDS.spreadRiskPct) {
    tags.push("spread_risk");
    reasons.push(buildReason("spread_risk", TAG_LABELS.spread_risk, "risk", formatPct(spreadPct)));
  }

  const hasLateMove =
    isLateSession(context, row) &&
    (hasVolumeIgnition || (changePct != null && Math.abs(changePct) >= 1));
  if (hasLateMove) {
    tags.push("late_move");
    reasons.push(buildReason("late_move", TAG_LABELS.late_move, "attention"));
  }

  if (changePct != null && changePct >= THRESHOLDS.leaderChangePct && (turnover ?? 0) > 0 && (trades ?? 0) > 0) {
    tags.push("leader");
    reasons.push(buildReason("leader", TAG_LABELS.leader, "hot", formatPct(changePct)));
  }

  if (changePct != null && changePct <= THRESHOLDS.laggardChangePct && (turnover ?? 0) > 0 && (trades ?? 0) > 0) {
    tags.push("laggard");
    reasons.push(buildReason("laggard", TAG_LABELS.laggard, "hot", formatPct(changePct)));
  }

  if (tags.length === 0) {
    tags.push("quiet");
    reasons.push(buildReason("quiet", TAG_LABELS.quiet, "neutral"));
  }

  const primaryTag = pickPrimaryTag(tags);

  const score = computeScore({
    volumeRatio,
    tradesRatio,
    activityRatio,
    inPlayScore,
    rangePct,
    turnoverPct,
    tradesPct,
    nearEdge: nearHigh || nearLow,
    spreadRisk: tags.includes("spread_risk"),
    tagCount: tags.filter((t) => t !== "quiet").length,
  });

  const dedupedReasons = reasons.filter(
    (reason, index, list) => list.findIndex((item) => item.code === reason.code) === index,
  );

  return {
    tags,
    primaryTag,
    score,
    reasons: dedupedReasons,
  };
}

export function getMoscowSessionMins(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function buildSituationTooltip(situation: InstrumentSituation): string {
  return situation.reasons
    .map((reason) => {
      const value = reason.value != null ? ` · ${reason.value}` : "";
      return `${reason.label}${value}`;
    })
    .join(" · ");
}
