"use client";

import type { InstrumentSituation } from "@/lib/screener/situation-engine";
import {
  buildSituationTooltip,
  getSituationSeverityClass,
  getSituationTagShort,
  TAG_DEFAULT_SEVERITY,
} from "@/lib/screener/situation-engine";
import { cn } from "@/lib/utils/cn";

function primarySeverity(situation: InstrumentSituation) {
  const match = situation.reasons.find((reason) => reason.code === situation.primaryTag);
  return match?.severity ?? TAG_DEFAULT_SEVERITY[situation.primaryTag];
}

function extraReasonLabels(situation: InstrumentSituation, limit = 2): string[] {
  return situation.reasons
    .filter((reason) => reason.code !== situation.primaryTag && reason.code !== "quiet")
    .slice(0, limit)
    .map((reason) => {
      const value = reason.value != null ? ` ${reason.value}` : "";
      return `${reason.label}${value}`;
    });
}

export function SituationSetupCell({
  situation,
  showScore = true,
  showMarketRisk = false,
}: {
  situation: InstrumentSituation;
  showScore?: boolean;
  showMarketRisk?: boolean;
}) {
  const severity = primarySeverity(situation);
  const extras = extraReasonLabels(situation, 1);
  const tooltip = buildSituationTooltip(situation);
  const hasSituationRisk = situation.tags.includes("spread_risk");

  if (situation.primaryTag === "quiet" && situation.tags.length === 1 && !showMarketRisk) {
    return (
      <span className="text-[9px] text-lab-text-dim/70" title={tooltip}>
        тихо
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={tooltip}>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center rounded border px-1 py-px font-mono text-[9px] leading-tight",
            getSituationSeverityClass(severity),
          )}
        >
          {getSituationTagShort(situation.primaryTag)}
        </span>
        {showScore && situation.score > 0 ? (
          <span className="font-mono text-[8px] tabular-nums text-lab-text-dim/75">{situation.score}</span>
        ) : null}
        {(hasSituationRisk || showMarketRisk) ? (
          <span className="rounded border border-rose-900/40 bg-rose-950/25 px-1 py-px font-mono text-[8px] text-rose-300/85">
            risk
          </span>
        ) : null}
      </div>
      {extras.length > 0 ? (
        <span className="line-clamp-1 text-[8px] leading-snug text-lab-text-dim/90">{extras.join(" · ")}</span>
      ) : null}
    </div>
  );
}
