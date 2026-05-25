"use client";

import type { CorrelationSignal } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import { corrHeatColor, type CorrelationWindowMode } from "@/lib/domain/correlation-factor-detail-display";
import { formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { cn } from "@/lib/utils/cn";

export function CorrelationCorrHeatmap({
  signals,
  windowMode,
  theme,
  selectedTicker,
  onSelectTicker,
}: {
  signals: CorrelationSignal[];
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}) {
  const rows = signals.slice(0, 24);

  if (!rows.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-lab-border-soft/50 text-sm text-lab-muted">
        Нет данных для теплокарты
      </div>
    );
  }

  const windows = [20, 60, 120] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-[11px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-lab-text-dim">
            <th className="pb-2 pr-2 text-left font-medium">Тикер</th>
            {windows.map((w) => (
              <th
                key={w}
                className={cn(
                  "pb-2 px-1 text-center font-medium",
                  windowMode === w && theme.accent,
                )}
              >
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((signal) => (
            <tr
              key={signal.ticker}
              className={cn(
                "cursor-pointer border-t border-lab-border-soft/20 transition hover:bg-white/[0.02]",
                selectedTicker === signal.ticker && "bg-lab-cyan/[0.04]",
              )}
              onClick={() => onSelectTicker(signal.ticker)}
            >
              <td className={cn("py-1.5 pr-2 font-semibold", theme.accent)}>{signal.ticker}</td>
              {windows.map((w) => {
                const val = w === 20 ? signal.corr20 : w === 60 ? signal.corr60 : signal.corr120;
                return (
                  <td key={w} className="p-1">
                    <div
                      className="rounded px-1 py-1 text-center font-mono tabular-nums"
                      style={{ backgroundColor: corrHeatColor(val) }}
                      title={val != null ? formatCorrelationCompact(val) : "недостаточно истории"}
                    >
                      {formatCorrelationCompact(val)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[10px] text-lab-text-dim">
        Тикеры × окна corr · подсветка колонки = выбранное окно
      </p>
    </div>
  );
}
