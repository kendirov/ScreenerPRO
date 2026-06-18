"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function RadarColumnShell({
  title,
  subtitle,
  hint,
  count,
  children,
  className,
  titleClassName,
  emphasis = false,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
  count?: number;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-800/40 bg-slate-950/30",
        emphasis && "border-slate-600/35 bg-slate-900/45",
        className,
      )}
      title={hint}
    >
      <div className="shrink-0 border-b border-slate-800/40 px-1.5 py-0.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[9px] font-semibold uppercase tracking-[0.12em]",
                emphasis ? "text-slate-200" : "text-slate-400",
                titleClassName,
              )}
            >
              {title}
            </p>
            {subtitle ? (
              <p className="truncate text-[8px] leading-tight text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {count != null ? (
            <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">{count}</span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
