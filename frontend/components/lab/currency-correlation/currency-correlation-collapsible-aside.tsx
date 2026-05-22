"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function CurrencyCorrelationCollapsibleAside({
  title,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <aside className={cn("flex flex-col", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-slate-900/50 px-2 py-1 text-left transition hover:border-white/10"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{title}</span>
        <span className="font-mono text-[10px] text-slate-600">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="min-w-0 flex-1">{children}</div> : null}
    </aside>
  );
}
