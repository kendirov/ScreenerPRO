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
  source: "lab-status-chip lab-chip-live",
  time: "lab-status-chip text-lab-muted",
  meta: "lab-status-chip lab-chip-dev",
  accent: "lab-status-chip lab-chip-lab",
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
            ? "border-b border-lab-border bg-lab-bg-deep px-2 py-1"
            : "lab-glass-panel relative overflow-hidden px-4 py-3",
        )}
      >
        {!compact ? <div className="lab-accent-line absolute inset-x-0 top-0 opacity-45" aria-hidden /> : null}
        <div className={cn("relative flex flex-wrap items-center", compact ? "gap-x-2 gap-y-1" : "items-start gap-x-4 gap-y-3")}>
          <div className={cn(compact ? "flex min-w-0 flex-1 items-center gap-2" : "min-w-[240px] flex-1")}>
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={cn(
                  "font-semibold tracking-tight text-lab-text",
                  compact ? "text-sm" : "text-xl",
                )}
              >
                {title}
              </h1>
              <span className="lab-status-chip lab-chip-lab px-1.5 py-0.5 text-[9px]">Лаб</span>
            </div>
            {!compact && description ? (
              <p className="lab-type-caption mt-1 max-w-2xl text-sm leading-relaxed">{description}</p>
            ) : null}
          </div>

          {pills && pills.length > 0 ? (
            <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[10px]" : "text-[11px]")}>
              {pills.map((pill) => (
                <span
                  key={pill.label}
                  className={cn(
                    "lab-chip",
                    compact ? "px-1.5 py-0.5" : "px-2 py-1",
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
          <div className={cn(compact ? "mt-1 border-t border-lab-border pt-1" : "mt-3 border-t border-lab-border pt-3")}>
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
        "lab-glass-panel flex min-h-[min(52vh,420px)] flex-col items-center justify-center border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-lab-text-main">{title}</p>
      {description ? <p className="lab-type-caption mt-2 max-w-md text-sm">{description}</p> : null}
      <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-lab-violet/70">лаборатория · черновик</p>
    </div>
  );
}


