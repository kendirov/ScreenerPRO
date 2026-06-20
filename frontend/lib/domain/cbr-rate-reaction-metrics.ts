/**
 * CBR rate-reaction metrics — pure calculations from intraday candles.
 */

import { slotIsMoexAnalyzable, patternAllowedForLiveData } from "@/lib/cbr/cbr-replay-market-integrity";
import { isRealMoexReplayInstrument } from "@/lib/cbr/cbr-replay-data-quality";
import {
  calculateReactionMetrics,
  mapCalcWindowReturnsToLegacy,
  mapCalcWindowVolumesToLegacy,
  type CbrReactionCalcStatus,
} from "@/lib/cbr/calculate-cbr-reaction";
import type { CbrChartCandle } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrDataStatus, CbrInstrumentRole } from "@/lib/domain/cbr-rate-events";
import { mskTimeToUnix } from "@/lib/domain/cbr-rate-event-window";

export type CbrRateCandle = CbrChartCandle;

export type CbrReactionWindowId =
  | "preDecision"
  | "firstImpulse"
  | "firstDigest"
  | "prePress"
  | "postPress"
  | "closePhase"
  | "fullDay";

export type CbrReactionWindowMsk = {
  id: CbrReactionWindowId;
  fromMsk: string;
  toMsk: string;
};

/** Окна реакции на торговый день (MSK). */
export const CBR_REACTION_WINDOWS: CbrReactionWindowMsk[] = [
  { id: "preDecision", fromMsk: "12:30", toMsk: "13:29" },
  { id: "firstImpulse", fromMsk: "13:30", toMsk: "13:35" },
  { id: "firstDigest", fromMsk: "13:30", toMsk: "14:00" },
  { id: "prePress", fromMsk: "14:00", toMsk: "14:59" },
  { id: "postPress", fromMsk: "15:00", toMsk: "16:00" },
  { id: "closePhase", fromMsk: "16:00", toMsk: "18:45" },
  { id: "fullDay", fromMsk: "10:00", toMsk: "18:45" },
];

export const CBR_REACTION_WINDOW_BY_ID: Record<CbrReactionWindowId, CbrReactionWindowMsk> =
  Object.fromEntries(CBR_REACTION_WINDOWS.map((w) => [w.id, w])) as Record<
    CbrReactionWindowId,
    CbrReactionWindowMsk
  >;

export type CbrReactionPatternId =
  | "first-impulse"
  | "false-breakout"
  | "post-press-continuation"
  | "currency-only"
  | "stocks-skeptical"
  | "banks-beat-index"
  | "index-weaker-currency"
  | "index-unconfirmed"
  | "late-volume"
  | "noise-over-move";

export const CBR_REACTION_PATTERN_LABELS: Record<CbrReactionPatternId, string> = {
  "first-impulse": "первый импульс",
  "false-breakout": "ложный вынос",
  "post-press-continuation": "подтверждение после 15:00",
  "currency-only": "реакция только в валюте",
  "stocks-skeptical": "акции не подтвердили",
  "banks-beat-index": "банк сильнее рынка",
  "index-weaker-currency": "индекс слабее валюты",
  "index-unconfirmed": "индекс без подтверждения",
  "late-volume": "объём пришёл позже",
  "noise-over-move": "шума больше, чем хода",
};

/** Паттерн для compact matrix, когда метрик нет. */
export const CBR_COMPACT_PATTERN_NO_DATA = "нет данных";

/** Матрица: свечи есть, но нет привязки к 13:30. */
export const CBR_COMPACT_PATTERN_INCOMPLETE = "неполно";

/** Строка матрицы: данные demo, не участвуют в выводах. */
export const CBR_COMPACT_PATTERN_DEMO = "demo";

export type CbrInstrumentReactionMetrics = {
  ticker: string;
  title: string;
  role: CbrInstrumentRole;
  dataStatus: CbrDataStatus;
  reactionStatus: CbrReactionCalcStatus;
  reactionReason: string | null;
  reaction5mPct: number | null;
  reaction30mPct: number | null;
  reactionPostPressPct: number | null;
  reactionDayPct: number | null;
  dayRangePct: number | null;
  volumeRatio: number | null;
  windowReturns: Partial<Record<CbrReactionWindowId, number | null>>;
  windowVolumes: Partial<Record<CbrReactionWindowId, number | null>>;
  pattern: CbrReactionPatternId | null;
  patternLabel: string | null;
  traderRead: string | null;
};

export type CbrReactionPeerSnapshot = {
  ticker: string;
  role: CbrInstrumentRole;
  dataStatus: CbrDataStatus;
  reactionDayPct: number | null;
  reaction30mPct: number | null;
  reactionPostPressPct: number | null;
  volumeRatio: number | null;
  dayRangePct: number | null;
};

export function resolveWindowUnix(
  date: string,
  fromMsk: string,
  toMsk: string,
): { fromUnix: number; toUnix: number } {
  return {
    fromUnix: mskTimeToUnix(date, fromMsk),
    toUnix: mskTimeToUnix(date, toMsk),
  };
}

function sortedCandles(candles: CbrRateCandle[]): CbrRateCandle[] {
  return [...candles].sort((a, b) => a.time - b.time);
}

function candlesInWindow(candles: CbrRateCandle[], fromUnix: number, toUnix: number): CbrRateCandle[] {
  return sortedCandles(candles).filter((c) => c.time >= fromUnix && c.time <= toUnix);
}

function anchorPriceBefore(candles: CbrRateCandle[], fromUnix: number): number | null {
  const before = sortedCandles(candles).filter((c) => c.time < fromUnix);
  if (before.length > 0) return before[before.length - 1]!.close;
  const firstIn = candlesInWindow(candles, fromUnix, Number.MAX_SAFE_INTEGER)[0];
  return firstIn?.open ?? null;
}

/**
 * Доходность в окне: от якоря (close до fromTime) до close последней свечи в окне.
 * fromTime / toTime — unix seconds.
 */
export function calculateWindowReturn(
  candles: CbrRateCandle[],
  fromTime: number,
  toTime: number,
): number | null {
  const window = candlesInWindow(candles, fromTime, toTime);
  if (!window.length) return null;

  const anchor = anchorPriceBefore(candles, fromTime) ?? window[0]!.open;
  const endClose = window[window.length - 1]!.close;
  if (!anchor || !Number.isFinite(anchor) || anchor === 0) return null;

  return ((endClose - anchor) / anchor) * 100;
}

export function calculateWindowReturnMsk(
  candles: CbrRateCandle[],
  date: string,
  fromMsk: string,
  toMsk: string,
): number | null {
  const { fromUnix, toUnix } = resolveWindowUnix(date, fromMsk, toMsk);
  return calculateWindowReturn(candles, fromUnix, toUnix);
}

/** Сумма volume (или value) в окне. */
export function calculateVolumeInWindow(
  candles: CbrRateCandle[],
  fromTime: number,
  toTime: number,
): number | null {
  const window = candlesInWindow(candles, fromTime, toTime);
  if (!window.length) return null;

  let total = 0;
  let hasVolume = false;
  for (const c of window) {
    const v = c.volume ?? c.value;
    if (v != null && Number.isFinite(v)) {
      total += v;
      hasVolume = true;
    }
  }
  return hasVolume ? total : null;
}

export function calculateVolumeInWindowMsk(
  candles: CbrRateCandle[],
  date: string,
  fromMsk: string,
  toMsk: string,
): number | null {
  const { fromUnix, toUnix } = resolveWindowUnix(date, fromMsk, toMsk);
  return calculateVolumeInWindow(candles, fromUnix, toUnix);
}

/** Диапазон дня: (max high − min low) / open первой свечи × 100. */
export function calculateDayRange(candles: CbrRateCandle[]): number | null {
  const sorted = sortedCandles(candles);
  if (sorted.length < 2) return null;

  const open = sorted[0]!.open;
  if (!open || !Number.isFinite(open)) return null;

  let high = -Infinity;
  let low = Infinity;
  for (const c of sorted) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  return ((high - low) / open) * 100;
}

export function calculateVolumeRatio(
  currentDayVolume: number | null,
  baselineVolume: number | null,
): number | null {
  if (currentDayVolume == null || baselineVolume == null) return null;
  if (!Number.isFinite(currentDayVolume) || !Number.isFinite(baselineVolume) || baselineVolume <= 0) {
    return null;
  }
  return currentDayVolume / baselineVolume;
}

function windowDurationMinutes(fromMsk: string, toMsk: string): number {
  const [fh, fm] = fromMsk.split(":").map(Number);
  const [th, tm] = toMsk.split(":").map(Number);
  return th! * 60 + tm! - (fh! * 60 + fm!) + 1;
}

function estimateBaselineFromPreDecision(
  candles: CbrRateCandle[],
  date: string,
): number | null {
  const pre = CBR_REACTION_WINDOW_BY_ID.preDecision;
  const full = CBR_REACTION_WINDOW_BY_ID.fullDay;
  const preVol = calculateVolumeInWindowMsk(candles, date, pre.fromMsk, pre.toMsk);
  if (preVol == null) return null;

  const preMin = windowDurationMinutes(pre.fromMsk, pre.toMsk);
  const fullMin = windowDurationMinutes(full.fromMsk, full.toMsk);
  if (preMin <= 0) return null;

  return preVol * (fullMin / preMin);
}

function absPct(v: number | null): number {
  return v == null ? 0 : Math.abs(v);
}

function sameSign(a: number | null, b: number | null): boolean {
  if (a == null || b == null || a === 0 || b === 0) return false;
  return Math.sign(a) === Math.sign(b);
}

export function classifyReactionPattern(
  metrics: Omit<CbrInstrumentReactionMetrics, "pattern" | "patternLabel" | "traderRead">,
  peers: CbrReactionPeerSnapshot[],
): { pattern: CbrReactionPatternId | null; patternLabel: string | null; traderRead: string | null } {
  const {
    role,
    reaction5mPct,
    reaction30mPct,
    reactionPostPressPct,
    reactionDayPct,
    dayRangePct,
    volumeRatio,
    windowVolumes,
  } = metrics;

  const indexPeer = peers.find((p) => p.role === "index");
  const bankPeer = peers.find((p) => p.role === "bank");
  const currencyPeers = peers.filter((p) => p.role === "currency");
  const maxCurrencyDay =
    currencyPeers.reduce((max, p) => Math.max(max, absPct(p.reactionDayPct)), 0) || null;

  const firstImpulseVol = windowVolumes.firstImpulse ?? null;
  const postPressVol = windowVolumes.postPress ?? null;

  let pattern: CbrReactionPatternId | null = null;

  if (
    absPct(reaction5mPct) >= 0.12 &&
    absPct(reaction5mPct) >= absPct(reaction30mPct) * 0.55
  ) {
    pattern = "first-impulse";
  }

  if (
    absPct(reaction5mPct) >= 0.18 &&
    reactionDayPct != null &&
    (Math.sign(reaction5mPct!) !== Math.sign(reactionDayPct) ||
      absPct(reactionDayPct) < absPct(reaction5mPct) * 0.35)
  ) {
    pattern = "false-breakout";
  }

  if (
    absPct(reactionPostPressPct) >= 0.1 &&
    sameSign(reactionPostPressPct, reaction30mPct) &&
    absPct(reactionPostPressPct) >= absPct(reaction30mPct) * 0.4
  ) {
    pattern = "post-press-continuation";
  }

  if (
    (role === "bank" || role === "heavy" || role === "active") &&
    maxCurrencyDay != null &&
    maxCurrencyDay >= 0.2 &&
    absPct(reactionDayPct) < maxCurrencyDay * 0.45 &&
    currencyPeers.some((p) => p.dataStatus === "live" || p.dataStatus === "partial")
  ) {
    pattern = "currency-only";
  }

  if (
    (role === "bank" || role === "heavy" || role === "active") &&
    absPct(reactionDayPct) < 0.12 &&
    (absPct(indexPeer?.reactionDayPct ?? null) >= 0.25 || (maxCurrencyDay ?? 0) >= 0.25)
  ) {
    pattern = "stocks-skeptical";
  }

  if (
    role === "bank" &&
    reactionDayPct != null &&
    indexPeer?.reactionDayPct != null &&
    reactionDayPct > indexPeer.reactionDayPct + 0.12 &&
    (indexPeer.dataStatus === "live" || indexPeer.dataStatus === "partial")
  ) {
    pattern = "banks-beat-index";
  }

  if (
    role === "index" &&
    maxCurrencyDay != null &&
    maxCurrencyDay >= 0.1 &&
    absPct(reactionDayPct) < maxCurrencyDay * 0.55
  ) {
    pattern = "index-weaker-currency";
  }

  if (
    role === "index" &&
    absPct(reaction5mPct) >= 0.15 &&
    reactionDayPct != null &&
    absPct(reactionDayPct) < absPct(reaction5mPct) * 0.45 &&
    pattern !== "index-weaker-currency"
  ) {
    pattern = "index-unconfirmed";
  }

  if (
    firstImpulseVol != null &&
    postPressVol != null &&
    firstImpulseVol > 0 &&
    postPressVol > firstImpulseVol * 1.4
  ) {
    pattern = "late-volume";
  }

  if (
    dayRangePct != null &&
    dayRangePct >= 1.2 &&
    absPct(reactionDayPct) < 0.22 &&
    absPct(reactionDayPct) < dayRangePct * 0.25
  ) {
    pattern = "noise-over-move";
  }

  const patternLabel = pattern ? CBR_REACTION_PATTERN_LABELS[pattern] : null;
  const allowed =
    pattern == null ||
    patternAllowedForLiveData(pattern, { ...metrics, ticker: metrics.ticker }, peers);
  const finalPattern = allowed ? pattern : null;
  const finalLabel = finalPattern ? patternLabel : null;
  const traderRead = finalPattern ? buildTraderRead(finalPattern, metrics, peers) : null;

  return { pattern: finalPattern, patternLabel: finalLabel, traderRead };
}

function buildTraderRead(
  pattern: CbrReactionPatternId,
  metrics: Omit<CbrInstrumentReactionMetrics, "pattern" | "patternLabel" | "traderRead">,
  peers: CbrReactionPeerSnapshot[],
): string {
  const indexPeer = peers.find((p) => p.role === "index");

  switch (pattern) {
    case "first-impulse":
      return "Первые минуты после 13:30 дали основной ход — дальше рынок сверял факт с ожиданием.";
    case "false-breakout":
      return "Рынок сначала отреагировал на факт, но к концу дня импульс не удержался.";
    case "post-press-continuation":
      return "После 15:00 движение продолжилось в сторону первого импульса — тон брифинга усилил сигнал.";
    case "currency-only":
      return "Валюта дала основную реакцию, акции и индекс остались вторичны.";
    case "stocks-skeptical":
      return "По акции ход сдержанный — рынок не подтвердил импульс индекса или валюты.";
    case "banks-beat-index":
      return "Точечная сила банка относительно индекса — не широкий рыночный спрос.";
    case "index-weaker-currency":
      return "Индекс отреагировал слабее валютной ноги — рынок акций не повторил импульс FX.";
    case "index-unconfirmed":
      return "Индекс дёрнулся в первые минуты, но дневное закрытие не подтвердило направление.";
    case "late-volume":
      return "Оборот усилился после 15:00 — часть участников входила с задержкой, не в первом импульсе.";
    case "noise-over-move":
      return "Диапазон дня широкий, а чистый ход умеренный — больше шума, чем направленного движения.";
    default:
      if (metrics.reactionDayPct != null && indexPeer?.reactionDayPct != null) {
        return `День: ${metrics.reactionDayPct >= 0 ? "+" : ""}${metrics.reactionDayPct.toFixed(2)}% vs индекс ${indexPeer.reactionDayPct >= 0 ? "+" : ""}${indexPeer.reactionDayPct.toFixed(2)}%.`;
      }
      return "Реакция по свечам — без явного доминирующего паттерна.";
  }
}

export function computeInstrumentReactionMetrics(input: {
  ticker: string;
  title: string;
  role: CbrInstrumentRole;
  dataStatus: CbrDataStatus;
  candles: CbrRateCandle[];
  date: string;
}): Omit<CbrInstrumentReactionMetrics, "pattern" | "patternLabel" | "traderRead"> {
  const calc = calculateReactionMetrics(input.candles, input.date);
  const legacyReturns = mapCalcWindowReturnsToLegacy(calc.windowReturns);
  const legacyVolumes = mapCalcWindowVolumesToLegacy(calc.windowVolumes);

  const windowReturns: Partial<Record<CbrReactionWindowId, number | null>> = {
    preDecision: legacyReturns.preDecision,
    firstImpulse: legacyReturns.firstImpulse,
    firstDigest: legacyReturns.firstDigest,
    prePress: null,
    postPress: legacyReturns.postPress,
    closePhase: null,
    fullDay: legacyReturns.fullDay,
  };

  const windowVolumes: Partial<Record<CbrReactionWindowId, number | null>> = {
    preDecision: legacyVolumes.preDecision,
    firstImpulse: legacyVolumes.firstImpulse,
    firstDigest: legacyVolumes.firstDigest,
    prePress: null,
    postPress: legacyVolumes.postPress,
    closePhase: null,
    fullDay: legacyVolumes.fullDay,
  };

  return {
    ticker: input.ticker,
    title: input.title,
    role: input.role,
    dataStatus: input.dataStatus,
    reactionStatus: calc.status,
    reactionReason: calc.reason ?? null,
    reaction5mPct: calc.reaction5mPct,
    reaction30mPct: calc.reaction30mPct,
    reactionPostPressPct: calc.reactionPostPressPct,
    reactionDayPct: calc.reactionDayPct,
    dayRangePct: calc.dayRangePct,
    volumeRatio: calc.volumeRatio,
    windowReturns,
    windowVolumes,
  };
}

export function slotIdToRole(slotId: string): CbrInstrumentRole {
  switch (slotId) {
    case "usd-rub":
    case "cny-rub":
      return "currency";
    case "equity-index":
      return "index";
    case "mx-futures":
      return "index";
    case "sber":
      return "bank";
    case "gazp":
    case "lkoh":
    case "vtbr":
      return "heavy";
    case "bonds":
      return "bonds";
    default:
      return "active";
  }
}

export function buildReactionMatrixFromChartSlots(
  slots: Array<{
    id: string;
    ticker: string;
    title: string;
    dataStatus: CbrDataStatus;
    candles: CbrRateCandle[];
    placeholder: boolean;
  }>,
  date: string,
): CbrInstrumentReactionMetrics[] {
  const tradable = slots.filter((s) => isRealMoexReplayInstrument(s));

  const baseRows: CbrInstrumentReactionMetrics[] = tradable.map((slot) => {
    if (!slotIsMoexAnalyzable(slot)) {
      return {
        ticker: slot.ticker,
        title: slot.title,
        role: slotIdToRole(slot.id),
        dataStatus: slot.dataStatus,
        reactionStatus: "no_data",
        reactionReason: "Нет MOEX-свечей",
        reaction5mPct: null,
        reaction30mPct: null,
        reactionPostPressPct: null,
        reactionDayPct: null,
        dayRangePct: null,
        volumeRatio: null,
        windowReturns: {},
        windowVolumes: {},
        pattern: null,
        patternLabel: null,
        traderRead: null,
      };
    }

    const metrics = computeInstrumentReactionMetrics({
      ticker: slot.ticker,
      title: slot.title,
      role: slotIdToRole(slot.id),
      dataStatus: slot.dataStatus,
      candles: slot.candles,
      date,
    });
    return {
      ...metrics,
      pattern: null,
      patternLabel: null,
      traderRead: null,
    };
  });

  const analyzableRows = baseRows.filter((r) => slotIsMoexAnalyzable(r));

  const peers: CbrReactionPeerSnapshot[] = analyzableRows.map((r) => ({
    ticker: r.ticker,
    role: r.role,
    dataStatus: r.dataStatus,
    reactionDayPct: r.reactionDayPct,
    reaction30mPct: r.reaction30mPct,
    reactionPostPressPct: r.reactionPostPressPct,
    volumeRatio: r.volumeRatio,
    dayRangePct: r.dayRangePct,
  }));

  return baseRows.map((row) => {
    if (!slotIsMoexAnalyzable(row) || row.reactionStatus === "no_data") {
      return row;
    }
    if (row.reactionStatus === "incomplete") {
      return { ...row, pattern: null, patternLabel: null, traderRead: null };
    }
    const classified = classifyReactionPattern(row, peers);
    return { ...row, ...classified };
  });
}
