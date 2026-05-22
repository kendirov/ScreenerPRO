"use client";

import * as React from "react";
import {
  CurrencyCorrelationWeeksChart,
  type WeekChartMode,
} from "@/components/lab/currency-correlation/currency-correlation-weeks-chart";
import { LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import {
  ROLLOVER_TODO_NOTE,
  WEEKS_DEFAULT_COUNT,
  type WeeklySpreadSeries,
} from "@/lib/domain/currency-correlation-weeks";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import { useCurrencyCorrelationWeeks } from "@/lib/hooks/use-currency-correlation-weeks";
import { cn } from "@/lib/utils/cn";

export type WeekPanelMode = "off" | "single" | "compare";

const WEEK_OFFSET_OPTIONS = [
  { offset: 0, short: "Текущая" },
  { offset: 1, short: "Прошлая" },
  { offset: 2, short: "2н" },
  { offset: 3, short: "3н" },
  { offset: 4, short: "4н" },
] as const;

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition",
        active
          ? "border-cyan-500/40 bg-cyan-950/45 text-cyan-100"
          : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function DiagnosticsRow({ week }: { week: WeeklySpreadSeries }) {
  const n = week.points.length;
  const note = week.diagnostics.contractNote;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px]">
      <span className="text-slate-400">{week.weekLabel}:</span>
      <span
        className={cn(
          n >= 5 ? "text-emerald-300/85" : n > 0 ? "text-amber-300/85" : "text-slate-600",
        )}
      >
        {n > 0 ? `${n} точек` : "нет данных"}
      </span>
      {note ? <span className="text-amber-200/80">— {note}</span> : null}
    </li>
  );
}

export function CurrencyCorrelationWeeksPanel({
  pair,
  interval,
  anchorMode,
  panelMode,
  onPanelModeChange,
  selectedWeekOffset,
  onSelectedWeekOffsetChange,
  compareWeeksCount = WEEKS_DEFAULT_COUNT,
}: {
  pair: PointsPairKey;
  interval: IntradayIntervalOption;
  anchorMode: SpreadAnchorMode;
  panelMode: WeekPanelMode;
  onPanelModeChange: (m: WeekPanelMode) => void;
  selectedWeekOffset: number;
  onSelectedWeekOffsetChange: (offset: number) => void;
  compareWeeksCount?: number;
}) {
  const weeksToFetch =
    panelMode === "compare"
      ? compareWeeksCount
      : Math.min(5, Math.max(1, selectedWeekOffset + 1));

  const query = useCurrencyCorrelationWeeks(
    pair,
    interval,
    weeksToFetch,
    anchorMode,
    panelMode !== "off",
  );

  const chartMode: WeekChartMode = panelMode === "compare" ? "compare" : "single";

  return (
    <section className="rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2.5 backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Недели</p>
        <p className="text-[9px] text-slate-600">
          MOEX ISS · якорь: открытие недели · до {compareWeeksCount} нед. в сравнении
        </p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {WEEK_OFFSET_OPTIONS.map((opt) => (
          <Pill
            key={opt.offset}
            active={panelMode === "single" && selectedWeekOffset === opt.offset}
            onClick={() => {
              onSelectedWeekOffsetChange(opt.offset);
              onPanelModeChange("single");
            }}
          >
            {opt.short}
          </Pill>
        ))}
        <Pill
          active={panelMode === "compare"}
          onClick={() => onPanelModeChange("compare")}
        >
          Сравнить недели
        </Pill>
        {panelMode !== "off" ? (
          <Pill active={false} onClick={() => onPanelModeChange("off")}>
            Скрыть
          </Pill>
        ) : null}
      </div>

      {panelMode === "off" ? (
        <p className="text-[11px] text-slate-500">
          Выберите неделю или «Сравнить недели», чтобы загрузить историю спреда по календарным
          неделям. Используются текущие контракты из скринера.
        </p>
      ) : query.isLoading ? (
        <LabLoadingState message="Загрузка недельных рядов MOEX ISS…" />
      ) : query.isError ? (
        <LabErrorState
          message={
            query.error instanceof Error ? query.error.message : "Ошибка загрузки недель"
          }
        />
      ) : query.data ? (
        <div className="space-y-2">
          <ul className="flex flex-col gap-0.5 rounded-md border border-white/[0.04] bg-black/20 px-2 py-1.5">
            {query.data.weeks.map((w) => (
              <DiagnosticsRow key={w.weekStart} week={w} />
            ))}
          </ul>

          <CurrencyCorrelationWeeksChart
            weeks={query.data.weeks}
            pairKey={pair}
            mode={chartMode}
            selectedOffset={selectedWeekOffset}
          />

          <p className="text-[9px] leading-snug text-slate-600">
            {query.data.weeks[0]?.usedTickers.length
              ? `Контракты: ${query.data.weeks[0]!.usedTickers.join(" · ")}. `
              : ""}
            {query.data.rolloverTodo}
          </p>
        </div>
      ) : null}
    </section>
  );
}
