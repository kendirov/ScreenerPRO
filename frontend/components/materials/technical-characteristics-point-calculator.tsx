"use client";

import * as React from "react";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { calcPointMovementRub } from "@/lib/domain/technical-characteristics-lesson";
import { formatCommissionCoverText } from "@/lib/domain/technical-characteristics-lesson";

function formatResultRub(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

export function TechnicalCharacteristicsPointCalculator({ row }: { row: TechnicalCharacteristicsRow }) {
  const [lots, setLots] = React.useState(1);
  const [points, setPoints] = React.useState(5);

  React.useEffect(() => {
    setLots(1);
    setPoints(5);
  }, [row.ticker]);

  const movementRub = calcPointMovementRub(lots, points, row.stepValue.value);
  const commissionCover = formatCommissionCoverText(row);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-slate-500">
          Лотов
          <input
            type="number"
            min={1}
            step={1}
            value={lots}
            onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
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
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
          />
        </label>
      </div>
      <p className="font-mono text-sm text-slate-100">
        ≈ {row.stepValue.value === null ? "нет данных по стоимости шага" : formatResultRub(movementRub)}
      </p>
      <p className="text-[10px] leading-relaxed text-slate-500">
        {row.stepValue.value === null
          ? "Нет данных по стоимости шага в MOEX ISS."
          : `Расчёт: ${lots} × ${points} × стоимость шага.`}{" "}
        Технический расчёт движения, без комиссии и проскальзывания.
      </p>
      <p className="border-t border-slate-800 pt-2 text-[10px] leading-relaxed text-slate-400">{commissionCover.text}</p>
    </div>
  );
}
