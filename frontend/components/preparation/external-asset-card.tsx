"use client";

import type { ExternalAssetQuote, ExternalAssetTag } from "@/lib/preparation/preparation-types";
import { TradingMiniChart } from "@/components/preparation/trading-mini-chart";
import { formatPct, formatRangePct } from "@/lib/screener/formatters";
import { cn } from "@/lib/utils/cn";

const TAG_LABEL: Record<ExternalAssetTag, string> = {
  "1D": "1D",
  "5D": "5D",
  range: "диапазон",
  reversal: "разворот",
};

const GROUP_ACCENT: Record<string, string> = {
  indices: "text-cyan-300/90",
  fx: "text-violet-300/90",
  energy: "text-amber-300/90",
  metals: "text-yellow-200/85",
  soft: "text-orange-200/80",
};

function pctClass(value: number | null): string {
  if (value == null) return "text-lab-text-dim";
  if (value > 0) return "text-emerald-300/90";
  if (value < 0) return "text-rose-300/90";
  return "text-lab-text-dim";
}

function pickTags(tags: ExternalAssetTag[]): ExternalAssetTag[] {
  const priority: ExternalAssetTag[] = ["reversal", "1D", "5D", "range"];
  return priority.filter((t) => tags.includes(t)).slice(0, 2);
}

export function ExternalAssetCard({ asset }: { asset: ExternalAssetQuote }) {
  const displayTags = pickTags(asset.tags);
  const hasChart = asset.series5d.length >= 2;

  if (!hasChart && !asset.critical) return null;

  return (
    <div className="rounded-md border border-white/[0.06] bg-slate-950/40 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight text-lab-text-main">{asset.name}</p>
          <p
            className={cn(
              "mt-0.5 font-mono text-[8px] uppercase tracking-wide",
              GROUP_ACCENT[asset.group] ?? "text-lab-text-dim",
            )}
          >
            {asset.symbol}
          </p>
        </div>
        {displayTags.length ? (
          <div className="flex shrink-0 gap-0.5">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-white/10 px-1 py-0.5 font-mono text-[7px] uppercase tracking-wide text-lab-text-dim"
              >
                {TAG_LABEL[tag]}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mt-1.5 font-mono text-[10px] tabular-nums">
        <span className={pctClass(asset.change1dPct)}>{formatPct(asset.change1dPct, 1)} день</span>
        <span className="text-lab-text-dim"> · </span>
        <span className={pctClass(asset.change5dPct)}>{formatPct(asset.change5dPct, 1)} 5д</span>
      </p>

      <div className="mt-1.5 min-h-[64px]">
        {hasChart ? (
          <TradingMiniChart series={asset.series5d} changePct={asset.change5dPct} height={64} />
        ) : (
          <p className="py-4 text-center font-mono text-[9px] text-lab-text-dim">график недоступен</p>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] tabular-nums text-cyan-200/75">
          диапазон {formatRangePct(asset.range5dPct)}
        </p>
      </div>
    </div>
  );
}
