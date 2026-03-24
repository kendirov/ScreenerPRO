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
      <header className="rounded-lg border border-slate-800/90 bg-slate-900/45 px-4 py-3">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-[260px] flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={cn(
                "rounded-md border px-2 py-1",
                sourceTone === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              {sourceLabel}
            </span>
            <span className="rounded-md border border-slate-700/80 bg-slate-900/70 px-2 py-1 text-slate-400">{freshness}</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
