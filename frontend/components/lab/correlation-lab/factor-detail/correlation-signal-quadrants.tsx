"use client";

import type { CorrelationFactorDetailResponse } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  CORRELATION_KIND_LABELS,
  formatSignalLine,
  type CorrelationWindowMode,
} from "@/lib/domain/correlation-factor-detail-display";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

const BLOCKS = [
  { key: "positive", title: "Сильная положительная связь", pick: (d: CorrelationFactorDetailResponse) => d.topPositive },
  { key: "inverse", title: "Сильная обратная связь", pick: (d: CorrelationFactorDetailResponse) => d.topNegative },
  { key: "break", title: "Разрыв связи", pick: (d: CorrelationFactorDetailResponse) => d.brokenLinks },
  { key: "weak", title: "Связи нет", pick: (d: CorrelationFactorDetailResponse) => d.weakLinks },
] as const;

export function CorrelationSignalQuadrants({
  detail,
  windowMode,
  theme,
}: {
  detail: CorrelationFactorDetailResponse;
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {BLOCKS.map((block) => {
        const items = block.pick(detail).slice(0, 5);
        return (
          <LabGlassPanel key={block.key} depth={10} className={cn("p-3", theme.border)}>
            <p className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{block.title}</p>
            {items.length ? (
              <ul className="mt-2 space-y-1.5">
                {items.map((signal) => (
                  <li key={signal.ticker} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-lab-text-main">{signal.ticker}</span>
                    <span className="truncate font-mono text-[10px] text-lab-muted">
                      {formatSignalLine(signal, windowMode).replace(`${signal.ticker} `, "")}
                    </span>
                    <span className={cn("shrink-0 rounded px-1 py-0.5 text-[8px] uppercase", theme.chip)}>
                      {CORRELATION_KIND_LABELS[signal.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-lab-text-dim">—</p>
            )}
          </LabGlassPanel>
        );
      })}
    </div>
  );
}
