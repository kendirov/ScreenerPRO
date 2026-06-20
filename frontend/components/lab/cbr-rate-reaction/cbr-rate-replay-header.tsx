"use client";

import { StatusChip } from "@/components/ui/metrics-minimalism";
import {
  buildDataIntegrityView,
  instrumentsDataFromChartSlots,
  resolveChartsStatusDisplay,
  resolveRateSourceDisplay,
} from "@/lib/cbr/cbr-data-integrity";
import type { CbrReplayDataQualityResult } from "@/lib/cbr/cbr-replay-data-quality";
import { replayQualityToChartsDisplay } from "@/lib/cbr/cbr-replay-data-quality";
import {
  isUpcomingEvent,
  needsSourceVerification,
  type CbrRateEvent as CanonicalCbrRateEvent,
} from "@/lib/cbr/cbr-rate-events";
import {
  formatRateArrow,
  formatSelectorMeetingDate,
} from "@/lib/cbr/cbr-rate-event-selector";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import {
  formatRatePct,
  formatSurpriseBps,
} from "@/lib/domain/cbr-rate-reaction";
import { surpriseFromEvent } from "@/lib/domain/cbr-rate-replay";
import { cn } from "@/lib/utils/cn";

export function CbrRateReplayHeader({
  event,
  canonicalEvent,
  chartModel,
  loading,
  dataQuality,
}: {
  event: CbrRateEvent;
  canonicalEvent: CanonicalCbrRateEvent;
  chartModel: CbrReactionChartGridModel | null;
  loading?: boolean;
  dataQuality?: CbrReplayDataQualityResult | null;
}) {
  const integrity = buildDataIntegrityView(
    canonicalEvent,
    loading ? [] : instrumentsDataFromChartSlots(chartModel?.slots),
  );
  const surprise = surpriseFromEvent(event);
  const upcoming = isUpcomingEvent(canonicalEvent);
  const needsVerification = needsSourceVerification(canonicalEvent);
  const meetingDate = formatSelectorMeetingDate(event.date);
  const rateSource = resolveRateSourceDisplay(canonicalEvent);
  const chartsStatus = dataQuality
    ? replayQualityToChartsDisplay(dataQuality.quality)
    : resolveChartsStatusDisplay(integrity.chartsBundle);

  return (
    <div
      className={cn(
        "sticky top-0 z-40 -mx-1 border-b border-lab-border/40 bg-lab-bg-deep/95 px-2 py-2.5 backdrop-blur-md sm:-mx-2 sm:px-3",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h1 className="font-mono text-sm font-semibold tracking-tight text-lab-text sm:text-base">
            Ставка ЦБ Replay
          </h1>
          <p className="font-mono text-[11px] tabular-nums text-lab-muted">{meetingDate}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {upcoming ? (
            <StatusChip label="ожидание" tone="amber" className="text-[8px]" />
          ) : null}
          {needsVerification ? (
            <StatusChip label="проверить" tone="amber" className="text-[8px]" />
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderStat
          label="Было → факт"
          value={formatRateArrow(canonicalEvent.previousRate, canonicalEvent.actualRate)}
        />
        <HeaderStat
          label="Ожидание"
          value={canonicalEvent.expectedRate == null ? "—" : formatRatePct(canonicalEvent.expectedRate)}
          muted={canonicalEvent.expectedRate == null}
        />
        <HeaderStat
          label="Surprise"
          value={upcoming ? "—" : formatSurpriseBps(surprise)}
          muted={upcoming || surprise == null}
          highlight={!upcoming && surprise != null}
          toneClass={!upcoming ? surpriseTone(surprise) : undefined}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-lab-dim">
            Статус данных
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-lab-muted">
            <span>
              Ставка:{" "}
              <span className={rateSource === "official" ? "text-emerald-200/90" : "text-amber-100/85"}>
                {rateSource}
              </span>
            </span>
            <span>
              Графики:{" "}
              <span className={chartsStatusTone(chartsStatus)}>{chartsStatus}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  muted,
  highlight,
  toneClass,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  toneClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-lab-dim">{label}</span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          muted && "text-lab-dim",
          !muted && highlight && "font-semibold text-lab-cyan",
          !muted && !highlight && "text-lab-text",
          toneClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function chartsStatusTone(status: string): string {
  if (status === "MOEX") return "text-emerald-200/90";
  if (status === "partial") return "text-violet-200/90";
  return "text-lab-dim";
}

function surpriseTone(bps: number | null): string | undefined {
  if (bps == null) return undefined;
  if (bps <= -12) return "text-cyan-100";
  if (bps >= 12) return "text-rose-100";
  return "text-amber-100";
}
