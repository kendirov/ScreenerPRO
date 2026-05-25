"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import type { CorrelationApiFactorId, CorrelationFactorSummary, CorrelationOverviewResponse } from "@/lib/domain/correlation-api";
import {
  CORRELATION_DATA_STATUS_UI,
  CORRELATION_FACTOR_THEMES,
  formatFactorMetricsLine,
  formatFactorProxyLine,
  formatCorrelationWindow,
  formatUpdatedAt,
  hasFactorData,
  pickTopTickers,
} from "@/lib/domain/correlation-api-display";
import { cn } from "@/lib/utils/cn";

export function CorrelationFactorCard({
  factor,
  overview,
  selected,
  onOpen,
  onCheckSource,
}: {
  factor: CorrelationFactorSummary;
  overview: CorrelationOverviewResponse;
  selected?: boolean;
  onOpen: (id: CorrelationApiFactorId) => void;
  onCheckSource?: () => void;
}) {
  const theme = CORRELATION_FACTOR_THEMES[factor.id];
  const statusUi = CORRELATION_DATA_STATUS_UI[factor.dataStatus];
  const hasData = hasFactorData(factor.dataStatus);
  const empty = factor.dataStatus === "no-history" || factor.dataStatus === "no-proxy";
  const topTickers = pickTopTickers(factor);

  return (
    <div className="group relative h-full">
      <LabGlassPanel
        depth={10}
        interactive
        className={cn(
          "relative flex h-full flex-col overflow-hidden p-0 transition duration-300",
          theme.border,
          theme.bg,
          selected ? cn(theme.glow, "ring-1 ring-inset", theme.border) : "hover:brightness-110",
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-90", theme.line)} aria-hidden />
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
            theme.bg.replace("/[0.06]", "/30"),
          )}
          aria-hidden
        />

        <div className="relative flex flex-1 flex-col p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={cn("text-base font-semibold tracking-tight", theme.accent)}>{factor.title}</h3>
              <p className="mt-0.5 font-mono text-[11px] text-lab-text-dim">{formatFactorProxyLine(factor)}</p>
            </div>
            <StatusChip label={statusUi.label} tone={statusUi.tone} className="shrink-0 text-[8px] uppercase" />
          </div>

          {empty ? (
            <div className="mt-4 flex-1 space-y-2">
              <p className="text-sm font-medium text-lab-text-main">История недостаточна</p>
              <p className="text-[11px] leading-snug text-lab-muted">Нужны свечи фактора и акций</p>
              <button
                type="button"
                onClick={onCheckSource}
                className={cn(
                  "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] transition",
                  theme.chip,
                )}
              >
                <Search className="h-3.5 w-3.5" />
                Проверить источник
              </button>
            </div>
          ) : hasData ? (
            <>
              <p className="mt-3 text-[12px] leading-snug text-lab-text-main">{formatFactorMetricsLine(factor)}</p>

              <div className="mt-3">
                <MiniHeatStrip
                  strong={factor.strongCount}
                  inverse={factor.inverseCount}
                  breaks={factor.breakCount}
                  weak={factor.weakCount}
                />
              </div>

              {topTickers.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topTickers.map((ticker) => (
                    <span
                      key={ticker}
                      className={cn("rounded-md border px-2 py-0.5 font-mono text-[10px]", theme.chip)}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[10px] text-lab-text-dim">тикеры появятся после расчёта</p>
              )}

              <Link
                href={`/lab/correlation-lab/${factor.id}`}
                className={cn(
                  "mt-auto inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-[11px] uppercase tracking-wide transition",
                  theme.chip,
                  "hover:brightness-125",
                )}
              >
                Открыть исследование
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <p className="mt-4 flex-1 text-[11px] text-lab-muted">Прокси недоступен в текущей ленте MOEX</p>
          )}
        </div>

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 translate-y-full border-t px-3.5 py-2.5 opacity-0 transition duration-300",
            theme.border,
            "bg-lab-bg-deep/95 backdrop-blur-sm group-hover:translate-y-0 group-hover:opacity-100",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">Подробнее</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-lab-muted">
            <li>
              Проверено:{" "}
              <span className="font-mono text-lab-text-main">{overview.instrumentsAnalyzed || "—"}</span> бумаг
            </li>
            <li>Окно: {formatCorrelationWindow(overview)}</li>
            <li>Обновление: {formatUpdatedAt(overview.updatedAt)}</li>
            {overview.warnings.length ? (
              <li className="text-lab-amber/90">{overview.warnings[0]}</li>
            ) : null}
          </ul>
        </div>
      </LabGlassPanel>
    </div>
  );
}

function MiniHeatStrip({
  strong,
  inverse,
  breaks,
  weak,
}: {
  strong: number;
  inverse: number;
  breaks: number;
  weak: number;
}) {
  const total = strong + inverse + breaks + weak;
  if (total <= 0) {
    return <div className="h-1.5 rounded-full bg-lab-border/40" aria-hidden />;
  }

  const segments = [
    { count: strong, className: "bg-lab-cyan/80" },
    { count: inverse, className: "bg-lab-violet/80" },
    { count: breaks, className: "bg-lab-amber/85" },
    { count: weak, className: "bg-lab-muted/25" },
  ].filter((s) => s.count > 0);

  return (
    <div
      className="flex h-1.5 overflow-hidden rounded-full bg-black/20"
      role="img"
      aria-label={`распределение: ${strong} сильных, ${inverse} обратных, ${breaks} разрывов`}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn("h-full transition-all", seg.className)}
          style={{ width: `${(seg.count / total) * 100}%` }}
        />
      ))}
    </div>
  );
}
