import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import type { ScreenerRow } from "@screenerpro/shared";
import { signalStateDisplayEn } from "./display";
import { DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS } from "./signal-thresholds";
import { resolveQuadHedgeLeg } from "./legs";
import { countStretchDuration } from "./metrics";
import type {
  QuadHedgeAnalyticsResult,
  QuadHedgeLegId,
  QuadHedgeSpreadPairKey,
} from "./types";
import { QUAD_HEDGE_MIN_SIGNAL_POINTS } from "./types";

export type QuadHedgeLegRowStatus =
  | "ok"
  | "partial"
  | "no-data"
  | "insufficient"
  | "stale"
  | "demo";

export type QuadHedgeLegTableRow = {
  channelLabel: string;
  primaryLegId: QuadHedgeLegId;
  refLegId: QuadHedgeLegId | null;
  refNote: string | null;
  instrumentLabel: string;
  refInstrumentLabel: string | null;
  price: number | null;
  changePct: number | null;
  normalizedPct: number | null;
  high: number | null;
  low: number | null;
  rangePct: number | null;
  volume: number | null;
  turnoverRub: number | null;
  timestamp: string | null;
  timestampLabel: string | null;
  status: QuadHedgeLegRowStatus;
  statusLabel: string;
  hasData: boolean;
};

export type QuadHedgeDivergenceRowStatus = "ok" | "no-data" | "insufficient";

export type QuadHedgeDivergenceTableRow = {
  pairLabel: string;
  pairKey: QuadHedgeSpreadPairKey;
  spreadPp: number | null;
  zScore: number | null;
  correlation: number | null;
  direction: string | null;
  durationBars: number | null;
  signal: string;
  interpretation: string;
  status: QuadHedgeDivergenceRowStatus;
  hasData: boolean;
};

export type QuadHedgeTablesModel = {
  legs: QuadHedgeLegTableRow[];
  divergences: QuadHedgeDivergenceTableRow[];
};

const CHANNELS: Array<{
  channelLabel: string;
  primaryLeg: QuadHedgeLegId;
  refLeg: QuadHedgeLegId | null;
  refNote: string | null;
}> = [
  { channelLabel: "SI USD/RUB", primaryLeg: "SI", refLeg: null, refNote: null },
  { channelLabel: "EU EUR/RUB", primaryLeg: "EU", refLeg: null, refNote: null },
  { channelLabel: "CN CNY/RUB", primaryLeg: "CN", refLeg: null, refNote: null },
  { channelLabel: "ED (context)", primaryLeg: "ED", refLeg: null, refNote: "optional EUR/USD" },
];

const DIVERGENCE_ROWS: Array<{
  pairKey: QuadHedgeSpreadPairKey;
  pairLabel: string;
  optional?: boolean;
}> = [
  { pairKey: "SI/CN", pairLabel: "SI vs CN" },
  { pairKey: "SI/EU", pairLabel: "SI vs EU" },
  { pairKey: "EU/CN", pairLabel: "EU vs CN" },
];

type WindowStats = {
  price: number;
  changePct: number | null;
  high: number | null;
  low: number | null;
  rangePct: number | null;
  volume: number | null;
  turnoverRub: number | null;
  timestamp: string;
  pointCount: number;
};

function formatTimeShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statsFromCandles(points: IntradayCandlePoint[]): WindowStats | null {
  if (!points.length) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (!Number.isFinite(last.close)) return null;

  let high: number | null = null;
  let low: number | null = null;
  let volume = 0;
  let turnoverRub = 0;
  let hasVol = false;
  let hasVal = false;

  for (const p of points) {
    if (p.high != null && Number.isFinite(p.high)) {
      high = high == null ? p.high : Math.max(high, p.high);
    }
    if (p.low != null && Number.isFinite(p.low)) {
      low = low == null ? p.low : Math.min(low, p.low);
    }
    if (p.volume != null && Number.isFinite(p.volume)) {
      volume += p.volume;
      hasVol = true;
    }
    if (p.value != null && Number.isFinite(p.value)) {
      turnoverRub += p.value;
      hasVal = true;
    }
  }

  const changePct =
    first.close != null && first.close !== 0 && Number.isFinite(first.close)
      ? (last.close / first.close - 1) * 100
      : null;

  const rangePct =
    high != null && low != null && low > 0 ? ((high - low) / low) * 100 : null;

  return {
    price: last.close,
    changePct,
    high,
    low,
    rangePct,
    volume: hasVol ? volume : null,
    turnoverRub: hasVal ? turnoverRub : null,
    timestamp: last.timestamp,
    pointCount: points.length,
  };
}

function statsFromScreenerRow(row: ScreenerRow): WindowStats | null {
  if (row.lastPrice == null || !Number.isFinite(row.lastPrice)) return null;
  const rangePct =
    row.high != null && row.low != null && row.low > 0
      ? ((row.high - row.low) / row.low) * 100
      : row.metrics.dayRangePct ?? null;

  return {
    price: row.lastPrice,
    changePct: row.percentChange,
    high: row.high,
    low: row.low,
    rangePct,
    volume: row.volume,
    turnoverRub: row.turnover,
    timestamp: row.updatedAt,
    pointCount: 1,
  };
}

function legStatusLabel(status: QuadHedgeLegRowStatus): string {
  const map: Record<QuadHedgeLegRowStatus, string> = {
    ok: "OK",
    partial: "частично",
    "no-data": "нет данных",
    insufficient: "мало точек",
    stale: "устарело",
    demo: "demo",
  };
  return map[status];
}

function resolveLegStatus(
  pointCount: number,
  source: "intraday" | "screener" | "none",
  screenerDemo: boolean,
  qualityStatus?: string,
): QuadHedgeLegRowStatus {
  if (source === "none") return "no-data";
  if (screenerDemo) return "demo";
  if (qualityStatus === "stale") return "stale";
  if (source === "screener" || pointCount < 2) {
    return pointCount >= 1 ? "partial" : "no-data";
  }
  if (pointCount < QUAD_HEDGE_MIN_SIGNAL_POINTS) return "insufficient";
  return "ok";
}

function pairSignalLabel(
  z: number | null,
  canComputeSignals: boolean,
  status: QuadHedgeDivergenceRowStatus,
): string {
  const th = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS;
  if (!canComputeSignals || status !== "ok" || z == null) {
    return signalStateDisplayEn("no-data");
  }
  const abs = Math.abs(z);
  if (abs >= th.strongDivergenceZ) return signalStateDisplayEn("strong-divergence");
  if (abs >= th.divergenceZ) return signalStateDisplayEn("divergence");
  if (abs >= th.watchZ) return signalStateDisplayEn("watch");
  return signalStateDisplayEn("sync");
}

function spreadDirectionForPair(
  pairKey: QuadHedgeSpreadPairKey,
  spread: number | null,
): string | null {
  if (spread == null || !Number.isFinite(spread)) return null;
  if (Math.abs(spread) < 0.03) return "паритет";

  const [a, b] = pairKey.split("/") as [string, string];
  if (spread > 0) return `${a} сильнее ${b}`;
  return `${b} сильнее ${a}`;
}

export function interpretDivergenceRow(input: {
  pairKey: QuadHedgeSpreadPairKey;
  spreadPp: number | null;
  zScore: number | null;
  canComputeSignals: boolean;
  hasBothLegs: boolean;
  analytics: QuadHedgeAnalyticsResult | null;
}): string {
  const { pairKey, spreadPp, zScore, canComputeSignals, hasBothLegs, analytics } = input;

  if (!hasBothLegs || !canComputeSignals) {
    return "Данных недостаточно — только наблюдение";
  }

  if (zScore != null && Math.abs(zScore) >= 1.5) {
    return "Одна нога оторвалась от двух других — смотреть расхождение";
  }

  if (analytics?.directionAgreement.isAligned) {
    return "SI/EU/CN синхронны — общее движение рубля";
  }

  if (spreadPp != null && Math.abs(spreadPp) >= 0.08) {
    return "Расхождение расширяется — наблюдение";
  }

  return "Связка в норме";
}

export function buildQuadHedgeTablesModel(input: {
  intradayInstruments?: Array<{
    ticker: string;
    points: IntradayCandlePoint[];
    status: string;
  }>;
  screenerRows: ScreenerRow[];
  analytics: QuadHedgeAnalyticsResult | null;
  screenerSource?: "MOEX ISS" | "demo";
}): QuadHedgeTablesModel {
  const screenerDemo = input.screenerSource === "demo";
  const qualityByLeg = new Map(
    input.analytics?.dataQuality.legs.map((l) => [l.legId, l]) ?? [],
  );
  const normByLeg = new Map(
    input.analytics?.normalizedChangePct.map((n) => [n.legId, n]) ?? [],
  );

  const intradayByLeg = new Map<QuadHedgeLegId, { ticker: string; points: IntradayCandlePoint[] }>();
  for (const inst of input.intradayInstruments ?? []) {
    if (inst.status !== "ok" || !inst.points.length) continue;
    const leg = resolveQuadHedgeLeg(inst.ticker);
    if (leg === "SI" || leg === "CN" || leg === "EU" || leg === "ED") {
      intradayByLeg.set(leg, { ticker: inst.ticker, points: inst.points });
    }
  }

  const screenerByLeg = new Map<QuadHedgeLegId, ScreenerRow>();
  for (const row of input.screenerRows) {
    const leg = resolveQuadHedgeLeg(row.ticker, row.shortName ?? "");
    if (!leg) continue;
    const prev = screenerByLeg.get(leg);
    if (!prev || (row.turnover ?? 0) > (prev.turnover ?? 0)) screenerByLeg.set(leg, row);
  }

  const legs: QuadHedgeLegTableRow[] = CHANNELS.map((ch) => {
    const intraday = intradayByLeg.get(ch.primaryLeg);
    const screenerPrimary = screenerByLeg.get(ch.primaryLeg);
    const screenerRef = ch.refLeg ? screenerByLeg.get(ch.refLeg) : null;

    const candleStats = intraday ? statsFromCandles(intraday.points) : null;
    const snapStats = !candleStats && screenerPrimary ? statsFromScreenerRow(screenerPrimary) : null;
    const stats = candleStats ?? snapStats;

    const quality = qualityByLeg.get(ch.primaryLeg);
    const source: "intraday" | "screener" | "none" = candleStats
      ? "intraday"
      : snapStats
        ? "screener"
        : "none";

    const status = resolveLegStatus(
      stats?.pointCount ?? 0,
      source,
      screenerDemo,
      quality?.status,
    );

    const norm = normByLeg.get(ch.primaryLeg);

    return {
      channelLabel: ch.channelLabel,
      primaryLegId: ch.primaryLeg,
      refLegId: ch.refLeg,
      refNote: ch.refNote,
      instrumentLabel: intraday?.ticker ?? screenerPrimary?.ticker ?? "—",
      refInstrumentLabel: ch.refLeg ? screenerRef?.ticker ?? "—" : ch.refNote,
      price: stats?.price ?? null,
      changePct: stats?.changePct ?? null,
      normalizedPct: norm?.currentPct ?? null,
      high: stats?.high ?? null,
      low: stats?.low ?? null,
      rangePct: stats?.rangePct ?? null,
      volume: stats?.volume ?? null,
      turnoverRub: stats?.turnoverRub ?? null,
      timestamp: stats?.timestamp ?? null,
      timestampLabel: formatTimeShort(stats?.timestamp ?? null),
      status,
      statusLabel: legStatusLabel(status),
      hasData: status !== "no-data" && stats != null,
    };
  });

  const canCompute = input.analytics?.dataQuality.canComputeSignals ?? false;
  const spreads = input.analytics?.spreads ?? [];
  const zScores = input.analytics?.zScores ?? [];

  const divergences: QuadHedgeDivergenceTableRow[] = DIVERGENCE_ROWS.map((def) => {
    const spread = spreads.find((s) => s.pairKey === def.pairKey);
    const z = zScores.find((item) => item.pairKey === def.pairKey);
    const hasBothLegs = spread?.status === "ok" || spread?.status === "insufficient-data";
    const spreadPp = spread?.current ?? null;
    const zScore = z?.current ?? null;
    const durationBars =
      z?.status === "ok" && z.series.length ? countStretchDuration(z.series) : null;
    let status: QuadHedgeDivergenceRowStatus = "no-data";
    if (spread?.status === "ok" && z?.status === "ok") status = "ok";
    else if (spread?.status === "insufficient-data" || z?.status === "insufficient-data") {
      status = "insufficient";
    }

    const signal = pairSignalLabel(zScore, canCompute, status);

    return {
      pairLabel: def.pairLabel,
      pairKey: def.pairKey,
      spreadPp,
      zScore,
      correlation: null,
      direction: spreadDirectionForPair(def.pairKey, spreadPp),
      durationBars,
      signal,
      interpretation: interpretDivergenceRow({
        pairKey: def.pairKey,
        spreadPp,
        zScore,
        canComputeSignals: canCompute,
        hasBothLegs,
        analytics: input.analytics,
      }),
      status,
      hasData: status === "ok" || status === "insufficient",
    };
  });

  return { legs, divergences };
}
