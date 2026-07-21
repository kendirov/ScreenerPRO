import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({ eyebrow, title, description, actions, dense = false }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; dense?: boolean }) {
  return <header className={cn("flex flex-wrap items-end justify-between gap-3 border-b border-lab-border pb-3", dense && "pb-2")}>
    <div className="min-w-0"><p className="mb-1 font-mono text-[10px] uppercase tracking-[.16em] text-lab-cyan">{eyebrow}</p><h1 className={cn("lab-type-display", dense && "text-xl")}>{title}</h1>{description ? <p className="mt-1 max-w-3xl text-xs text-lab-muted">{description}</p> : null}</div>{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </header>;
}

export function StatusStrip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" | "warning" | "error" }) {
  const tones = { neutral: "border-lab-border text-lab-muted", live: "border-lab-border-hot bg-lab-cyan/5 text-lab-cyan", warning: "border-lab-border-amber bg-lab-amber/5 text-lab-amber", error: "border-lab-red/35 bg-lab-red/5 text-lab-red" };
  return <div className={cn("flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] border px-2 font-mono text-[10px]", tones[tone])}>{children}</div>;
}

export function SectionFrame({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn("rounded-[var(--radius-md)] border border-lab-border bg-lab-surface-soft", className)}>{children}</section>; }

export function NavBadge({ status }: { status: "live" | "lab" | "draft" | "wip" | "soon" | "service" }) { const label = { live: "LIVE", lab: "LAB", draft: "DRAFT", wip: "WIP", soon: "SOON", service: "SERVICE" }[status]; return <span className="rounded border border-lab-border px-1 py-px font-mono text-[8px] tracking-wider text-lab-dim">{label}</span>; }

export function DataState({ kind, title, description }: { kind: "loading" | "empty" | "stale" | "degraded" | "error" | "offline"; title: string; description?: string }) { const tone = kind === "error" || kind === "offline" ? "text-lab-red" : kind === "stale" || kind === "degraded" ? "text-lab-amber" : "text-lab-muted"; return <div role="status" className={cn("rounded-[var(--radius-md)] border border-lab-border bg-lab-surface-soft p-4 text-sm", tone)}><p className="font-medium">{title}</p>{description ? <p className="mt-1 text-xs text-lab-muted">{description}</p> : null}</div>; }
