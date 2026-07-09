"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { formatTimeframeHeader } from "@/lib/strategies/strategy-lab-labels";
import type { StrategyCandlePeriodId } from "@/lib/screener/strategies/strategy-candle-range";
import { formatStrategyPeriodToolbar } from "@/lib/screener/strategies/strategy-candle-range";
import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";

function HeaderActionButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "cyan";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2.5 py-1 font-mono text-[10px] transition-colors",
        tone === "cyan"
          ? "border-cyan-800/45 bg-cyan-950/20 text-cyan-200 hover:border-cyan-700/50"
          : "border-white/[0.08] bg-black/30 text-lab-muted hover:border-white/[0.12] hover:text-lab-text",
      )}
    >
      {label}
    </button>
  );
}

export function StrategyLabHeader({
  ticker,
  timeframe,
  period,
  score,
  status,
  onExportAi,
  onSnapshot,
  onToggleSettings,
  settingsOpen,
}: {
  ticker: string;
  timeframe: StrategyTimeframeMinutes;
  period: StrategyCandlePeriodId;
  score: number;
  status: string;
  onExportAi: () => void;
  onSnapshot: () => void;
  onToggleSettings: () => void;
  settingsOpen: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 pt-0.5">
      <h1 className="min-w-0 font-mono text-sm font-medium tracking-tight text-lab-text">
        Round Levels
        <span className="text-lab-muted">
          {" "}
          · {ticker} · {formatTimeframeHeader(timeframe)} · {formatStrategyPeriodToolbar(period)} · Score{" "}
          {Math.round(score)}/100 · {status}
        </span>
      </h1>
      <div className="flex flex-wrap items-center gap-1.5">
        <HeaderActionButton label="Экспорт AI" onClick={onExportAi} tone="cyan" />
        <HeaderActionButton label="Snapshot" onClick={onSnapshot} />
        <HeaderActionButton
          label={settingsOpen ? "Скрыть настройки" : "Настройки"}
          onClick={onToggleSettings}
        />
      </div>
    </div>
  );
}
