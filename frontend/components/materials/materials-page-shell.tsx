import { cn } from "@/lib/utils/cn";

type MaterialsStatusTone = "ok" | "warn";

export function MaterialsPageShell({
  title,
  description,
  freshness,
  sourceLabel,
  sourceTone,
  children,
}: {
  title: string;
  description: string;
  freshness: string;
  sourceLabel: string;
  sourceTone: MaterialsStatusTone;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <header className="lab-glass-panel relative overflow-hidden px-4 py-3">
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-50" aria-hidden />
        <div className="relative flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-[260px] flex-1">
            <h1 className="lab-type-display text-xl">{title}</h1>
            <p className="lab-type-caption mt-1 text-sm">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={cn(
                "lab-status-chip",
                sourceTone === "ok" ? "lab-chip-moex" : "lab-chip-soon",
              )}
            >
              {sourceLabel}
            </span>
            <span className="lab-chip text-lab-muted">{freshness}</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
