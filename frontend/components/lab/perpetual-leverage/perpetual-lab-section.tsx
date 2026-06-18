"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  id: string;
  step: string;
  title: string;
  children: ReactNode;
  className?: string;
  bordered?: boolean;
};

/** Визуальная ступень иерархии: Hero → Lab → Scenarios → Terms → Checklist */
export function PerpetualLabSection({
  id,
  step,
  title,
  children,
  className,
  bordered = true,
}: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "perp-lab-section space-y-3",
        bordered && "border-t border-white/[0.06] pt-5 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <div className="flex items-baseline gap-2 px-0.5">
        <span className="lab-number text-[10px] font-medium tabular-nums text-slate-600">{step}</span>
        <h2 id={`${id}-heading`} className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
