"use client";

import type { CorrelationPairResponse } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  buildCorrelationPairChartModel,
  type CorrelationLinkMode,
} from "@/lib/domain/correlation-pair-break";
import { formatBetaCompact, formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import { cn } from "@/lib/utils/cn";

const MODE_TONE: Record<CorrelationLinkMode, "live" | "warn" | "amber" | "muted"> = {
  holding: "live",
  weakening: "warn",
  broken: "amber",
  none: "muted",
};

export function CorrelationPairStatsPanel({
  pair,
  theme,
  className,
}: {
  pair: CorrelationPairResponse;
  theme: CorrelationFactorTheme;
  className?: string;
}) {
  const model = buildCorrelationPairChartModel(pair);
  const { stats } = pair;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-lab-dim">Текущая связь</p>
        <StatusChip
          label={model.linkModeLabel}
          tone={MODE_TONE[model.linkMode]}
          className="mt-1.5 text-[10px] uppercase"
        />
      </div>

      <dl className="space-y-2 text-[11px]">
        <StatRow label="corr20" value={formatCorrelationCompact(stats.corr20)} />
        <StatRow label="corr60" value={formatCorrelationCompact(stats.corr60)} />
        <StatRow label="beta60" value={formatBetaCompact(stats.beta60)} />
        <StatRow label="breakScore" value={formatBetaCompact(stats.breakScore)} />
      </dl>

      {model.breakZones.length ? (
        <div className="rounded-lg border border-lab-amber/25 bg-lab-amber/5 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-lab-amber">Разрыв связи</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-lab-muted">
            {model.breakZones.slice(-2).map((z, i) => (
              <li key={i}>· {z.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] leading-snug text-lab-muted">{model.explanation}</p>

      {pair.meta.proxyTicker ? (
        <p className="font-mono text-[9px] text-lab-text-dim">прокси {pair.meta.proxyTicker}</p>
      ) : null}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-lab-border-soft/20 pb-1.5">
      <dt className="text-lab-text-dim">{label}</dt>
      <dd className="font-mono tabular-nums text-lab-text-main">{value}</dd>
    </div>
  );
}
