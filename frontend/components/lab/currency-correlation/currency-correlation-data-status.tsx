"use client";

import type { CurrencyPointsChartModel } from "@/lib/domain/currency-correlation-points-model";
import type { DivergenceMapModel } from "@/lib/domain/currency-correlation-divergence-map";
import {
  buildIntradayLabDiagnostics,
  type IntradayCurrencyResponse,
} from "@/lib/domain/currency-correlation-intraday";
import { cn } from "@/lib/utils/cn";

const PAIR_LABELS = ["SI − CNY", "SI − ED", "CNY − ED"] as const;

export function CurrencyCorrelationDataStatus({
  intraday,
  intradayModel,
  divergenceMapModel,
  className,
}: {
  intraday: IntradayCurrencyResponse | undefined;
  intradayModel: CurrencyPointsChartModel | null | undefined;
  divergenceMapModel: DivergenceMapModel | null | undefined;
  className?: string;
}) {
  if (!intraday) return null;

  const diag = buildIntradayLabDiagnostics(intraday);
  const intervalLabel = `${diag.usedInterval}м`;
  const availablePairs =
    divergenceMapModel?.cards.filter((c) => c.available).map((c) => c.label) ?? [];
  const chartOk = Boolean(intradayModel?.canRenderChart);
  const needsDetail = diag.status !== "готово" || !chartOk || intradayModel?.partialMode;

  const anchor = intradayModel?.anchor;

  if (!needsDetail && chartOk) {
    return (
      <div className={cn("space-y-1", className)}>
      <p
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500",
        )}
      >
        <span className="text-emerald-400/80">данные MOEX ISS</span>
        <span>·</span>
        <span>интервал {intervalLabel}</span>
        <span>·</span>
        <span>общих точек (exact 3 ноги) {diag.commonTimestamps}</span>
        {intradayModel?.focusAlignmentStats ? (
          <>
            <span>·</span>
            <span>
              aligned {intradayModel.focusPair}: {intradayModel.focusAlignmentStats.alignedCount}
            </span>
          </>
        ) : null}
        {intradayModel?.partialModePill ? (
          <>
            <span>·</span>
            <span className="text-amber-300/85">{intradayModel.partialModePill}</span>
          </>
        ) : null}
      </p>
      {anchor ? (
        <p className="font-mono text-[10px] text-slate-500">
          <span className="text-cyan-200/80">якорь:</span> {anchor.timestampFormatted}
          <span> · </span>
          <span>режим: {anchor.effectiveModeLabel}</span>
          {anchor.forwardFilledNote ? (
            <>
              <span> · </span>
              <span className="text-amber-300/85">{anchor.forwardFilledNote}</span>
            </>
          ) : null}
          {anchor.fallbackWarning ? (
            <>
              <span> · </span>
              <span className="text-amber-300/85">{anchor.fallbackWarning}</span>
            </>
          ) : null}
        </p>
      ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/15 bg-amber-950/10 px-3 py-2 text-[11px] text-slate-400",
        className,
      )}
    >
      <p className="font-medium text-amber-200/90">Диагностика данных</p>
      <ul className="mt-1.5 space-y-1 font-mono text-[10px] leading-relaxed">
        <li>
          Источник: MOEX ISS · запрошен {diag.requestedInterval}м · использован {intervalLabel}
        </li>
        <li>
          Точек по инструменту: SI {diag.pointsSi} · CNY {diag.pointsCny} · ED {diag.pointsEd}
        </li>
        <li className="text-amber-200/80">{diag.edSummary}</li>
        {diag.instruments.ED ? (
          <li className="text-slate-500">
            ED debug: {diag.instruments.ED.pointCount} точек · первая {diag.instruments.ED.firstPrice ?? "—"}{" "}
            · последняя {diag.instruments.ED.lastPrice ?? "—"} ·{" "}
            {diag.instruments.ED.lastTimestamp ?? "—"} · {diag.instruments.ED.statusMessage}
          </li>
        ) : null}
        <li>Общих timestamp exact (SI+CNY+ED): {diag.commonTimestamps}</li>
        {intradayModel?.focusAlignmentStats ? (
          <>
            <li>
              Пара {intradayModel.focusPair}: SI {intradayModel.focusAlignmentStats.leftPointCount}{" "}
              св. · {intradayModel.focusAlignmentStats.rightInstrument}{" "}
              {intradayModel.focusAlignmentStats.rightPointCount} св.
            </li>
            <li>
              Aligned: {intradayModel.focusAlignmentStats.alignedCount} · forward-fill:{" "}
              {intradayModel.focusAlignmentStats.forwardFilledCount} · отброшено stale:{" "}
              {intradayModel.focusAlignmentStats.staleDroppedCount} · max stale:{" "}
              {intradayModel.focusAlignmentStats.maxStaleMinutes} мин
            </li>
          </>
        ) : null}
        <li>
          Пары на карте:{" "}
          {availablePairs.length > 0 ? availablePairs.join(", ") : PAIR_LABELS.join(", ")} — нет
          пересечения
        </li>
        {intraday.intervalNotice ? <li>{intraday.intervalNotice}</li> : null}
        {intradayModel?.diagnosticMessage ? (
          <li className="text-slate-300">{intradayModel.diagnosticMessage}</li>
        ) : null}
        {diag.status === "мало точек" ? (
          <li>Мало общих свечей — график может быть частичным или пустым.</li>
        ) : null}
        {diag.status === "нет интрадей-свечей" ? (
          <li>Интрадей-свечи не загружены — попробуйте другой интервал или период 2д/5д.</li>
        ) : null}
      </ul>
    </div>
  );
}
