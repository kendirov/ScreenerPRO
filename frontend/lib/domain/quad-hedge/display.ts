import type {
  QuadHedgeAnalyticsResult,
  QuadHedgeDataQuality,
  QuadHedgeSignalState,
  QuadHedgeTradeBias,
} from "./types";
import type { QuadHedgeHistoryMeta } from "./window";

export function signalStateDisplayEn(state: QuadHedgeSignalState): string {
  const map: Record<QuadHedgeSignalState, string> = {
    "no-data": "NO DATA",
    sync: "SYNC",
    watch: "WATCH",
    divergence: "DIVERGENCE",
    "strong-divergence": "STRONG DIVERGENCE",
    fade: "FADE",
  };
  return map[state];
}

export function tradeBiasDisplayRu(bias: QuadHedgeTradeBias): string {
  const map: Record<QuadHedgeTradeBias, string> = {
    wait: "ждать",
    watch: "наблюдение",
    "mean-reversion": "mean reversion",
    "sync-move": "синхронное движение",
    "fade-watch": "схлопывание",
  };
  return map[bias];
}

export type SignalStateTone = "cyan" | "emerald" | "rose" | "amber" | "violet" | "slate";

export function signalStateTone(state: QuadHedgeSignalState): SignalStateTone {
  switch (state) {
    case "sync":
      return "emerald";
    case "watch":
      return "amber";
    case "divergence":
      return "violet";
    case "strong-divergence":
      return "rose";
    case "fade":
      return "cyan";
    default:
      return "slate";
  }
}

export function tradeBiasTone(bias: QuadHedgeTradeBias): SignalStateTone {
  if (bias === "mean-reversion") return "violet";
  if (bias === "watch" || bias === "fade-watch") return "amber";
  if (bias === "sync-move") return "emerald";
  return "slate";
}

export type QuadHedgeDataQualityDisplay =
  | "ok"
  | "partial"
  | "no-cn"
  | "no-eu"
  | "no-si"
  | "low-points"
  | "stale"
  | "no-data";

export type QuadHedgeDataQualityUi = {
  key: QuadHedgeDataQualityDisplay;
  label: string;
  tone: SignalStateTone;
};

export function resolveDataQualityDisplay(quality: QuadHedgeDataQuality): QuadHedgeDataQualityUi {
  const leg = (id: string) => quality.legs.find((l) => l.legId === id);

  if (quality.missingLegs.includes("SI")) {
    return { key: "no-si", label: "нет SI", tone: "rose" };
  }
  if (quality.missingLegs.includes("CN")) {
    return { key: "no-cn", label: "нет CN", tone: "rose" };
  }

  const si = leg("SI");
  const cn = leg("CN");
  if (si?.status === "insufficient" || cn?.status === "insufficient") {
    return { key: "low-points", label: "мало точек", tone: "amber" };
  }

  if (si?.status === "stale" || cn?.status === "stale") {
    return { key: "stale", label: "устарело", tone: "amber" };
  }

  if (!quality.canComputeSignals) {
    return { key: "no-data", label: "наблюдение", tone: "amber" };
  }

  if (quality.missingLegs.includes("EU")) {
    return { key: "no-eu", label: "нет EU", tone: "cyan" };
  }

  if (quality.primaryLegsOk < 3) {
    return { key: "partial", label: `${quality.primaryLegsOk}/3 ног`, tone: "cyan" };
  }

  return { key: "ok", label: "ok", tone: "emerald" };
}

export function resolveHistoryStatusDisplay(
  history: QuadHedgeHistoryMeta | undefined,
): { label: string; tone: SignalStateTone } {
  if (!history) return { label: "—", tone: "slate" };

  switch (history.status) {
    case "LIVE":
      return { label: "LIVE", tone: "emerald" };
    case "HIST":
      return { label: "HIST", tone: "cyan" };
    case "WEEK":
      return { label: "WEEK", tone: "violet" };
    case "PARTIAL_HISTORY":
      return { label: "PARTIAL", tone: "amber" };
    case "NO_HISTORY":
      return { label: "NO HISTORY", tone: "rose" };
    default:
      return { label: history.label, tone: "slate" };
  }
}

export function resolveConfidence(score: number | null): { label: string; tone: SignalStateTone } {
  if (score == null) return { label: "—", tone: "slate" };
  if (score >= 70) return { label: "высокая", tone: "rose" };
  if (score >= 40) return { label: "средняя", tone: "violet" };
  return { label: "низкая", tone: "slate" };
}

export function resolveDivergingLegLabel(analytics: QuadHedgeAnalyticsResult): string {
  const leader = analytics.deviations
    .filter((d) => d.current != null)
    .sort((a, b) => Math.abs(b.current ?? 0) - Math.abs(a.current ?? 0))[0];
  if (!leader?.current) return "—";
  return `${leader.legId} ${leader.current >= 0 ? "+" : ""}${leader.current.toFixed(2)}pp`;
}
