"use client";

import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyChartModel } from "@/lib/domain/currency-correlation-chart-model";
import { cn } from "@/lib/utils/cn";

const MODE_BADGE: Record<CurrencyChartModel["dataMode"], { label: string; className: string }> = {
  full: {
    label: "Полный режим",
    className: "border-emerald-500/30 bg-emerald-950/30 text-emerald-200/90",
  },
  partial: {
    label: "Частичный режим",
    className: "border-amber-500/30 bg-amber-950/30 text-amber-200/90",
  },
  diagnostic: {
    label: "Диагностика",
    className: "border-slate-600/40 bg-slate-950/50 text-slate-400",
  },
};

const ALL_FAMILIES: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];

export function CurrencyCorrelationModePill({ model }: { model: CurrencyChartModel }) {
  if (model.dataMode === "full") return null;
  const text =
    model.partialModePill ??
    (model.dataMode === "diagnostic" ? "Диагностика: график не построен" : null);
  if (!text) return null;

  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm",
        model.dataMode === "partial"
          ? "border-amber-500/35 bg-amber-950/40 text-amber-100"
          : "border-slate-600/40 bg-slate-900/60 text-slate-400",
      )}
    >
      {text}
    </div>
  );
}

export function CurrencyCorrelationStateCard({ model }: { model: CurrencyChartModel }) {
  const badge = MODE_BADGE[model.dataMode];

  const onChart = model.chartInstruments.map((f) => {
    const meta = CURRENCY_FAMILY_META[f];
    return { family: f, label: meta.label, ticker: model.tickersByFamily[f] ?? "—" };
  });

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-slate-950/55 p-4 backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.35)]",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
            badge.className,
          )}
        >
          {badge.label}
        </span>
        {model.dataMode === "full" ? (
          <span className="text-[10px] text-slate-500">SI + CNY + ED на одном ряду дат</span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StateColumn
          title="На графике"
          items={onChart.map((i) => `${i.family} · ${i.label} (${i.ticker})`)}
          emptyHint="—"
          tone="ok"
        />
        <StateColumn
          title="Исключено"
          items={model.excludedInstruments.map((e) => `${e.family}: ${e.reason}`)}
          emptyHint="ничего"
          tone="warn"
        />
        <StateColumn
          title="Построено"
          items={
            model.canRenderChart
              ? [
                  `${model.chartInstruments.length} линии`,
                  `${model.commonDates} общих точек`,
                  model.basketNote ?? "корзина по доступным",
                ]
              : ["график не построен"]
          }
          emptyHint="—"
          tone="neutral"
        />
      </div>

      {model.dataMode === "diagnostic" ? (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Что проверить</p>
          <ul className="space-y-1.5">
            {model.diagnosticHints.map((hint) => (
              <li key={hint} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                <span className="text-violet-400/60">·</span>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!model.canRenderChart ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          Недостаточно общих дат для графика
        </p>
      ) : null}
    </div>
  );
}

function StateColumn({
  title,
  items,
  emptyHint,
  tone,
}: {
  title: string;
  items: string[];
  emptyHint: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/15 bg-emerald-950/15"
      : tone === "warn"
        ? "border-amber-500/15 bg-amber-950/10"
        : "border-white/[0.05] bg-black/20";

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", toneClass)}>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">{title}</p>
      {items.length ? (
        <ul className="space-y-1 text-[11px] leading-snug text-slate-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-600">{emptyHint}</p>
      )}
    </div>
  );
}

export function CurrencyCorrelationDataModeLabel({ model }: { model: CurrencyChartModel }) {
  const labels: Record<CurrencyCorrelationFamily, string> = {
    SI: "доллар/рубль",
    CNY: "юань/рубль",
    ED: "евро/доллар",
  };
  if (model.dataMode === "full") {
    return (
      <span className="text-[10px] text-emerald-400/80">
        Полный режим: {ALL_FAMILIES.map((f) => labels[f]).join(", ")}
      </span>
    );
  }
  return null;
}
