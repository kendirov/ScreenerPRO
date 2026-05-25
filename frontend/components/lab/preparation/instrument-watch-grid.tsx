"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { Activity, TrendingUp } from "lucide-react";
import {
  RealSparkline,
  hasRealSparklineHistory,
  inferToneFromChange,
} from "@/components/screener/mini-sparkline";
import { LabEmptyState, LabLoadingState, LabSectionHeading } from "@/components/lab/lab-ui";
import { formatFocusReasonTags, selectInPlayStocks, selectStrongMovement } from "@/lib/domain/screener-overview";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

export function InstrumentWatchGrid({
  mode,
  rows,
  hasLiveData,
  isLoading,
  sparklineByTicker,
  sparklinesLoading,
  className,
}: {
  mode: BriefingMode;
  rows: ScreenerRow[];
  hasLiveData: boolean;
  isLoading?: boolean;
  sparklineByTicker: Map<string, number[] | null>;
  sparklinesLoading?: boolean;
  className?: string;
}) {
  const instruments =
    mode === "day"
      ? selectInPlayStocks(rows, 6)
      : selectStrongMovement(rows, 8);

  const title = mode === "day" ? "Инструменты в игре" : "Инструменты за 5 торговых дней";
  const subtitle =
    mode === "day"
      ? "In-play и активность — что смотреть на открытии."
      : "Сильное движение и оборот за окно 5 дней (история — если есть ingest).";

  if (isLoading) {
    return (
      <section className={cn("lab-glass-panel p-3", className)}>
        <LabLoadingState message="Загрузка инструментов из скринера…" />
      </section>
    );
  }

  if (!hasLiveData) {
    return (
      <section className={cn("lab-glass-panel p-3", className)}>
        <LabSectionHeading className="mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-lab-green" />
          {title}
        </LabSectionHeading>
        <LabEmptyState
          message="Живые данные MOEX недоступны. Подключите MOEX ISS или повторите позже — фейковые котировки не показываем."
          className="min-h-[220px] py-8"
        />
      </section>
    );
  }

  if (instruments.length === 0) {
    return (
      <section className={cn("lab-glass-panel p-3", className)}>
        <LabSectionHeading className="mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-lab-green" />
          {title}
        </LabSectionHeading>
        <LabEmptyState
          message="В текущем срезе скринера нет инструментов для этого режима."
          className="min-h-[220px] py-8"
        />
      </section>
    );
  }

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <div className="relative mb-3">
        <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-green/90">
          <TrendingUp className="h-3.5 w-3.5" />
          {title}
        </LabSectionHeading>
        <p className="text-[11px] text-lab-muted">{subtitle}</p>
        {sparklinesLoading ? (
          <p className="mt-1 font-mono text-[9px] text-lab-dim">история 5д · загрузка…</p>
        ) : (
          <p className="mt-1 font-mono text-[9px] text-lab-dim">
            графики 5д · только реальная история (Prisma ingest)
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {instruments.map((row) => (
          <InstrumentWatchCard
            key={row.ticker}
            row={row}
            mode={mode}
            sparkline={sparklineByTicker.get(row.ticker) ?? null}
          />
        ))}
      </div>
    </section>
  );
}

function InstrumentWatchCard({
  row,
  mode,
  sparkline,
}: {
  row: ScreenerRow;
  mode: BriefingMode;
  sparkline: number[] | null;
}) {
  const tags = formatFocusReasonTags(row);
  const change = row.percentChange;
  const changeTone =
    (change ?? 0) > 0 ? "text-lab-green" : (change ?? 0) < 0 ? "text-lab-red" : "text-lab-muted";
  const hasHistory = hasRealSparklineHistory(sparkline);
  const tone = inferToneFromChange(change);

  return (
    <Link
      href={row.assetClass === "future" ? `/futures/${row.ticker}` : `/stocks/${row.ticker}`}
      className="lab-glass-card group relative overflow-hidden border border-lab-border/80 px-3 py-2.5 transition hover:border-lab-green/30 hover:shadow-[var(--lab-glow-green)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-lab-text group-hover:text-lab-cyan">
            {row.ticker}
          </p>
          <p className="line-clamp-1 text-[11px] text-lab-muted">{row.shortName}</p>
        </div>
        <span className={cn("font-mono text-xs tabular-nums", changeTone)}>
          {change !== null && change !== undefined
            ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
            : "—"}
        </span>
      </div>

      <div className="mt-2 h-10">
        {hasHistory ? (
          <RealSparkline variant="inline" values={sparkline} tone={tone} className="h-full w-full" />
        ) : (
          <p className="flex h-full items-center text-[10px] text-lab-dim">история 5д: нет</p>
        )}
      </div>

      {mode === "week" && row.metrics.dayRangePct !== null ? (
        <p className="mt-1 font-mono text-[10px] text-lab-dim">
          диапазон дня {row.metrics.dayRangePct.toFixed(1)}%
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="lab-status-chip px-1.5 py-px text-[9px]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
