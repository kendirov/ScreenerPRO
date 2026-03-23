import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function DataBadge({ label }: { label: string }) {
  return <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">{label}</span>;
}

export function StatusPill({ status }: { status: "open" | "halted" | "auction" | "closed" }) {
  const statusClass = {
    open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    halted: "bg-red-500/15 text-red-300 border-red-500/30",
    auction: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    closed: "bg-slate-600/30 text-slate-300 border-slate-600/60",
  }[status];
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs capitalize", statusClass)}>{status}</span>;
}

export function MetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: string;
}) {
  const isPositive = change?.startsWith("+");
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
      {change ? <p className={cn("mt-1 text-xs", isPositive ? "text-emerald-300" : "text-rose-300")}>{change}</p> : null}
    </article>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-800/80", className)} />;
}

export function TooltipTerm({ term, definition }: { term: string; definition: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="border-b border-dotted border-slate-500 text-slate-300">{term}</button>
      </TooltipTrigger>
      <TooltipContent>{definition}</TooltipContent>
    </Tooltip>
  );
}

export function PremiumLockCard({
  title = "Premium analytics",
  text = "Unlock deeper factor metrics and strategy-grade signals.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-3 inline-flex rounded-lg bg-violet-500/15 p-2 text-violet-300">
        <Lock className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
      <Button className="mt-4" variant="outline">
        <Sparkles className="mr-2 h-4 w-4" />
        Upgrade
      </Button>
    </div>
  );
}
