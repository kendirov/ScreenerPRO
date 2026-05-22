"use client";

import type { CurrencyChartMode } from "@/lib/domain/currency-correlation-chart-model";
import {
  DAILY_CHART_MODES,
  INTRADAY_CHART_MODES,
} from "@/lib/domain/currency-correlation-chart-model";
import type { IntradayDayOption, IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import { INTRADAY_INTERVAL_OPTIONS } from "@/lib/domain/currency-correlation-intraday";
import { MODE_LABELS } from "@/components/lab/currency-correlation/currency-correlation-chart";
import type { CurrencyDataMode } from "@/components/lab/currency-correlation/currency-correlation-data-mode";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import {
  LIFECYCLE_SENSITIVITY_LABELS,
  type SpreadLifecycleSensitivity,
} from "@/lib/domain/spread-lifecycle";
import {
  SPREAD_ANCHOR_CONTROL_LABELS,
  SPREAD_ANCHOR_HINT,
  type SpreadAnchorMode,
} from "@/lib/domain/currency-spread-anchor";
import {
  SPREAD_UNIT_MODE_HINT,
  SPREAD_UNIT_MODE_LABELS,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const ANCHOR_MODES: SpreadAnchorMode[] = [
  "period-start",
  "week-open",
  "day-open",
  "manual",
];

export type LabDayPeriod = 5 | 20 | 60;

const PAIR_OPTIONS: { key: PointsPairKey; label: string }[] = [
  { key: "SI/CNY", label: "SI − CNY" },
  { key: "SI/ED", label: "SI − ED" },
  { key: "CNY/ED", label: "CNY − ED" },
];

const SENSITIVITY_OPTIONS: SpreadLifecycleSensitivity[] = ["soft", "standard", "strict"];

function Pill({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? "border-violet-500/40 bg-violet-950/50 text-violet-100"
          : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 w-[4rem] shrink-0 text-[9px] uppercase tracking-[0.12em] text-slate-600">
        {label}
      </span>
      {children}
    </div>
  );
}

export function CurrencyCorrelationLabControls({
  source,
  onSourceChange,
  intradayDays,
  onIntradayDaysChange,
  dayPeriod,
  onDayPeriodChange,
  chartMode,
  onChartModeChange,
  interval,
  onIntervalChange,
  selectedPair,
  onSelectedPairChange,
  sensitivity,
  onSensitivityChange,
  unitMode,
  onUnitModeChange,
  unitWarning,
  anchorMode,
  onAnchorModeChange,
}: {
  source: CurrencyDataMode;
  onSourceChange: (v: CurrencyDataMode) => void;
  intradayDays: IntradayDayOption;
  onIntradayDaysChange: (v: IntradayDayOption) => void;
  dayPeriod: LabDayPeriod;
  onDayPeriodChange: (v: LabDayPeriod) => void;
  chartMode: CurrencyChartMode;
  onChartModeChange: (v: CurrencyChartMode) => void;
  interval: IntradayIntervalOption;
  onIntervalChange: (v: IntradayIntervalOption) => void;
  selectedPair: PointsPairKey;
  onSelectedPairChange: (p: PointsPairKey) => void;
  sensitivity: SpreadLifecycleSensitivity;
  onSensitivityChange: (v: SpreadLifecycleSensitivity) => void;
  unitMode: SpreadUnitMode;
  onUnitModeChange: (v: SpreadUnitMode) => void;
  unitWarning?: string | null;
  anchorMode: SpreadAnchorMode;
  onAnchorModeChange: (v: SpreadAnchorMode) => void;
}) {
  const chartModes = source === "intraday" ? INTRADAY_CHART_MODES : DAILY_CHART_MODES;
  const showIntradayExtras = source === "intraday";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-950/55 px-2.5 py-2 backdrop-blur-xl">
      <div className="space-y-1">
        <ControlRow label="Источник">
          <Pill active={source === "intraday"} onClick={() => onSourceChange("intraday")}>
            Интрадей
          </Pill>
          <Pill active={source === "day"} onClick={() => onSourceChange("day")}>
            День
          </Pill>
        </ControlRow>

        <ControlRow label="Период">
          {showIntradayExtras ? (
            <>
              <Pill active={intradayDays === 1} onClick={() => onIntradayDaysChange(1)}>
                Сегодня
              </Pill>
              <Pill active={intradayDays === 2} onClick={() => onIntradayDaysChange(2)}>
                2д
              </Pill>
              <Pill active={intradayDays === 5} onClick={() => onIntradayDaysChange(5)}>
                5д
              </Pill>
            </>
          ) : (
            ([5, 20, 60] as const).map((d) => (
              <Pill key={d} active={dayPeriod === d} onClick={() => onDayPeriodChange(d)}>
                {d}д
              </Pill>
            ))
          )}
        </ControlRow>

        {showIntradayExtras ? (
          <ControlRow label="Интервал">
            {INTRADAY_INTERVAL_OPTIONS.map((iv) => (
              <Pill key={iv} active={interval === iv} onClick={() => onIntervalChange(iv)}>
                {iv === 60 ? "60м" : `${iv}м`}
              </Pill>
            ))}
          </ControlRow>
        ) : null}

        {showIntradayExtras ? (
          <>
            <ControlRow label="Пара">
              {PAIR_OPTIONS.map((p) => (
                <Pill
                  key={p.key}
                  active={selectedPair === p.key}
                  onClick={() => onSelectedPairChange(p.key)}
                >
                  {p.label}
                </Pill>
              ))}
            </ControlRow>

            <ControlRow label="Единицы">
              {(["raw-points", "normalized-points", "money-value"] as const).map((mode) => (
                <Pill key={mode} active={unitMode === mode} onClick={() => onUnitModeChange(mode)}>
                  {SPREAD_UNIT_MODE_LABELS[mode]}
                </Pill>
              ))}
            </ControlRow>

            <ControlRow label="Точка отсчёта">
              {ANCHOR_MODES.map((mode) => (
                <Pill
                  key={mode}
                  active={anchorMode === mode}
                  disabled={mode === "manual"}
                  onClick={() => onAnchorModeChange(mode)}
                >
                  {mode === "manual"
                    ? `${SPREAD_ANCHOR_CONTROL_LABELS[mode]} (скоро)`
                    : SPREAD_ANCHOR_CONTROL_LABELS[mode]}
                </Pill>
              ))}
            </ControlRow>

            <ControlRow label="График">
              {chartModes.map((m) => (
                <Pill key={m} active={chartMode === m} onClick={() => onChartModeChange(m)}>
                  {MODE_LABELS[m]}
                </Pill>
              ))}
            </ControlRow>

            <ControlRow label="Чувств.">
              {SENSITIVITY_OPTIONS.map((s) => (
                <Pill key={s} active={sensitivity === s} onClick={() => onSensitivityChange(s)}>
                  {LIFECYCLE_SENSITIVITY_LABELS[s]}
                </Pill>
              ))}
            </ControlRow>

            <p className="pl-[4.25rem] text-[9px] leading-snug text-slate-600">
              {SPREAD_ANCHOR_HINT} {SPREAD_UNIT_MODE_HINT}
            </p>
            {unitWarning ? (
              <p className="rounded-md border border-amber-500/20 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200/90">
                {unitWarning}
              </p>
            ) : null}
          </>
        ) : (
          <ControlRow label="График">
            {chartModes.map((m) => (
              <Pill key={m} active={chartMode === m} onClick={() => onChartModeChange(m)}>
                {MODE_LABELS[m]}
              </Pill>
            ))}
          </ControlRow>
        )}
      </div>
    </div>
  );
}
