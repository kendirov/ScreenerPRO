"use client";

import * as React from "react";
import Link from "next/link";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  formatBetaCompact,
  formatCorrelationCompact,
  type CorrelationFactorCardData,
  type CorrelationFactorId,
} from "@/lib/domain/correlation-lab";
import { cn } from "@/lib/utils/cn";

const LINK_KIND_LABEL = {
  strong: "сильная",
  inverse: "обратная",
  break: "разрыв",
  neutral: "нейтр.",
} as const;

export function CorrelationOverviewPanel({
  themes,
  selectedFactor,
  stockCount,
  alignedDays,
  className,
}: {
  themes: string[];
  selectedFactor: CorrelationFactorCardData | null;
  stockCount: number;
  alignedDays: number | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <LabGlassPanel depth={20} className="p-4">
        <LabSectionHeading className="mb-2">Темы для брифинга</LabSectionHeading>
        <ul className="space-y-1.5">
          {themes.map((theme) => (
            <li key={theme} className="flex gap-2 text-sm leading-snug text-lab-text-main">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lab-cyan/70" aria-hidden />
              {theme}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-[10px] text-lab-text-dim">
          {stockCount > 0 ? `${stockCount} бумаг` : "нет бумаг"}
          {alignedDays ? ` · ${alignedDays} дн. истории` : null}
        </p>
      </LabGlassPanel>

      {selectedFactor ? (
        <LabGlassPanel depth={20} className="p-4">
          <LabSectionHeading className="mb-1">{selectedFactor.title} · детали</LabSectionHeading>
          <p className="mb-3 text-[11px] text-lab-text-dim">
            {selectedFactor.proxyLabel ? `Прокси: ${selectedFactor.proxyLabel}` : selectedFactor.meaning}
          </p>

          {selectedFactor.instruments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-lab-border-soft/30 text-[10px] uppercase tracking-wide text-lab-text-dim">
                    <th className="pb-1.5 pr-2 font-medium">Тикер</th>
                    <th className="pb-1.5 pr-2 text-right font-medium">corr20</th>
                    <th className="pb-1.5 pr-2 text-right font-medium">corr60</th>
                    <th className="pb-1.5 pr-2 text-right font-medium">beta</th>
                    <th className="pb-1.5 text-right font-medium">разрыв</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFactor.instruments.map((row) => (
                    <tr key={row.ticker} className="border-b border-lab-border-soft/15">
                      <td className="py-1.5 pr-2">
                        <Link href={`/stocks/${encodeURIComponent(row.ticker)}`} className="font-semibold text-lab-cyan hover:underline">
                          {row.ticker}
                        </Link>
                        <span className="ml-1.5 text-[9px] uppercase text-lab-text-dim">
                          {LINK_KIND_LABEL[row.linkKind]}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatCorrelationCompact(row.corr20)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatCorrelationCompact(row.corr60)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatBetaCompact(row.beta)}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{formatBetaCompact(row.breakScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-lab-border-soft/50 px-3 py-4 text-center text-sm text-lab-text-dim">
              Недостаточно пересекающейся истории — нужны свечи MOEX ISS
            </p>
          )}
        </LabGlassPanel>
      ) : (
        <LabGlassPanel depth={10} className="px-4 py-6 text-center">
          <p className="text-sm text-lab-text-dim">Выберите фактор и нажмите «Открыть» — здесь появятся corr20, corr60, beta и разрывы</p>
        </LabGlassPanel>
      )}
    </div>
  );
}
