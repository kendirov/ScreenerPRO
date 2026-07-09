"use client";

import Link from "next/link";
import type { PriorityInstrument } from "@/lib/screener/market-priority-engine";
import {
  buildInPlaySurfaceLine,
  buildInPlayTooltipLines,
  buildInPlayWhyLine,
  extractRowSurfaceMetrics,
  formatChangePct,
  formatRangePct,
  formatReasonChipShort,
  formatScore,
  formatSpreadPct,
  formatTradesShort,
  formatTurnover,
  pickInPlayBadges,
  pickVolatilityRiskReasons,
  stockDetailHref,
} from "@/lib/screener/market-priority-display";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type RowVariant = "liquidity" | "in-play" | "volatility";

export function PriorityInstrumentRow({
  instrument,
  variant,
  className,
  active,
  onTickerClick,
}: {
  instrument: PriorityInstrument;
  variant: RowVariant;
  className?: string;
  active?: boolean;
  onTickerClick?: (ticker: string) => void;
}) {
  const metrics = extractRowSurfaceMetrics(instrument.row);
  const href = stockDetailHref(instrument.secid);

  const changeClass =
    metrics.changePct == null
      ? "text-zinc-500"
      : metrics.changePct > 0
        ? "text-emerald-400/85"
        : metrics.changePct < 0
          ? "text-rose-400/85"
          : "text-zinc-500";

  function handleClick(e: React.MouseEvent) {
    if (!onTickerClick) return;
    e.preventDefault();
    onTickerClick(instrument.secid);
  }

  if (variant === "liquidity") {
    const spreadLabel =
      metrics.spreadPct != null && Number.isFinite(metrics.spreadPct)
        ? formatSpreadPct(metrics.spreadPct)
        : null;

    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          "flex items-baseline justify-between gap-1 rounded px-0.5 py-0.5 font-mono text-[9px] tabular-nums text-zinc-500 transition hover:bg-zinc-900/40 hover:text-zinc-400",
          active && "bg-zinc-900/50 ring-1 ring-zinc-700/40",
          className,
        )}
      >
        <span className="shrink-0 font-medium text-zinc-400">{instrument.secid}</span>
        <span className="min-w-0 truncate text-right text-zinc-600">{formatTurnover(metrics.turnover)}</span>
        <span className="shrink-0 text-zinc-700">
          {spreadLabel ?? formatTradesShort(metrics.trades)}
        </span>
      </Link>
    );
  }

  if (variant === "in-play") {
    const surfaceLine = buildInPlaySurfaceLine(metrics);
    const badges = pickInPlayBadges(instrument.reasons, instrument.riskReasons, 3);
    const whyLine = buildInPlayWhyLine(instrument.reasons);
    const tooltipLines = buildInPlayTooltipLines(instrument, metrics);

    const card = (
      <div
        className={cn(
          "rounded border border-cyan-900/35 bg-cyan-950/10 px-2 py-1.5 transition hover:border-cyan-700/45 hover:bg-cyan-950/20",
          active && "border-cyan-600/55 bg-cyan-950/25 ring-1 ring-cyan-500/25",
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-semibold tracking-tight text-cyan-200">
              {instrument.secid}
            </span>
            {instrument.shortName ? (
              <span className="ml-1.5 truncate text-[8px] text-cyan-200/45">{instrument.shortName}</span>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-[8px] tabular-nums text-cyan-300/55">
            {formatScore(instrument.inPlayScore)}
          </span>
        </div>
        {surfaceLine ? (
          <p className={cn("mt-0.5 truncate font-mono text-[9px] tabular-nums", changeClass)}>{surfaceLine}</p>
        ) : null}
        {badges.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {badges.map((r) => (
              <StatusChip
                key={r.code}
                label={formatReasonChipShort(r)}
                tone={r.severity === "risk" ? "rose" : "cyan"}
                className="px-1 py-0 text-[8px] leading-tight"
              />
            ))}
          </div>
        ) : null}
        {whyLine ? (
          <p className="mt-0.5 truncate text-[8px] leading-tight text-cyan-200/40">{whyLine}</p>
        ) : null}
      </div>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} className="block" onClick={handleClick}>
            {card}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[14rem] space-y-0.5 p-2 font-mono text-[10px] leading-snug text-lab-text-dim">
          {tooltipLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  const riskReasons = pickVolatilityRiskReasons(instrument.riskReasons, instrument.reasons, 1);
  const rangeLabel = formatRangePct(metrics.rangePct);
  const changeLabel = formatChangePct(metrics.changePct);

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "block rounded border border-transparent px-1 py-1 transition hover:border-amber-900/35 hover:bg-amber-950/10",
        active && "border-amber-700/40 bg-amber-950/15",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-1 font-mono text-[9px] tabular-nums">
        <span className="font-medium text-amber-100/75">{instrument.secid}</span>
        <span className={changeClass}>{changeLabel}</span>
        <span className="text-amber-200/45">{rangeLabel !== "—" ? rangeLabel : ""}</span>
      </div>
      {riskReasons.length > 0 ? (
        <div className="mt-0.5">
          <StatusChip
            label={formatReasonChipShort(riskReasons[0]!)}
            tone="rose"
            className="px-1 py-0 text-[8px] leading-tight"
          />
        </div>
      ) : null}
    </Link>
  );
}
