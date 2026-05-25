import type {
  CorrelationApiFactorId,
  CorrelationDataStatus,
  CorrelationFactorSummary,
  CorrelationOverviewResponse,
} from "@/lib/domain/correlation-api";

export type CorrelationFactorTheme = {
  id: CorrelationApiFactorId;
  accent: string;
  stroke: string;
  border: string;
  bg: string;
  glow: string;
  line: string;
  chip: string;
};

export const CORRELATION_FACTOR_THEMES: Record<CorrelationApiFactorId, CorrelationFactorTheme> = {
  index: {
    id: "index",
    accent: "text-lab-cyan",
    stroke: "#22d3ee",
    border: "border-lab-cyan/35",
    bg: "bg-lab-cyan/[0.06]",
    glow: "shadow-[var(--lab-glow-cyan)]",
    line: "from-lab-cyan/80 via-lab-cyan/25 to-transparent",
    chip: "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan",
  },
  ruble: {
    id: "ruble",
    accent: "text-lab-violet",
    stroke: "#8b5cf6",
    border: "border-lab-violet/35",
    bg: "bg-lab-violet/[0.06]",
    glow: "shadow-[var(--lab-glow-violet)]",
    line: "from-lab-violet/80 via-lab-violet/25 to-transparent",
    chip: "border-lab-violet/30 bg-lab-violet/10 text-lab-violet",
  },
  oil: {
    id: "oil",
    accent: "text-lab-amber",
    stroke: "#f59e0b",
    border: "border-lab-amber/35",
    bg: "bg-lab-amber/[0.06]",
    glow: "shadow-[var(--lab-glow-amber)]",
    line: "from-lab-amber/80 via-lab-amber/25 to-transparent",
    chip: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
  },
  gold: {
    id: "gold",
    accent: "text-[#eab308]",
    stroke: "#eab308",
    border: "border-[#eab308]/35",
    bg: "bg-[#eab308]/[0.06]",
    glow: "shadow-[0_0_18px_rgba(234,179,8,0.28)]",
    line: "from-[#eab308]/80 via-[#eab308]/25 to-transparent",
    chip: "border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]",
  },
  us: {
    id: "us",
    accent: "text-lab-blue",
    stroke: "#3b82f6",
    border: "border-lab-blue/35",
    bg: "bg-lab-blue/[0.06]",
    glow: "shadow-[0_0_18px_rgba(59,130,246,0.28)]",
    line: "from-lab-blue/80 via-lab-blue/25 to-transparent",
    chip: "border-lab-blue/30 bg-lab-blue/10 text-lab-blue",
  },
  sector: {
    id: "sector",
    accent: "text-lab-green",
    stroke: "#22c55e",
    border: "border-lab-green/35",
    bg: "bg-lab-green/[0.06]",
    glow: "shadow-[var(--lab-glow-green)]",
    line: "from-lab-green/80 via-lab-green/25 to-transparent",
    chip: "border-lab-green/30 bg-lab-green/10 text-lab-green",
  },
};

export const CORRELATION_DATA_STATUS_UI: Record<
  CorrelationDataStatus,
  { label: string; tone: "live" | "warn" | "muted" }
> = {
  live: { label: "данные есть", tone: "live" },
  partial: { label: "частично", tone: "warn" },
  "no-history": { label: "история недостаточна", tone: "muted" },
  "no-proxy": { label: "прокси недоступен", tone: "warn" },
};

const PROXY_SHORT: Record<CorrelationApiFactorId, string> = {
  index: "IMOEX2",
  ruble: "Si",
  oil: "Brent",
  gold: "Gold",
  us: "S&P",
  sector: "сектор",
};

export function formatFactorProxyLine(factor: CorrelationFactorSummary): string {
  if (factor.id === "sector") return "секторные корзины";
  const short = PROXY_SHORT[factor.id];
  if (factor.proxyTicker) return `${short} / ${factor.proxyTicker}`;
  return short;
}

export function formatFactorMetricsLine(factor: CorrelationFactorSummary): string {
  const parts: string[] = [];
  if (factor.strongCount > 0) parts.push(`+${factor.strongCount} связей`);
  if (factor.inverseCount > 0) parts.push(`−${factor.inverseCount} обратных`);
  if (factor.breakCount > 0) parts.push(`${factor.breakCount} разрыва`);
  if (!parts.length) return "связей не выделено";
  return parts.join(" · ");
}

export function pickTopTickers(factor: CorrelationFactorSummary): string[] {
  const out: string[] = [];
  for (const t of [...factor.strongSamples, ...factor.breakSamples, ...factor.inverseSamples]) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= 2) break;
  }
  return out;
}

export function hasFactorData(status: CorrelationDataStatus): boolean {
  return status === "live" || status === "partial";
}

export function isOverviewEmpty(overview: CorrelationOverviewResponse): boolean {
  if (overview.instrumentsAnalyzed <= 0) return true;
  return overview.factors.every((f) => !hasFactorData(f.dataStatus));
}

export function buildOverviewKpis(overview: CorrelationOverviewResponse) {
  const activeFactors = overview.factors.filter((f) => hasFactorData(f.dataStatus)).length;
  const strongLinks = overview.factors.reduce((s, f) => s + f.strongCount, 0);
  const breaks = overview.factors.reduce((s, f) => s + f.breakCount, 0);
  return {
    activeFactors,
    instrumentsAnalyzed: overview.instrumentsAnalyzed,
    strongLinks,
    breaks,
  };
}

export function formatCorrelationWindow(overview: CorrelationOverviewResponse): string {
  const intervalLabel = overview.interval >= 24 ? "дневные" : `${overview.interval}м`;
  return `${overview.period}д · ${intervalLabel} · доходности`;
}

export function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
