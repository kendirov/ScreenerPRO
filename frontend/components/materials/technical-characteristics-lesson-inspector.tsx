"use client";

import * as React from "react";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import {
  buildLessonExplanation,
  calcPointMovementRub,
  formatCommissionCoverText,
  type LessonSuitabilityHint,
} from "@/lib/domain/technical-characteristics-lesson";
import type { TechnicalPreset } from "@/lib/domain/technical-characteristics-presets";

function formatResultRub(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function suitabilityTone(hint: LessonSuitabilityHint) {
  if (hint.startsWith("осторожно")) return "text-amber-300/90";
  if (hint === "для стакана") return "text-cyan-300/90";
  if (hint === "для интрадэя") return "text-emerald-300/90";
  return "text-slate-300";
}

export function TechnicalCharacteristicsLessonInspector({
  row,
  tradingPreset,
}: {
  row: TechnicalCharacteristicsRow;
  tradingPreset: TechnicalPreset | null;
}) {
  const explanation = React.useMemo(() => buildLessonExplanation(row, tradingPreset), [row, tradingPreset]);
  const commissionCover = React.useMemo(() => formatCommissionCoverText(row), [row]);

  const [lots, setLots] = React.useState(1);
  const [points, setPoints] = React.useState(5);

  React.useEffect(() => {
    setLots(1);
    setPoints(5);
  }, [row.ticker]);

  const movementRub = calcPointMovementRub(lots, points, row.stepValue.value);

  return (
    <div className="space-y-2 border-t border-violet-500/20 pt-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/90">Объяснение</p>

      <LessonBlock title="Лот-экономика" text={explanation.lotEconomics} />
      <LessonBlock title="Шаг цены" text={explanation.priceStep} />
      <LessonBlock title="Спред" text={explanation.spread} />
      <LessonBlock title="Активность" text={explanation.activity} />

      <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2">
        <p className="text-[11px] font-medium text-slate-300">Для чего подходит</p>
        <ul className="mt-1.5 space-y-0.5 text-[11px]">
          {explanation.suitability.map((hint) => (
            <li key={hint} className={suitabilityTone(hint)}>
              · {hint}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] text-slate-500">Формулировки для урока — не совет покупать или продавать.</p>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2">
        <p className="text-[11px] font-medium text-slate-300">Мини-калькулятор движения</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block text-[10px] text-slate-500">
            Лотов
            <input
              type="number"
              min={1}
              step={1}
              value={lots}
              onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-violet-400/60"
            />
          </label>
          <label className="block text-[10px] text-slate-500">
            Шагов цены
            <input
              type="number"
              min={1}
              step={1}
              value={points}
              onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))}
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-violet-400/60"
            />
          </label>
        </div>
        <p className="mt-2 font-mono text-sm text-slate-100">
          ≈ {row.stepValue.value === null ? "нет данных по стоимости шага" : formatResultRub(movementRub)}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          {row.stepValue.value === null
            ? "Нет данных по стоимости шага в MOEX ISS."
            : `Расчёт: ${lots} × ${points} × ${formatResultRub(row.stepValue.value)} за шаг.`}{" "}
          Это технический расчёт движения, без учёта комиссии и проскальзывания.
        </p>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2">
        <p className="text-[11px] font-medium text-slate-300">Комиссия и спред</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{commissionCover.text}</p>
      </div>
    </div>
  );
}

function LessonBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-slate-800/80 bg-slate-950/40 px-2.5 py-2">
      <p className="text-[11px] font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}
