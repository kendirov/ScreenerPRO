"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type LabStatusPill = {
  label: string;
  tone?: "source" | "time" | "meta" | "accent";
};

export type LabPageShellProps = {
  title: string;
  description: string;
  pills?: LabStatusPill[];
  modeControl?: ReactNode;
  children: ReactNode;
  /** Плоский заголовок без «карточки» — для терминального привода */
  compact?: boolean;
  className?: string;
};

const pillToneClass: Record<NonNullable<LabStatusPill["tone"]>, string> = {
  source: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  time: "border-slate-700/80 bg-slate-900/70 text-slate-400",
  meta: "border-slate-800/80 text-slate-500",
  accent: "border-violet-500/25 bg-violet-950/35 text-violet-200/90",
};

export function LabPageShell({
  title,
  description,
  pills,
  modeControl,
  children,
  compact = false,
  className,
}: LabPageShellProps) {
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-3", className)}>
      <header
        className={cn(
          compact
            ? "border-b border-white/[0.05] bg-[#020308] px-2 py-1"
            : "rounded-xl border border-white/[0.06] bg-slate-900/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl",
        )}
      >
        <div className={cn("flex flex-wrap items-center", compact ? "gap-x-2 gap-y-1" : "items-start gap-x-4 gap-y-3")}>
          <div className={cn(compact ? "flex min-w-0 flex-1 items-center gap-2" : "min-w-[240px] flex-1")}>
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={cn(
                  "font-semibold tracking-tight text-slate-100",
                  compact ? "text-sm" : "text-xl",
                )}
              >
                {title}
              </h1>
              <span className="rounded border border-violet-500/20 bg-violet-950/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-300/80">
                LAB
              </span>
            </div>
            {!compact && description ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
            ) : null}
          </div>

          {pills && pills.length > 0 ? (
            <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[10px]" : "text-[11px]")}>
              {pills.map((pill) => (
                <span
                  key={pill.label}
                  className={cn(
                    "rounded border",
                    compact ? "px-1.5 py-0.5" : "rounded-md px-2 py-1",
                    pillToneClass[pill.tone ?? "meta"],
                  )}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {modeControl ? (
          <div className={cn(compact ? "mt-1 border-t border-white/[0.04] pt-1" : "mt-3 border-t border-white/[0.04] pt-3")}>
            {modeControl}
          </div>
        ) : null}
      </header>

      {children}
    </div>
  );
}

export function LabModePlaceholder({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[min(52vh,420px)] flex-col items-center justify-center rounded-xl border border-dashed border-violet-500/15 bg-slate-950/40 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-400/50">черновик · LAB</p>
    </div>
  );
}


