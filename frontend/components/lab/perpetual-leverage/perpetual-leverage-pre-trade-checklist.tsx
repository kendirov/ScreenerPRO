"use client";

import { AlertTriangle, Check } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

const REQUIRED_NUMBERS = [
  "Размер позиции",
  "Плечо",
  "Цена входа",
  "Цена стопа",
  "Цена ликвидации",
] as const;

const ADDITIONAL_NUMBERS = [
  "комиссия на вход/выход",
  "funding",
  "риск в $",
  "риск в % от депозита",
] as const;

function CyanCheck() {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-950/40"
      aria-hidden
    >
      <Check className="h-3 w-3 text-cyan-400/90" strokeWidth={2.5} />
    </span>
  );
}

export function PerpetualLeveragePreTradeChecklist() {
  return (
    <LabGlassPanel
      depth={30}
      className="relative overflow-hidden border-white/10 bg-black/50 px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="relative space-y-4">
        <header className="max-w-2xl">
          <h2 className="text-balance text-base font-semibold leading-snug text-slate-50 sm:text-lg">
            Перед первой perpetual-сделкой ты обязан знать 5 чисел
          </h2>
        </header>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {REQUIRED_NUMBERS.map((item, index) => (
            <li
              key={item}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-slate-950/50 px-3 py-2"
            >
              <CyanCheck />
              <span className="text-xs text-slate-300">
                <span className="lab-number mr-1.5 text-[10px] text-cyan-500/60">{index + 1}.</span>
                {item}
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Дополнительно
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" role="list">
            {ADDITIONAL_NUMBERS.map((item) => (
              <li key={item} className="text-[11px] text-slate-500">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 py-2.5"
          role="note"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/90" aria-hidden />
          <p className="text-xs leading-relaxed text-rose-100/85">
            Без пяти цифр сделка открывается вслепую. Считай комиссию, funding и риск в % от депозита до входа.
          </p>
        </div>

        <p className="border-t border-white/[0.06] pt-3 text-center text-sm font-medium text-slate-300">
          Если ты не знаешь,{" "}
          <span className="text-rose-300/90">где ликвидация</span> — ты не управляешь сделкой.
        </p>
      </div>
    </LabGlassPanel>
  );
}
