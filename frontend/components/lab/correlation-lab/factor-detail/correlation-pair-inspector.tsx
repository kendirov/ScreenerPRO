"use client";

import Link from "next/link";
import { ExternalLink, Loader2, X } from "lucide-react";
import { CorrelationPairChart } from "@/components/lab/correlation-lab/correlation-pair-chart";
import { CorrelationPairStatsPanel } from "@/components/lab/correlation-lab/correlation-pair-stats-panel";
import type { CorrelationApiFactorId, CorrelationApiInterval, CorrelationApiPeriod } from "@/lib/domain/correlation-api";
import { CORRELATION_API_FACTORS } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import { useCorrelationPair } from "@/lib/hooks/use-correlation-lab";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

export function CorrelationPairInspector({
  factorId,
  stock,
  period,
  interval,
  theme,
  onClose,
}: {
  factorId: CorrelationApiFactorId;
  stock: string;
  period: CorrelationApiPeriod;
  interval: CorrelationApiInterval;
  theme: CorrelationFactorTheme;
  onClose: () => void;
}) {
  const pairQuery = useCorrelationPair(stock, factorId, period, interval);
  const pair = pairQuery.data;
  const factorTitle = CORRELATION_API_FACTORS.find((f) => f.id === factorId)?.title ?? factorId;
  const factorLabel = pair?.meta.proxyTicker ? `${factorTitle} · ${pair.meta.proxyTicker}` : factorTitle;

  return (
    <LabGlassPanel depth={20} className={cn("sticky top-4 overflow-hidden p-0 xl:col-span-1", theme.border)}>
      <div className={cn("h-px bg-gradient-to-r opacity-80", theme.line)} aria-hidden />
      <div className="flex items-center justify-between gap-2 border-b border-lab-border-soft/30 px-3 py-2">
        <div>
          <p className={cn("text-sm font-semibold", theme.accent)}>
            {stock} <span className="text-lab-muted">vs</span> {factorTitle}
          </p>
          <p className="font-mono text-[10px] text-lab-text-dim">нормализация от 100 · доходности</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-lab-muted hover:text-lab-text"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        {pairQuery.isLoading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-lab-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаем пару по свечам MOEX…
          </div>
        ) : null}

        {pairQuery.isError ? (
          <p className="py-8 text-center text-sm text-lab-muted">
            {pairQuery.error instanceof Error ? pairQuery.error.message : "Ошибка загрузки"}
          </p>
        ) : null}

        {pair && !pair.normalizedStock.length ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-lab-text">История недостаточна</p>
            <p className="mt-1 text-[11px] text-lab-muted">Нужны свечи фактора и акции — без подстановки данных</p>
          </div>
        ) : null}

        {pair && pair.normalizedStock.length ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(140px,180px)]">
            <CorrelationPairChart
              pair={pair}
              stockLabel={stock}
              factorLabel={factorLabel}
              theme={theme}
            />
            <CorrelationPairStatsPanel pair={pair} theme={theme} />
          </div>
        ) : null}

        <Link
          href={`/stocks/${encodeURIComponent(stock)}`}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] transition",
            theme.chip,
          )}
        >
          Открыть карточку акции
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </LabGlassPanel>
  );
}
