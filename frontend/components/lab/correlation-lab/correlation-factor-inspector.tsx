"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import type { CorrelationApiFactorId, CorrelationFactorSummary } from "@/lib/domain/correlation-api";
import {
  CORRELATION_FACTOR_THEMES,
  formatFactorProxyLine,
  hasFactorData,
} from "@/lib/domain/correlation-api-display";
import { formatBetaCompact, formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { useCorrelationFactorDetail } from "@/lib/hooks/use-correlation-lab";
import { cn } from "@/lib/utils/cn";

const KIND_LABEL = {
  strong: "сильная",
  inverse: "обратная",
  break: "разрыв",
  weak: "слабая",
  neutral: "нейтр.",
} as const;

export function CorrelationFactorInspector({
  factor,
  className,
}: {
  factor: CorrelationFactorSummary | null;
  className?: string;
}) {
  const detailQuery = useCorrelationFactorDetail(factor?.id ?? null);
  const theme = factor ? CORRELATION_FACTOR_THEMES[factor.id] : null;

  if (!factor) {
    return (
      <LabGlassPanel depth={10} className={cn("px-4 py-8 text-center", className)}>
        <p className="text-sm text-lab-muted">
          Выберите фактор и нажмите «Открыть исследование» — здесь появятся corr20, corr60, beta и разрывы
        </p>
      </LabGlassPanel>
    );
  }

  const hasData = hasFactorData(factor.dataStatus);
  const detail = detailQuery.data;
  const rows = detail?.signals.slice(0, 16) ?? [];

  return (
    <LabGlassPanel depth={20} className={cn("overflow-hidden p-0", theme?.border, className)}>
      {theme ? (
        <div className={cn("h-px bg-gradient-to-r opacity-90", theme.line)} aria-hidden />
      ) : null}
      <div className="p-4">
        <LabSectionHeading className="mb-1">
          <span className={theme?.accent}>{factor.title}</span>
          <span className="text-lab-muted"> · исследование</span>
        </LabSectionHeading>
        <p className="mb-3 font-mono text-[11px] text-lab-text-dim">{formatFactorProxyLine(factor)}</p>

        {detailQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-lab-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаем сигналы по свечам MOEX…
          </div>
        ) : null}

        {detailQuery.isError ? (
          <p className="rounded-lg border border-dashed border-lab-border-soft/50 px-3 py-4 text-center text-sm text-lab-muted">
            {detailQuery.error instanceof Error ? detailQuery.error.message : "Не удалось загрузить детали"}
          </p>
        ) : null}

        {!hasData ? (
          <div className="space-y-2 rounded-lg border border-dashed border-lab-border-soft/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-lab-text-main">История недостаточна</p>
            <p className="text-[11px] text-lab-muted">Нужны свечи фактора и акций</p>
          </div>
        ) : null}

        {hasData && !detailQuery.isLoading && rows.length ? (
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
                {rows.map((row) => (
                  <tr key={row.ticker} className="border-b border-lab-border-soft/15">
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/stocks/${encodeURIComponent(row.ticker)}`}
                        className={cn("font-semibold hover:underline", theme?.accent ?? "text-lab-cyan")}
                      >
                        {row.ticker}
                      </Link>
                      <span className="ml-1.5 text-[9px] uppercase text-lab-text-dim">{KIND_LABEL[row.kind]}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatCorrelationCompact(row.corr20)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatCorrelationCompact(row.corr60)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatBetaCompact(row.beta60)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{formatBetaCompact(row.breakScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasData && !detailQuery.isLoading && !rows.length && !detailQuery.isError ? (
          <p className="rounded-lg border border-dashed border-lab-border-soft/50 px-3 py-4 text-center text-sm text-lab-muted">
            Недостаточно пересекающейся истории — нужны свечи MOEX ISS
          </p>
        ) : null}

        {detail?.meta ? (
          <p className="mt-3 font-mono text-[10px] text-lab-text-dim">
            {detail.meta.instrumentsAnalyzed} бумаг · {detail.meta.period} · {detail.meta.interval}
          </p>
        ) : null}
      </div>
    </LabGlassPanel>
  );
}

export type { CorrelationApiFactorId };
