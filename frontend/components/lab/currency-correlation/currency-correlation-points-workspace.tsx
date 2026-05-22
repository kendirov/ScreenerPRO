"use client";

import * as React from "react";
import { CurrencyCorrelationPointsChart } from "@/components/lab/currency-correlation/currency-correlation-points-chart";
import { CurrencyCorrelationSpreadScanner } from "@/components/lab/currency-correlation/currency-correlation-spread-scanner";
import { CurrencyCorrelationSpreadTimeline } from "@/components/lab/currency-correlation/currency-correlation-spread-timeline";
import { CurrencyCorrelationSpreadsPanel } from "@/components/lab/currency-correlation/currency-correlation-spreads-panel";
import { LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import {
  buildCurrencyPointsModel,
  type PointsBetaMode,
  type PointsPairFilter,
} from "@/lib/domain/currency-correlation-points-model";
import {
  buildSpreadScannerModel,
  type SpreadScannerSensitivity,
} from "@/lib/domain/currency-correlation-spread-scanner";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import {
  INTRADAY_DAY_OPTIONS,
  INTRADAY_INTERVAL_OPTIONS,
  type IntradayDayOption,
  type IntradayIntervalOption,
} from "@/lib/domain/currency-correlation-intraday";
import { cn } from "@/lib/utils/cn";

const PAIR_OPTIONS: Array<{ id: PointsPairFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "SI/CNY", label: "SI−CNY" },
  { id: "SI/ED", label: "SI−ED" },
  { id: "CNY/ED", label: "CNY−ED" },
];

const HOW_TO_READ_QUAD = [
  "Линии показывают движение каждого контракта в пунктах от старта периода.",
  "Spread = движение A − движение B при beta 1:1.",
  "Z-score показывает, насколько текущий spread отклонился от своей обычной зоны.",
  "Это лаборатория анализа расхождений, не торговая рекомендация.",
] as const;

function ControlPill({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-cyan-500/40 bg-cyan-950/45 text-cyan-100"
          : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

export function CurrencyCorrelationPointsWorkspace({
  intraday,
  isLoading,
  isError,
  errorMessage,
  interval,
  onIntervalChange,
  days,
  onDaysChange,
}: {
  intraday: IntradayCurrencyResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  interval: IntradayIntervalOption;
  onIntervalChange: (v: IntradayIntervalOption) => void;
  days: IntradayDayOption;
  onDaysChange: (v: IntradayDayOption) => void;
}) {
  const [pairFilter, setPairFilter] = React.useState<PointsPairFilter>("all");
  const [betaMode, setBetaMode] = React.useState<PointsBetaMode>("1:1");
  const [sensitivity, setSensitivity] = React.useState<SpreadScannerSensitivity>("standard");

  const hedgeRatio = betaMode === "1:1" ? 1 : 1;

  const model = React.useMemo(
    () => buildCurrencyPointsModel(intraday, pairFilter, hedgeRatio),
    [intraday, pairFilter, hedgeRatio],
  );

  const scannerModel = React.useMemo(
    () => buildSpreadScannerModel(intraday, sensitivity, hedgeRatio),
    [intraday, sensitivity, hedgeRatio],
  );

  if (isLoading) {
    return <LabLoadingState message="Загрузка интрадей-свечей MOEX ISS для режима «Пункты»…" />;
  }

  if (isError) {
    return <LabErrorState message={errorMessage ?? "Не удалось загрузить интрадей-свечи."} />;
  }

  if (!model) {
    return <LabErrorState message="Интрадей-данные не загружены." />;
  }

  const formatInterval = (n: number) => (n === 60 ? "60м" : `${n}м`);

  return (
    <section className="space-y-4">
      <CurrencyCorrelationSpreadScanner
        model={scannerModel}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
      />

      <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/20 via-slate-950/80 to-violet-950/20 px-4 py-3 backdrop-blur-xl">
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">
          Квадрохедж: пункты и расхождения
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Движение в пунктах от старта периода · 0 = первая общая свеча выбранного периода
        </p>
        {model.intervalNotice ? (
          <p className="mt-2 text-[11px] text-amber-300/90">{model.intervalNotice}</p>
        ) : null}
        {model.partialModePill ? (
          <p className="mt-2 text-[11px] text-amber-200/80">{model.partialModePill}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-slate-950/55 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Интервал
          </span>
          {INTRADAY_INTERVAL_OPTIONS.map((iv) => (
            <ControlPill key={iv} active={interval === iv} onClick={() => onIntervalChange(iv)}>
              {formatInterval(iv)}
            </ControlPill>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Период
          </span>
          {INTRADAY_DAY_OPTIONS.map((d) => (
            <ControlPill key={d} active={days === d} onClick={() => onDaysChange(d)}>
              {d === 1 ? "сегодня" : `${d}д`}
            </ControlPill>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Beta
          </span>
          <ControlPill active={betaMode === "1:1"} onClick={() => setBetaMode("1:1")}>
            1:1
          </ControlPill>
          <ControlPill active={false} onClick={() => {}} disabled title="Скоро">
            авто beta (скоро)
          </ControlPill>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Пары
          </span>
          {PAIR_OPTIONS.map((p) => (
            <ControlPill key={p.id} active={pairFilter === p.id} onClick={() => setPairFilter(p.id)}>
              {p.label}
            </ControlPill>
          ))}
        </div>

        <p className="text-[10px] text-slate-600">
          Фактический интервал MOEX: {formatInterval(model.usedInterval)} · общих свечей:{" "}
          {model.commonTimestamps}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/10 bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(8,51,68,0.25),rgba(2,6,23,0.98))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-500/70">
              Движение в пунктах от старта периода
            </p>
          </div>
          <CurrencyCorrelationPointsChart model={model} />
        </div>

        <CurrencyCorrelationSpreadsPanel spreads={model.spreads} />
      </div>

      <CurrencyCorrelationSpreadTimeline
        events={scannerModel?.recentEvents ?? []}
        zThreshold={scannerModel?.zThreshold ?? 1.5}
      />

      <div className="rounded-xl border border-white/[0.05] bg-slate-900/35 px-4 py-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          Как читать квадрохедж
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {HOW_TO_READ_QUAD.map((text, i) => (
            <li key={text} className="flex gap-2 text-xs leading-relaxed text-slate-500">
              <span className="font-mono text-cyan-400/70">{i + 1}.</span>
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-slate-600">
          Z-score: окно {30} свечей · маркеры: |z| ≥ 1.5 (до 10 самых сильных) · spread = move(A) −
          move(B)
        </p>
      </div>
    </section>
  );
}
