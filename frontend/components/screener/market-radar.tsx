"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { parseInPlayReasonTags } from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

interface RadarBucket {
  title: string;
  subtitle: string;
  tone: "money" | "inplay" | "noise";
  rows: ScreenerRow[];
  emptyText: string;
  showReasonTags?: boolean;
  showTurnover?: boolean;
  variant?: "default" | "movement";
}

function bucketToneClasses(tone: RadarBucket["tone"]) {
  if (tone === "money") {
    return {
      title: "text-emerald-100",
      dot: "bg-emerald-300/80 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
      rank: "text-emerald-300/70",
    };
  }
  if (tone === "inplay") {
    return {
      title: "text-cyan-100",
      dot: "bg-cyan-300/80 shadow-[0_0_14px_rgba(34,211,238,0.5)]",
      rank: "text-cyan-300/70",
    };
  }
  return {
    title: "text-amber-100",
    dot: "bg-amber-300/80 shadow-[0_0_14px_rgba(251,191,36,0.48)]",
    rank: "text-amber-300/70",
  };
}

function formatTurnoverCompact(value: number | null): string {
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-emerald-300";
  if ((value ?? 0) < 0) return "text-rose-300";
  return "text-slate-400";
}

function RadarRankRow({
  rank,
  row,
  tone,
  showReasonTags,
  showTurnover,
  variant = "default",
}: {
  rank: number;
  row: ScreenerRow;
  tone: RadarBucket["tone"];
  showReasonTags?: boolean;
  showTurnover?: boolean;
  variant?: "default" | "movement";
}) {
  const toneClasses = bucketToneClasses(tone);
  const reasonTags = showReasonTags ? parseInPlayReasonTags(row) : [];
  const dayRange = row.metrics.dayRangePct;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5">
      <span className={`w-5 shrink-0 font-mono text-[10px] tabular-nums ${toneClasses.rank}`}>#{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tracking-wide text-slate-100">{row.ticker}</span>
          {variant === "default" && !showTurnover ? (
            <span className={`ml-auto font-mono text-[11px] tabular-nums ${percentClass(row.percentChange)}`}>
              {tradingFormat.formatSignedPercent(row.percentChange)}
            </span>
          ) : null}
          {showTurnover ? (
            <span className="ml-auto truncate font-mono text-[10px] tabular-nums text-slate-500">{formatTurnoverCompact(row.turnover)}</span>
          ) : null}
        </div>
        {variant === "movement" ? (
          <div className="mt-0.5 space-y-0.5">
            <p className={`font-mono text-[10px] tabular-nums ${percentClass(row.percentChange)}`}>
              {tradingFormat.formatDeltaPercent(row.percentChange)}
            </p>
            {dayRange !== null ? (
              <p className="font-mono text-[10px] tabular-nums text-slate-500">ход {tradingFormat.formatDayRangeMagnitude(dayRange)}</p>
            ) : null}
          </div>
        ) : null}
        {showReasonTags && reasonTags.length ? (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {reasonTags.map((tag) => (
              <span key={tag} className="rounded border border-white/8 bg-white/[0.03] px-1 py-0 text-[9px] uppercase tracking-wide text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RadarCard({ bucket }: { bucket: RadarBucket }) {
  const toneClasses = bucketToneClasses(bucket.tone);
  return (
    <section className="rounded-xl border border-white/5 bg-slate-900/40 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_26px_rgba(2,6,23,0.3)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-[11px] font-medium uppercase tracking-[0.14em] ${toneClasses.title}`}>{bucket.title}</p>
          <p className="truncate text-[10px] tracking-wide text-slate-500">{bucket.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-slate-500">{bucket.rows.length}</span>
          <span className={`mt-1 h-1.5 w-1.5 rounded-full ${toneClasses.dot}`} />
        </div>
      </div>
      {bucket.rows.length ? (
        <div className="space-y-1">
          {bucket.rows.map((row, index) => (
            <RadarRankRow
              key={`${bucket.title}-${row.ticker}`}
              rank={index + 1}
              row={row}
              tone={bucket.tone}
              showReasonTags={bucket.showReasonTags}
              showTurnover={bucket.showTurnover}
              variant={bucket.variant}
            />
          ))}
        </div>
      ) : (
        <p className="py-1 text-[11px] text-slate-500">{bucket.emptyText}</p>
      )}
    </section>
  );
}

export function MarketRadar({
  rows,
  allRows,
}: {
  rows: ScreenerRow[];
  allRows?: ScreenerRow[];
  imoexRangePct?: number | null;
}) {
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const stockUniverse = (allRows ?? rows).filter((row) => row.assetClass === "stock");

  const liquidity = [...stockUniverse]
    .sort((a, b) => {
      const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
      if (turnoverDiff !== 0) return turnoverDiff;
      return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    })
    .slice(0, 5);

  const inPlay = stockRows
    .filter((row) => (row.metrics.inPlayTags ?? []).includes("IN_PLAY"))
    .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0))
    .slice(0, 5);

  const movement = [...stockRows]
    .sort((a, b) => {
      const rangeDiff = Math.abs(b.metrics.dayRangePct ?? 0) - Math.abs(a.metrics.dayRangePct ?? 0);
      if (rangeDiff !== 0) return rangeDiff;
      return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
    })
    .slice(0, 5);

  const buckets: RadarBucket[] = [
    {
      title: "Ликвидность",
      subtitle: "Топ-5 по обороту",
      tone: "money",
      rows: liquidity,
      emptyText: "Нет данных.",
      showTurnover: true,
    },
    {
      title: "В игре",
      subtitle: "Активные лидеры",
      tone: "inplay",
      rows: inPlay,
      emptyText: "Явного лидера нет",
      showReasonTags: true,
    },
    {
      title: "Движение",
      subtitle: "Импульс и диапазон",
      tone: "noise",
      rows: movement,
      emptyText: "Нет выраженного движения.",
      variant: "movement",
    },
  ];

  return (
    <section className="space-y-2 rounded-xl border border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.66))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_32px_rgba(2,6,23,0.32)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Радар рынка</p>
        <p className="font-mono text-[10px] tabular-nums text-slate-500">{stockRows.length} тик.</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <RadarCard key={bucket.title} bucket={bucket} />
        ))}
      </div>
    </section>
  );
}
