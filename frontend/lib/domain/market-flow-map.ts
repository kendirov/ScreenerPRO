import type { ScreenerRow } from "@screenerpro/shared";
import { isStockIlliquid } from "@/lib/domain/stock-screener-display";

export type MarketFlowState =
  | "money-growth"
  | "money-pressure"
  | "thin-move"
  | "noise"
  | "neutral";

export type MarketFlowDataStatus =
  | "live"
  | "last-available"
  | "partial"
  | "no-yesterday"
  | "no-data";

export type FlowStateShift =
  | "awakened"
  | "accelerated"
  | "pressure-up"
  | "faded"
  | "unchanged"
  | "no-yesterday";

export type FlowCompareMode = "today" | "vs-yesterday";

export type MarketFlowNode = {
  secid: string;
  ticker: string;
  name: string;
  sector?: string;

  price: number | null;
  changePct: number | null;
  openChangePct: number | null;

  turnover: number | null;
  trades: number | null;
  rangePct: number | null;

  yesterdayTurnoverAtSameTime: number | null;
  relativeTurnover: number | null;

  turnoverDeltaVsYesterdayPct: number | null;
  changeDeltaVsYesterday: number | null;
  stateShift: FlowStateShift;
  stateShiftReason: string;

  xScore: number;
  yScore: number;
  sizeScore: number;
  colorScore: number;

  previousXScore?: number | null;
  previousYScore?: number | null;

  flowState: MarketFlowState;
  reasonTags: string[];
  dataStatus: MarketFlowDataStatus;
};

export type YesterdayFlowContext = {
  turnoverAtSameTime: number | null;
  openChangePctAtSameTime: number | null;
  source: "moex-intraday" | "none";
};

export type MarketFlowSummary = {
  money: { ticker: string; detail: string } | null;
  impulse: { ticker: string; detail: string } | null;
  pressure: { ticker: string; detail: string } | null;
  yesterdayCoverage: "full" | "partial" | "none";
};

export type FlowDayShiftEntry = {
  ticker: string;
  reason: string;
};

export type FlowDayShifts = {
  awakened: FlowDayShiftEntry[];
  accelerated: FlowDayShiftEntry[];
  pressure: FlowDayShiftEntry[];
  faded: FlowDayShiftEntry[];
};

const STATE_SHIFT_LABELS: Record<FlowStateShift, string> = {
  awakened: "Проснулся",
  accelerated: "Ускорился",
  "pressure-up": "Давление усилилось",
  faded: "Затух",
  unchanged: "Без изменений",
  "no-yesterday": "Нет вчера",
};

const STATE_SHIFT_PRIORITY: Record<FlowStateShift, number> = {
  awakened: 5,
  accelerated: 4,
  "pressure-up": 4,
  faded: 3,
  unchanged: 0,
  "no-yesterday": 0,
};

const HIGH_RELATIVE = 1.25;
const VERY_HIGH_RELATIVE = 1.35;
const LOW_RELATIVE = 0.75;
const CHANGE_DELTA_THRESHOLD = 0.12;

const MAX_NODES = 60;
const MIN_TURNOVER_FLOOR = 5_000_000;
const WINSORIZE_PCT = 0.02;
const HIGH_MONEY_X = 65;
const LOW_MONEY_X = 35;
const MOVE_THRESHOLD = 0.12;

const FLOW_STATE_LABELS: Record<MarketFlowState, string> = {
  "money-growth": "Деньги + рост",
  "money-pressure": "Деньги + давление",
  "thin-move": "Тонкий разгон",
  noise: "Шум",
  neutral: "Нейтрально",
};

export type FlowZoneId = "tl" | "tr" | "bl" | "br";

export function getFlowZoneForState(state: MarketFlowState): FlowZoneId {
  switch (state) {
    case "money-growth":
      return "tr";
    case "money-pressure":
      return "br";
    case "thin-move":
      return "tl";
    case "noise":
      return "bl";
    default:
      return "bl";
  }
}

const DATA_STATUS_LABELS: Record<MarketFlowDataStatus, string> = {
  live: "MOEX ISS · вчера к этому времени",
  "last-available": "Последние доступные данные",
  partial: "Оценка по вчерашнему дню (без минутных свечей)",
  "no-yesterday": "Нет вчерашнего сравнения",
  "no-data": "Нет данных",
};

export const FLOW_READING_PILLS = [
  { id: "x", text: "Правее = оборот выше вчера к этому времени" },
  { id: "y-up", text: "Выше = рост от открытия" },
  { id: "y-down", text: "Ниже = давление" },
  { id: "size", text: "Размер = оборот" },
  { id: "tail", text: "Хвост = сдвиг с вчера (если есть данные)" },
] as const;

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function winsorizeBounds(values: number[], pct = WINSORIZE_PCT): [number, number] {
  if (!values.length) return [0, 1];
  const sorted = [...values].sort((a, b) => a - b);
  const loIdx = Math.floor(sorted.length * pct);
  const hiIdx = Math.ceil(sorted.length * (1 - pct)) - 1;
  return [sorted[loIdx] ?? sorted[0]!, sorted[hiIdx] ?? sorted[sorted.length - 1]!];
}

function buildPercentileRank(values: Map<string, number>): Map<string, number> {
  const entries = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const n = entries.length;
  const map = new Map<string, number>();
  entries.forEach(([ticker], i) => {
    const pct = n <= 1 ? 50 : (i / (n - 1)) * 100;
    map.set(ticker, pct);
  });
  return map;
}

function computeOpenChangePct(open: number | null, lastPrice: number | null): number | null {
  if (open == null || lastPrice == null || open <= 0) return null;
  return ((lastPrice - open) / open) * 100;
}

function classifyFlowState(xScore: number, yScore: number): MarketFlowState {
  const highMoney = xScore >= HIGH_MONEY_X;
  const lowMoney = xScore <= LOW_MONEY_X;
  const up = yScore > MOVE_THRESHOLD;
  const down = yScore < -MOVE_THRESHOLD;
  const hasMove = Math.abs(yScore) >= MOVE_THRESHOLD;

  if (highMoney && up) return "money-growth";
  if (highMoney && down) return "money-pressure";
  if (hasMove && lowMoney) return "thin-move";
  if (lowMoney && !hasMove) return "noise";
  return "neutral";
}

function buildReasonTags(
  flowState: MarketFlowState,
  relativeTurnover: number | null,
  yScore: number,
  dataStatus: MarketFlowDataStatus,
): string[] {
  const tags: string[] = [FLOW_STATE_LABELS[flowState]];

  if (relativeTurnover != null && relativeTurnover >= 1.35) tags.push("оборот выше вчера");
  if (relativeTurnover != null && relativeTurnover <= 0.75) tags.push("оборот ниже вчера");
  if (yScore > MOVE_THRESHOLD) tags.push("рост от открытия");
  if (yScore < -MOVE_THRESHOLD) tags.push("давление");
  if (dataStatus === "no-yesterday") tags.push("нет вчерашнего сравнения");
  if (dataStatus === "partial") tags.push("оценка без минутных свечей");

  return tags;
}

type DraftNode = Omit<
  MarketFlowNode,
  | "xScore"
  | "yScore"
  | "sizeScore"
  | "colorScore"
  | "flowState"
  | "reasonTags"
  | "previousXScore"
  | "previousYScore"
  | "turnoverDeltaVsYesterdayPct"
  | "changeDeltaVsYesterday"
  | "stateShift"
  | "stateShiftReason"
>;

function resolveYesterdayTurnover(
  row: ScreenerRow,
  yesterday?: YesterdayFlowContext,
): { value: number | null; status: MarketFlowDataStatus } {
  const moex = yesterday?.source === "moex-intraday" ? yesterday.turnoverAtSameTime : null;
  if (moex != null && moex > 0) {
    return { value: moex, status: "live" };
  }

  const previousDay = num(row.metrics.previousDayTurnoverRub);
  const progress = num(row.metrics.sessionProgress);
  if (previousDay != null && progress != null && progress > 0.05) {
    return { value: previousDay * progress, status: "partial" };
  }

  if (previousDay != null) {
    return { value: null, status: "no-yesterday" };
  }

  return { value: null, status: "no-yesterday" };
}

function buildDraftNode(row: ScreenerRow, maxTurnover: number, yesterday?: YesterdayFlowContext): DraftNode | null {
  if (row.assetClass !== "stock") return null;
  if (isStockIlliquid(row, maxTurnover)) return null;

  const turnover = num(row.turnover);
  if ((turnover ?? 0) < MIN_TURNOVER_FLOOR) return null;

  const changePct = num(row.percentChange);
  const openChangePct = computeOpenChangePct(num(row.open), num(row.lastPrice)) ?? changePct;
  const { value: yesterdayTurnoverAtSameTime, status: dataStatus } = resolveYesterdayTurnover(row, yesterday);

  let relativeTurnover: number | null = null;
  if (turnover != null && yesterdayTurnoverAtSameTime != null && yesterdayTurnoverAtSameTime > 0) {
    relativeTurnover = turnover / yesterdayTurnoverAtSameTime;
  }

  const hasLiveYesterday = yesterday?.source === "moex-intraday" && yesterday.turnoverAtSameTime != null;

  return {
    secid: row.ticker,
    ticker: row.ticker,
    name: row.shortName?.trim() || row.ticker,
    price: num(row.lastPrice),
    changePct,
    openChangePct,
    turnover,
    trades: num(row.tradesCount ?? null),
    rangePct: num(row.metrics.dayRangePct),
    yesterdayTurnoverAtSameTime,
    relativeTurnover,
    dataStatus: turnover == null ? "no-data" : hasLiveYesterday ? "live" : dataStatus,
  };
}

function scoreNodes(drafts: DraftNode[]): MarketFlowNode[] {
  if (!drafts.length) return [];

  const relativeValues = new Map<string, number>();
  const turnoverValues = new Map<string, number>();
  const yValues = new Map<string, number>();
  const yesterdayTurnoverValues = new Map<string, number>();
  const yesterdayYValues = new Map<string, number>();

  for (const draft of drafts) {
    if (draft.relativeTurnover != null) {
      relativeValues.set(draft.ticker, draft.relativeTurnover);
    } else if (draft.turnover != null) {
      turnoverValues.set(draft.ticker, draft.turnover);
    }
    yValues.set(draft.ticker, draft.openChangePct ?? draft.changePct ?? 0);
    if (draft.yesterdayTurnoverAtSameTime != null) {
      yesterdayTurnoverValues.set(draft.ticker, draft.yesterdayTurnoverAtSameTime);
    }
  }

  const xFromRelative = buildPercentileRank(relativeValues);
  const xFromTurnover = buildPercentileRank(turnoverValues);
  const sizeRanks = buildPercentileRank(
    new Map(drafts.filter((d) => d.turnover != null).map((d) => [d.ticker, d.turnover!])),
  );
  const previousXRanks = buildPercentileRank(yesterdayTurnoverValues);

  return drafts.map((draft) => {
    const xScore = xFromRelative.get(draft.ticker) ?? xFromTurnover.get(draft.ticker) ?? 50;
    const yScore = yValues.get(draft.ticker) ?? 0;
    const sizeScore = sizeRanks.get(draft.ticker) ?? 50;
    const colorScore = draft.openChangePct ?? draft.changePct ?? 0;
    const flowState = classifyFlowState(xScore, yScore);
    const reasonTags = buildReasonTags(flowState, draft.relativeTurnover, yScore, draft.dataStatus);

    const hasTail =
      draft.dataStatus === "live" &&
      previousXRanks.has(draft.ticker) &&
      draft.yesterdayTurnoverAtSameTime != null;

    return {
      ...draft,
      xScore,
      yScore,
      sizeScore,
      colorScore,
      flowState,
      reasonTags,
      previousXScore: hasTail ? (previousXRanks.get(draft.ticker) ?? null) : null,
      previousYScore: null,
      turnoverDeltaVsYesterdayPct: null,
      changeDeltaVsYesterday: null,
      stateShift: "no-yesterday" as FlowStateShift,
      stateShiftReason: "",
    };
  });
}

export function buildMarketFlowNodes(
  rows: ScreenerRow[],
  yesterdayByTicker?: Map<string, YesterdayFlowContext>,
  limit = MAX_NODES,
): MarketFlowNode[] {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const maxTurnover = stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);

  const drafts = stocks
    .map((row) => buildDraftNode(row, maxTurnover, yesterdayByTicker?.get(row.ticker)))
    .filter((node): node is DraftNode => node != null)
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, limit);

  const scored = scoreNodes(drafts);

  if (!yesterdayByTicker?.size) {
    return scored.map((node) => enrichNodeComparison(node, yesterdayByTicker, scored));
  }

  const withYesterdayY = scored.map((node) => {
    const ctx = yesterdayByTicker.get(node.ticker);
    if (node.dataStatus !== "live" || ctx?.source !== "moex-intraday") return node;
    const prevY = ctx.openChangePctAtSameTime;
    if (prevY == null || node.previousXScore == null) {
      return { ...node, previousXScore: null, previousYScore: null };
    }
    return { ...node, previousYScore: prevY };
  });

  return withYesterdayY.map((node) => enrichNodeComparison(node, yesterdayByTicker, withYesterdayY));
}

function percentileValue(sorted: number[], pct: number): number {
  if (!sorted.length) return 0;
  const idx = Math.floor((sorted.length - 1) * pct);
  return sorted[idx] ?? sorted[0]!;
}

function classifyStateShift(
  node: MarketFlowNode,
  ctx: {
    lowYesterdayThreshold: number;
    medianYesterday: number;
    changeDeltaVsYesterday: number | null;
  },
): { shift: FlowStateShift; reason: string } {
  if (node.yesterdayTurnoverAtSameTime == null || node.relativeTurnover == null) {
    return { shift: "no-yesterday", reason: "нет вчерашнего сравнения" };
  }

  const rel = node.relativeTurnover;
  const y = node.yScore;
  const yesterdayTurnover = node.yesterdayTurnoverAtSameTime;
  const wasActiveYesterday =
    (node.previousXScore != null && node.previousXScore >= 55) || yesterdayTurnover >= ctx.medianYesterday * 0.85;

  if (rel <= LOW_RELATIVE && wasActiveYesterday) {
    return { shift: "faded", reason: "оборот ниже вчера к этому времени" };
  }

  if (rel >= HIGH_RELATIVE && y < -MOVE_THRESHOLD) {
    return { shift: "pressure-up", reason: "деньги на снижении" };
  }

  if (rel >= VERY_HIGH_RELATIVE && yesterdayTurnover <= ctx.lowYesterdayThreshold) {
    return { shift: "awakened", reason: "оборот вырос от слабого вчера" };
  }

  if (
    rel >= HIGH_RELATIVE &&
    ctx.changeDeltaVsYesterday != null &&
    ctx.changeDeltaVsYesterday >= CHANGE_DELTA_THRESHOLD
  ) {
    return { shift: "accelerated", reason: "движение усилилось к вчера" };
  }

  if (rel >= VERY_HIGH_RELATIVE) {
    return { shift: "accelerated", reason: "оборот заметно выше вчера" };
  }

  return { shift: "unchanged", reason: "без выраженного сдвига" };
}

function enrichNodeComparison(
  node: MarketFlowNode,
  yesterdayByTicker: Map<string, YesterdayFlowContext> | undefined,
  allNodes: MarketFlowNode[],
): MarketFlowNode {
  const yesterdayTurnovers = allNodes
    .map((n) => n.yesterdayTurnoverAtSameTime)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);

  const medianYesterday = yesterdayTurnovers.length
    ? yesterdayTurnovers[Math.floor(yesterdayTurnovers.length / 2)]!
    : 0;
  const lowYesterdayThreshold = percentileValue(yesterdayTurnovers, 0.4);

  let turnoverDeltaVsYesterdayPct: number | null = null;
  if (node.relativeTurnover != null) {
    turnoverDeltaVsYesterdayPct = (node.relativeTurnover - 1) * 100;
  } else if (
    node.turnover != null &&
    node.yesterdayTurnoverAtSameTime != null &&
    node.yesterdayTurnoverAtSameTime > 0
  ) {
    turnoverDeltaVsYesterdayPct =
      ((node.turnover - node.yesterdayTurnoverAtSameTime) / node.yesterdayTurnoverAtSameTime) * 100;
  }

  const todayChange = node.openChangePct ?? node.changePct;
  const yesterdayChange = yesterdayByTicker?.get(node.ticker)?.openChangePctAtSameTime ?? null;
  let changeDeltaVsYesterday: number | null = null;
  if (todayChange != null && yesterdayChange != null) {
    changeDeltaVsYesterday = todayChange - yesterdayChange;
  }

  const base: MarketFlowNode = {
    ...node,
    turnoverDeltaVsYesterdayPct,
    changeDeltaVsYesterday,
    stateShift: "no-yesterday",
    stateShiftReason: "нет вчерашнего сравнения",
  };

  const { shift, reason } = classifyStateShift(base, {
    lowYesterdayThreshold,
    medianYesterday,
    changeDeltaVsYesterday,
  });

  return { ...base, stateShift: shift, stateShiftReason: reason };
}

export function hasFlowYesterdayComparison(nodes: MarketFlowNode[]): boolean {
  return nodes.some((n) => n.relativeTurnover != null && n.stateShift !== "no-yesterday");
}

export function getStateShiftLabel(shift: FlowStateShift): string {
  return STATE_SHIFT_LABELS[shift];
}

export function isNotableStateShift(shift: FlowStateShift): boolean {
  return STATE_SHIFT_PRIORITY[shift] >= 3;
}

export function buildFlowDayShifts(nodes: MarketFlowNode[], limitPerGroup = 4): FlowDayShifts {
  const byShift = (shift: FlowStateShift) =>
    [...nodes]
      .filter((n) => n.stateShift === shift)
      .sort((a, b) => (b.relativeTurnover ?? 0) - (a.relativeTurnover ?? 0))
      .slice(0, limitPerGroup)
      .map((n) => ({ ticker: n.ticker, reason: n.stateShiftReason }));

  return {
    awakened: byShift("awakened"),
    accelerated: byShift("accelerated"),
    pressure: byShift("pressure-up"),
    faded: byShift("faded"),
  };
}

export function getTopStateShiftTickers(nodes: MarketFlowNode[], limit = 6): Set<string> {
  return new Set(
    [...nodes]
      .filter((n) => isNotableStateShift(n.stateShift))
      .sort((a, b) => STATE_SHIFT_PRIORITY[b.stateShift] - STATE_SHIFT_PRIORITY[a.stateShift])
      .slice(0, limit)
      .map((n) => n.ticker),
  );
}

export function computeFlowScore(node: MarketFlowNode): number {
  const rel = node.relativeTurnover != null ? Math.min(node.relativeTurnover, 3) : 1;
  const move = Math.abs(node.yScore);
  const money = node.xScore / 100;
  const size = node.sizeScore / 100;
  const quality = node.dataStatus === "live" ? 1 : node.dataStatus === "partial" ? 0.85 : 0.65;
  return (rel * 0.38 + move * 0.22 + money * 0.22 + size * 0.18) * quality;
}

export function computeTailShift(node: MarketFlowNode): number {
  if (node.previousXScore == null || node.previousYScore == null) return 0;
  const dx = Math.abs(node.xScore - node.previousXScore);
  const dy = Math.abs(node.yScore - node.previousYScore);
  return Math.min(1, (dx + dy * 1.4) / 75);
}

export function flowNodeOpacity(node: MarketFlowNode): number {
  const base = node.dataStatus === "no-data" ? 0.38 : node.dataStatus === "no-yesterday" ? 0.48 : 0.58;
  const signal = Math.min(1, computeFlowScore(node) / 1.65);
  const floor = node.sizeScore < 25 ? 0.42 : 0;
  return Math.max(floor, base + signal * 0.34);
}

export function flowNodeBrightness(node: MarketFlowNode): number {
  if (node.relativeTurnover == null) return 1;
  return clamp(0.88 + Math.min(node.relativeTurnover, 2.5) * 0.12, 0.9, 1.35);
}

export function buildMarketFlowSummary(nodes: MarketFlowNode[]): MarketFlowSummary {
  const byTurnover = [...nodes].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));
  const moneyLeader = byTurnover[0] ?? null;

  const impulseLeader = [...nodes]
    .filter((n) => n.relativeTurnover != null && n.relativeTurnover > 1)
    .sort((a, b) => (b.relativeTurnover ?? 0) - (a.relativeTurnover ?? 0))[0] ?? null;

  const pressureLeader = [...nodes]
    .filter((n) => (n.openChangePct ?? n.changePct ?? 0) < -MOVE_THRESHOLD && (n.turnover ?? 0) > MIN_TURNOVER_FLOOR)
    .sort((a, b) => {
      const aW = (a.turnover ?? 0) * Math.abs(a.openChangePct ?? a.changePct ?? 0);
      const bW = (b.turnover ?? 0) * Math.abs(b.openChangePct ?? b.changePct ?? 0);
      return bW - aW;
    })[0] ?? null;

  const liveCount = nodes.filter((n) => n.dataStatus === "live").length;
  const partialCount = nodes.filter((n) => n.dataStatus === "partial").length;

  let yesterdayCoverage: MarketFlowSummary["yesterdayCoverage"] = "none";
  if (liveCount > nodes.length * 0.4) yesterdayCoverage = "full";
  else if (partialCount > 0 || liveCount > 0) yesterdayCoverage = "partial";

  return {
    money: moneyLeader
      ? { ticker: moneyLeader.ticker, detail: formatTurnoverShort(moneyLeader.turnover) }
      : null,
    impulse: impulseLeader
      ? { ticker: impulseLeader.ticker, detail: formatRelativeTurnover(impulseLeader.relativeTurnover) }
      : null,
    pressure: pressureLeader
      ? {
          ticker: pressureLeader.ticker,
          detail: formatSignedPctShort(pressureLeader.openChangePct ?? pressureLeader.changePct),
        }
      : null,
    yesterdayCoverage,
  };
}

function formatTurnoverShort(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} млрд`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} млн`;
  return `${(value / 1_000).toFixed(0)} тыс`;
}

function formatSignedPctShort(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function getFlowStateLabel(state: MarketFlowState): string {
  return FLOW_STATE_LABELS[state];
}

export function getFlowDataStatusLabel(status: MarketFlowDataStatus): string {
  return DATA_STATUS_LABELS[status];
}

export function formatRelativeTurnover(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "нет вчерашнего сравнения";
  return `×${value.toFixed(2)}`;
}

export function flowYDomain(nodes: MarketFlowNode[]): [number, number] {
  const values = nodes.map((n) => n.yScore);
  if (!values.length) return [-1, 1];
  const [lo, hi] = winsorizeBounds(values.map(Math.abs), WINSORIZE_PCT);
  const absMax = Math.max(lo, hi, 0.35);
  return [-absMax, absMax];
}

export function yesterdayItemsToMap(items: Array<YesterdayFlowContext & { secid: string; source: "moex-intraday" | "none" }>): Map<string, YesterdayFlowContext> {
  const map = new Map<string, YesterdayFlowContext>();
  for (const item of items) {
    if (item.source !== "moex-intraday") continue;
    map.set(item.secid, {
      turnoverAtSameTime: item.turnoverAtSameTime,
      openChangePctAtSameTime: item.openChangePctAtSameTime,
      source: item.source,
    });
  }
  return map;
}

export type MarketFlowYesterdayItem = YesterdayFlowContext & {
  secid: string;
  status: "ok" | "empty" | "error";
  error?: string;
};

export type MarketFlowYesterdayResponse = {
  asOfMsk: string;
  previousTradingDate: string;
  source: "moex" | "unavailable";
  items: MarketFlowYesterdayItem[];
  diagnostics: string[];
};

export function flowNodeColor(colorScore: number): {
  background: string;
  border: string;
  text: string;
} {
  const intensity = Math.min(1, Math.abs(colorScore) / 2.5);
  if (colorScore > 0.04) {
    return {
      background: `rgba(6,78,59,${0.22 + intensity * 0.38})`,
      border: `rgba(52,211,153,${0.2 + intensity * 0.3})`,
      text: "text-emerald-300",
    };
  }
  if (colorScore < -0.04) {
    return {
      background: `rgba(127,29,29,${0.22 + intensity * 0.34})`,
      border: `rgba(251,113,133,${0.2 + intensity * 0.28})`,
      text: "text-rose-300",
    };
  }
  return {
    background: "rgba(15,23,42,0.55)",
    border: "rgba(148,163,184,0.18)",
    text: "text-slate-400",
  };
}
