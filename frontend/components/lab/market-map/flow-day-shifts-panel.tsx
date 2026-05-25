"use client";

import type { FlowDayShifts } from "@/lib/domain/market-flow-map";
import { cn } from "@/lib/utils/cn";

const GROUPS: { key: keyof FlowDayShifts; label: string; tone: string }[] = [
  { key: "awakened", label: "Проснулись", tone: "text-emerald-300/85" },
  { key: "accelerated", label: "Ускорились", tone: "text-cyan-300/85" },
  { key: "pressure", label: "Давление", tone: "text-rose-300/85" },
  { key: "faded", label: "Затухли", tone: "text-slate-400" },
];

function ShiftList({ label, tone, items }: { label: string; tone: string; items: FlowDayShifts[keyof FlowDayShifts] }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-[10px] uppercase tracking-[0.14em]", tone)}>{label}</p>
      {items.length ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((item) => (
            <li key={item.ticker} className="text-[11px] leading-snug">
              <span className="font-medium text-slate-200">{item.ticker}</span>
              <span className="text-slate-600"> · </span>
              <span className="text-slate-500">{item.reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-600">—</p>
      )}
    </div>
  );
}

export function FlowDayShiftsPanel({ shifts, className }: { shifts: FlowDayShifts; className?: string }) {
  return (
    <div className={cn("lab-glass-card rounded-xl border border-white/[0.06] bg-slate-900/35 p-3", className)}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Сдвиги дня</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map(({ key, label, tone }) => (
          <ShiftList key={key} label={label} tone={tone} items={shifts[key]} />
        ))}
      </div>
    </div>
  );
}
