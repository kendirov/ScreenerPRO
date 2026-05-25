"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const READING_LINES = [
  "Правее — денег больше обычного (относительно вчера к этому времени).",
  "Выше — рост от открытия.",
  "Ниже — давление.",
  "Размер круга — оборот.",
  "Хвост — сдвиг относительно вчера (только при данных MOEX).",
  "Цвет — направление движения.",
];

export function FlowMapReadingGuide({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("lab-glass-card rounded-xl border border-white/[0.06] bg-slate-900/30", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <span className="text-[11px] font-medium tracking-wide text-slate-400">Как читать карту</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-slate-600 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-white/[0.05] px-3 pb-3 pt-2 text-[11px] leading-snug text-slate-500">
          {READING_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
