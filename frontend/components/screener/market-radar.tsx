"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";

interface RadarBucket {
  title: string;
  subtitle: string;
  helperText?: string;
  tone: "money" | "inplay" | "noise";
  rows: ScreenerRow[];
  emptyText: string;
}

function bucketToneClasses(tone: RadarBucket["tone"]) {
  if (tone === "money") {
    return {
      title: "text-emerald-100",
      dot: "bg-emerald-300/80 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
      pill: "border-emerald-300/20 bg-emerald-400/8 text-emerald-100",
    };
  }
  if (tone === "inplay") {
    return {
      title: "text-cyan-100",
      dot: "bg-cyan-300/80 shadow-[0_0_14px_rgba(34,211,238,0.5)]",
      pill: "border-cyan-300/20 bg-cyan-400/8 text-cyan-100",
    };
  }
  return {
    title: "text-amber-100",
    dot: "bg-amber-300/80 shadow-[0_0_14px_rgba(251,191,36,0.48)]",
    pill: "border-amber-300/20 bg-amber-400/8 text-amber-100",
  };
}

function RadarTickerPill({ row, tone }: { row: ScreenerRow; tone: RadarBucket["tone"] }) {
  const tags = row.metrics.inPlayTags ?? [];
  const isInPlay = tags.includes("IN_PLAY");
  const toneClasses = bucketToneClasses(tone);
  const percentClass =
    (row.percentChange ?? 0) > 0 ? "text-emerald-300" : (row.percentChange ?? 0) < 0 ? "text-rose-300" : "text-slate-400";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] backdrop-blur-md transition-all ${
        isInPlay
          ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)_inset,0_0_18px_rgba(16,185,129,0.14)]"
          : toneClasses.pill
      }`}
    >
      <span className="font-semibold tracking-wide text-slate-100">{row.ticker}</span>
      <span className={`font-mono text-[10px] tabular-nums ${percentClass}`}>{tradingFormat.formatSignedPercent(row.percentChange)}</span>
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
          {bucket.helperText ? <p className="truncate text-[10px] tracking-wide text-slate-600">{bucket.helperText}</p> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-slate-500">{bucket.rows.length}</span>
          <span className={`mt-1 h-1.5 w-1.5 rounded-full ${toneClasses.dot}`} />
        </div>
      </div>
      {bucket.rows.length ? (
        <div className="flex min-h-[30px] flex-wrap items-center gap-1.5">
          {bucket.rows.map((row) => (
            <RadarTickerPill key={`${bucket.title}-${row.ticker}`} row={row} tone={bucket.tone} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">{bucket.emptyText}</p>
      )}
    </section>
  );
}

export function MarketRadar({
  rows,
  allRows,
  imoexRangePct,
}: {
  rows: ScreenerRow[];
  allRows?: ScreenerRow[];
  imoexRangePct?: number | null;
}) {
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const stockUniverse = (allRows ?? rows).filter((row) => row.assetClass === "stock");
  const volatileThresholdPct = Math.max(5, ((typeof imoexRangePct === "number" && Number.isFinite(imoexRangePct)) ? imoexRangePct : 0) * 2);
  const leaderTrades = stockUniverse.reduce((max, row) => Math.max(max, row.tradesCount ?? 0), 0);
  const liquidityTradesThreshold = Math.max(leaderTrades * 0.12, 3_000);

  const liquiditySorted = [...stockUniverse].sort((a, b) => {
    const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
    if (turnoverDiff !== 0) return turnoverDiff;
    return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
  });
  const preferredLiquid = liquiditySorted.filter((row) => (row.tradesCount ?? 0) >= liquidityTradesThreshold);
  const liquid: ScreenerRow[] = preferredLiquid.length >= 5
    ? preferredLiquid.slice(0, 5)
    : [
      ...preferredLiquid,
      ...liquiditySorted.filter((row) => !preferredLiquid.includes(row)).slice(0, 5 - preferredLiquid.length),
    ];

  const inPlay = stockRows
    .filter((row) => (row.metrics.inPlayTags ?? []).includes("IN_PLAY"))
    .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0))
    .slice(0, 5);

  const volatileAll = stockUniverse
    .filter((row) => !(row.metrics.inPlayTags ?? []).includes("IN_PLAY"))
    .filter((row) => Math.abs(row.metrics.dayRangePct ?? 0) >= volatileThresholdPct)
    .sort((a, b) => {
      const rangeDiff = Math.abs(b.metrics.dayRangePct ?? 0) - Math.abs(a.metrics.dayRangePct ?? 0);
      if (rangeDiff !== 0) return rangeDiff;
      const changeDiff = Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
      if (changeDiff !== 0) return changeDiff;
      return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    });
  const volatile = volatileAll.slice(0, 8);

  const buckets: RadarBucket[] = [
    {
      title: "Ликвидные",
      subtitle: "Лидеры по обороту",
      tone: "money",
      rows: liquid,
      emptyText: "Нет ликвидных лидеров.",
    },
    {
      title: "В игре",
      subtitle: "Лидеры по In Play score",
      tone: "inplay",
      rows: inPlay,
      emptyText: "Нет данных для ранжирования.",
    },
    {
      title: "Волатильные",
      subtitle: "Не в игре, но двигаются сильнее рынка",
      helperText: ">= 5% и >= 2x IMOEX",
      tone: "noise",
      rows: volatile,
      emptyText: "Нет выраженно волатильных бумаг.",
    },
  ];

  return (
    <section className="space-y-2 rounded-xl border border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.66))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_32px_rgba(2,6,23,0.32)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Market Radar</p>
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
