"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { formatMoscowUpdatedLabel } from "@/lib/domain/trading-calendar";
import {
  resolveConfidence,
  resolveDataQualityDisplay,
  resolveDivergingLegLabel,
  resolveHistoryStatusDisplay,
  signalStateDisplayEn,
  signalStateTone,
  tradeBiasDisplayRu,
  tradeBiasTone,
  type SignalStateTone,
} from "@/lib/domain/quad-hedge/display";
import type { QuadHedgeAnalyticsResult } from "@/lib/domain/quad-hedge";
import { signalStateOutputRu } from "@/lib/domain/quad-hedge/signals";
import { cn } from "@/lib/utils/cn";

const TONE_CHIP: Record<SignalStateTone, string> = {
  cyan: "border-cyan-500/30 bg-cyan-950/35 text-cyan-100/90",
  emerald: "border-emerald-500/30 bg-emerald-950/35 text-emerald-100/90",
  rose: "border-rose-500/35 bg-rose-950/40 text-rose-100/90",
  amber: "border-amber-500/30 bg-amber-950/35 text-amber-100/90",
  violet: "border-violet-500/30 bg-violet-950/35 text-violet-100/90",
  slate: "border-slate-600/35 bg-slate-900/50 text-slate-300/85",
};

const TONE_GLOW: Record<SignalStateTone, string> = {
  cyan: "shadow-[0_0_20px_rgba(34,211,238,0.08)]",
  emerald: "shadow-[0_0_22px_rgba(52,211,153,0.12)]",
  rose: "shadow-[0_0_24px_rgba(251,113,133,0.14)]",
  amber: "shadow-[0_0_20px_rgba(251,191,36,0.1)]",
  violet: "shadow-[0_0_22px_rgba(167,139,250,0.12)]",
  slate: "",
};

function Chip({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone: SignalStateTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.08em]",
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function MetricCell({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: SignalStateTone;
}) {
  return (
    <span className="inline-flex min-w-0 flex-col gap-px">
      <span className="text-[8px] uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums leading-none",
          tone === "violet" && "text-violet-200/95",
          tone === "cyan" && "text-cyan-200/90",
          tone === "emerald" && "text-emerald-200/90",
          tone === "rose" && "text-rose-200/90",
          tone === "amber" && "text-amber-200/90",
          tone === "slate" && "text-slate-200/90",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function LoadingBar() {
  return (
    <LabGlassPanel depth={20} className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-tight text-slate-100">Квадрохедж</p>
          <p className="text-[9px] text-slate-600">SI / EU / CN — торгуемые фьючерсы MOEX</p>
        </div>
        <Chip tone="cyan">загрузка…</Chip>
      </div>
    </LabGlassPanel>
  );
}

function IntradayOffBar() {
  return (
    <LabGlassPanel depth={20} className="px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-[11px] font-semibold tracking-tight text-slate-100">Квадрохедж</p>
          <p className="text-[9px] text-slate-600">SI / EU / CN — торгуемые фьючерсы MOEX</p>
        </div>
        <Chip tone="cyan">режим «День» · сигналы в интрадей</Chip>
      </div>
    </LabGlassPanel>
  );
}

export function QuadHedgeCommandBar({
  analytics,
  isLoading,
  intradayEnabled,
  updatedAt,
  contractMessage,
}: {
  analytics: QuadHedgeAnalyticsResult | null;
  isLoading?: boolean;
  intradayEnabled: boolean;
  updatedAt?: string | null;
  contractMessage?: string | null;
}) {
  if (!intradayEnabled) return <IntradayOffBar />;
  if (isLoading) return <LoadingBar />;
  if (!analytics) {
    return (
      <LabGlassPanel depth={20} className={cn("px-3 py-2.5", TONE_GLOW.cyan)}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-tight text-slate-100">Квадрохедж</p>
            <p className="text-[9px] text-slate-600">SI / EU / CN — торгуемые фьючерсы MOEX</p>
          </div>
          <Chip tone="cyan">NO DATA</Chip>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">Нет интрадей-свечей — сигнал не рассчитывается.</p>
        {contractMessage ? (
          <p className="mt-1 text-[10px] text-amber-300/80">{contractMessage}</p>
        ) : null}
      </LabGlassPanel>
    );
  }

  const stateTone = signalStateTone(analytics.signalState);
  const biasTone = tradeBiasTone(analytics.tradeBias);
  const qualityUi = resolveDataQualityDisplay(analytics.dataQuality);
  const historyUi = resolveHistoryStatusDisplay(analytics.history);
  const diverging = resolveDivergingLegLabel(analytics);
  const confidence = resolveConfidence(analytics.divergenceScore);

  const focusZ = analytics.zScores.find((z) => z.pairKey === analytics.focusPair);
  const focusSpread = analytics.spreads.find((s) => s.pairKey === analytics.focusPair);

  const zVal = focusZ?.current;
  const spreadVal = focusSpread?.current;
  const duration = analytics.stretchDurationBars;

  const timestampRaw = updatedAt ?? analytics.computedAt;
  const timestampLabel = formatMoscowUpdatedLabel(timestampRaw) ?? "—";

  const canTrade =
    analytics.dataQuality.canComputeSignals &&
    analytics.history?.status !== "NO_HISTORY" &&
    analytics.signalState !== "no-data" &&
    analytics.tradeBias !== "wait";

  return (
    <LabGlassPanel
      depth={20}
      className={cn(
        "relative overflow-hidden px-3 py-2.5",
        TONE_GLOW[stateTone],
        analytics.signalState === "strong-divergence" &&
          "border-rose-500/20 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(190,24,93,0.12),transparent)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[11px] font-semibold tracking-tight text-slate-50">Квадрохедж</h2>
            <Chip tone={stateTone}>{signalStateDisplayEn(analytics.signalState)}</Chip>
            <Chip tone={historyUi.tone}>{historyUi.label}</Chip>
          </div>
          <p className="mt-0.5 text-[9px] text-slate-500">{signalStateOutputRu(analytics.signalState)}</p>
          <p className="mt-0.5 text-[9px] italic text-slate-500">{analytics.interpretation}</p>
          {analytics.history?.message ? (
            <p className="mt-0.5 text-[9px] text-slate-500">{analytics.history.message}</p>
          ) : null}
          {contractMessage ? (
            <p className="mt-0.5 text-[9px] text-amber-300/75">{contractMessage}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[9px] tabular-nums text-cyan-400/75">
          {timestampLabel !== "—" ? `обновлено ${timestampLabel}` : "—"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone={biasTone}>{tradeBiasDisplayRu(analytics.tradeBias)}</Chip>
        <span className="text-[10px] text-violet-200/80">{diverging}</span>
        <span className="text-slate-700">·</span>
        <span
          className={cn(
            "text-[9px] font-medium uppercase tracking-wide",
            canTrade ? "text-emerald-400/80" : "text-cyan-400/70",
          )}
        >
          {canTrade ? "можно действовать" : "только наблюдать"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2">
        <MetricCell
          label="Spread"
          value={analytics.focusPair.replace("/", " − ")}
          tone="violet"
        />
        <MetricCell
          label="Значение"
          value={
            spreadVal != null && Number.isFinite(spreadVal)
              ? `${spreadVal >= 0 ? "+" : ""}${spreadVal.toFixed(2)} pp`
              : "—"
          }
          tone="violet"
        />
        <MetricCell
          label="Z-score"
          value={zVal != null && Number.isFinite(zVal) ? zVal.toFixed(2) : "—"}
          tone={
            zVal != null && Math.abs(zVal) >= 2
              ? "rose"
              : zVal != null && Math.abs(zVal) >= 1.5
                ? "violet"
                : "cyan"
          }
        />
        <MetricCell
          label="Duration"
          value={duration > 0 ? `${duration} bars` : "—"}
          tone="amber"
        />
        <MetricCell label="Confidence" value={confidence.label} tone={confidence.tone} />
        <MetricCell label="Data" value={qualityUi.label} tone={qualityUi.tone} />
        <MetricCell label="History" value={historyUi.label} tone={historyUi.tone} />
      </div>
    </LabGlassPanel>
  );
}
