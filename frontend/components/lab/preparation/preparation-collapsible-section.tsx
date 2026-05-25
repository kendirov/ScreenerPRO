"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type SectionAccent = "cyan" | "amber" | "violet" | "green";

const ACCENT_LINE: Record<SectionAccent, string> = {
  cyan: "from-lab-cyan/60 via-lab-cyan/20 to-transparent",
  amber: "from-lab-amber/70 via-lab-amber/25 to-transparent",
  violet: "from-lab-violet/60 via-lab-violet/20 to-transparent",
  green: "from-lab-green/60 via-lab-green/20 to-transparent",
};

export function PreparationCollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  accent = "cyan",
  badge,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accent?: SectionAccent;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(open) : value;
    if (openProp == null) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className={cn("lab-glass-panel overflow-hidden", className)}>
      <div
        className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-70", ACCENT_LINE[accent])}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex w-full items-start justify-between gap-3 border-b border-lab-border/50 px-3 py-2.5 text-left transition hover:bg-lab-surface-2/25"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-lab-text">{title}</span>
            {badge ? (
              <span className="lab-status-chip border-lab-amber/35 bg-lab-amber/10 px-1.5 py-px text-[9px] text-lab-amber">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-[11px] text-lab-muted">{subtitle}</p> : null}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-lab-dim transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="relative space-y-3 p-3">{children}</div> : null}
    </section>
  );
}
