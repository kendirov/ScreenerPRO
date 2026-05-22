"use client";

import type { DomFocusDemoKind } from "@/lib/domain/dom-focus-teaching";
import { cn } from "@/lib/utils/cn";

const DEMO_BUTTONS: { kind: DomFocusDemoKind; label: string }[] = [
  { kind: "large-order", label: "Крупная заявка" },
  { kind: "spread", label: "Спред" },
  { kind: "market-buy", label: "Рыночная покупка" },
  { kind: "market-sell", label: "Рыночная продажа" },
  { kind: "iceberg", label: "Айсберг" },
  { kind: "absorption", label: "Абсорбция" },
];

type DomFocusTeachingBarProps = {
  activeKind?: DomFocusDemoKind | null;
  onDemo: (kind: DomFocusDemoKind) => void;
  className?: string;
};

export function DomFocusTeachingBar({ activeKind, onDemo, className }: DomFocusTeachingBarProps) {
  return (
    <div
      className={cn(
        "dom-focus-teaching-bar flex flex-wrap items-center gap-1 border-b border-white/[0.04] bg-[#030508] px-2 py-1",
        className,
      )}
    >
      <span className="mr-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">Учебные подсказки</span>
      {DEMO_BUTTONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9px] transition",
            activeKind === kind
              ? "border-violet-500/40 bg-violet-950/50 text-violet-100"
              : "border-white/[0.08] text-slate-500 hover:border-white/15 hover:text-slate-300",
          )}
          onClick={() => onDemo(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
