"use client";

import * as React from "react";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { TechnicalCharacteristicsPointCalculator } from "@/components/materials/technical-characteristics-point-calculator";
import { buildLessonExplanation } from "@/lib/domain/technical-characteristics-lesson";
import { TC_UNAVAILABLE_HINT, liquidityLabel } from "@/lib/domain/technical-characteristics-labels";
import type { PresetEvaluation, TechnicalPreset } from "@/lib/domain/technical-characteristics-presets";
import { TECHNICAL_PRESET_LABELS } from "@/lib/domain/technical-characteristics-presets";
import { getEntryFriction } from "@/lib/materials/technical-characteristics-view";

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatNum(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function scale(value: number | null, factor: number) {
  if (value === null) return null;
  return value * factor;
}

export function TechnicalCharacteristicsInspectorPanel({
  row,
  tradingPreset,
  presetEvaluation,
  lessonMode,
}: {
  row: TechnicalCharacteristicsRow;
  tradingPreset: TechnicalPreset | null;
  presetEvaluation: PresetEvaluation | null;
  lessonMode: boolean;
}) {
  const lesson = React.useMemo(() => (lessonMode ? buildLessonExplanation(row, tradingPreset) : null), [lessonMode, row, tradingPreset]);

  return (
    <div className="mt-2 space-y-2.5 text-xs">
      <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
        <p className="text-sm font-semibold text-slate-100">{row.ticker}</p>
        <p className="mt-0.5 text-slate-400">{row.instrumentName}</p>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {row.assetClass === "stock" ? "Акция" : "Фьючерс"} · {row.board ?? "—"}
        </p>
        <p className="mt-1 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] text-cyan-200/90">{row.scalabilityHint}</p>
      </div>

      {lesson ? (
        <InspectorSection title="Объяснение">
          <p className="text-[11px] leading-relaxed text-slate-400">{lesson.lotEconomics}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{lesson.priceStep}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{lesson.spread}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{lesson.activity}</p>
        </InspectorSection>
      ) : null}

      <InspectorSection title="Лот-экономика">
        <MetricLine label="Лот" value={row.lotSize.value !== null ? String(row.lotSize.value) : "—"} />
        <MetricLine label="Цена" value={formatMoney(row.currentPrice.value)} />
        <MetricLine label="Цена лота" value={formatMoney(row.lotPrice.value)} />
      </InspectorSection>

      <InspectorSection title="Издержки">
        <MetricLine label="Спред" value={`${formatNum(row.spreadPct.value)}% · ${formatMoney(row.spreadRub.value)}`} />
        <MetricLine label="Комиссия (оценка)" value={formatMoney(row.commissionRub.value)} />
        <MetricLine label="Покрытие комиссии" value={`${formatNum(row.pointsToCoverCommission.value)} шаг.`} />
        <MetricLine
          label="Цена ошибки"
          value={`1 шаг ${formatMoney(row.stepValue.value)} · 10 шаг. ${formatMoney(scale(row.stepValue.value, 10))}`}
        />
        <MetricLine label="Трение входа" value={formatNum(getEntryFriction(row))} />
      </InspectorSection>

      <InspectorSection title="Активность">
        <MetricLine label="Сделки" value={formatNum(row.tradesCount.value)} />
        <MetricLine
          label="Оборот"
          value={row.turnoverRub.value !== null ? `${formatNum(row.turnoverRub.value / 1_000_000)} млн ₽` : "—"}
        />
        <MetricLine
          label="Оборот на сделку"
          value={row.turnoverPerTradeRub.value !== null ? formatMoney(row.turnoverPerTradeRub.value) : "—"}
        />
        <MetricLine label="Ликвидность" value={liquidityLabel(row.liquidityQuality)} />
        <MetricLine label="Готовность" value={formatNum(row.intradayUsabilityScore.value)} />
      </InspectorSection>

      {presetEvaluation && tradingPreset ? (
        <InspectorSection title="Почему подходит">
          <p className="text-[11px] text-slate-400">
            Задача: <span className="text-slate-200">{TECHNICAL_PRESET_LABELS[tradingPreset]}</span> · оценка{" "}
            <span className="font-mono text-cyan-200">{presetEvaluation.presetScore}</span>/100
          </p>
          {presetEvaluation.presetReasonTags.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-300">
              {presetEvaluation.presetReasonTags.map((tag) => (
                <li key={tag}>· {tag}</li>
              ))}
            </ul>
          ) : null}
          {presetEvaluation.presetWarnings.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200/85">
              {presetEvaluation.presetWarnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          ) : null}
          {lesson ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
              {lesson.suitability.map((h) => (
                <li key={h}>· {h}</li>
              ))}
            </ul>
          ) : null}
        </InspectorSection>
      ) : null}

      <InspectorSection title="Калькулятор пункта">
        <TechnicalCharacteristicsPointCalculator row={row} />
      </InspectorSection>

      <InspectorSection title="Данные и уверенность">
        <MetricLine label="Достоверность полей" value={`${row.availabilityConfidence}%`} />
        {row.assetClass === "future" ? (
          <>
            <MetricLine label="Базовый актив" value={row.underlying ?? "—"} />
            <MetricLine label="Экспирация" value={`${row.expiryDate ?? "—"} (${formatNum(row.daysToExpiry.value)} дн.)`} />
            <MetricLine
              label="ГО"
              value={row.marginFootprintRub.value === null ? TC_UNAVAILABLE_HINT : formatMoney(row.marginFootprintRub.value)}
            />
          </>
        ) : null}
        <p className="mt-1 text-[10px] text-slate-500">Пустые значения — «—», без подстановки данных.</p>
      </InspectorSection>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-800/90 bg-slate-950/35 px-2.5 py-2">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <div className="mt-1.5 space-y-1">{children}</div>
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-mono text-slate-200">{value}</span>
    </div>
  );
}
