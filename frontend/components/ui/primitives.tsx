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
        <h2 className="lab-type-display text-xl">{title}</h2>
        {subtitle ? <p className="lab-type-caption mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function DataBadge({ label }: { label: string }) {
  return <span className="lab-status-chip lab-chip-moex">{label}</span>;
}

export function StatusPill({ status }: { status: "open" | "halted" | "auction" | "closed" | "unknown" }) {
  const statusClass = {
    open: "lab-status-chip lab-chip-live",
    halted: "lab-status-chip border-lab-red/40 bg-lab-red/10 text-lab-red",
    auction: "lab-status-chip lab-chip-soon",
    closed: "lab-status-chip lab-chip-dev",
    unknown: "lab-status-chip text-lab-dim",
  }[status];
  const statusLabel = {
    open: "Открыт",
    halted: "Остановлен",
    auction: "Аукцион",
    closed: "Закрыт",
    unknown: "Неизвестно",
  }[status];
  return <span className={cn("lab-status-chip", statusClass)}>{statusLabel}</span>;
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
    <article className="lab-card p-4">
      <p className="lab-type-caption uppercase tracking-wide">{label}</p>
      <p className="lab-number mt-2 text-xl font-semibold">{value}</p>
      {change ? <p className={cn("lab-number mt-1 text-xs", isPositive ? "text-lab-green" : "text-lab-red")}>{change}</p> : null}
    </article>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="lab-panel rounded-xl border-dashed p-8 text-center">
      <p className="font-medium text-lab-text-main">{title}</p>
      <p className="lab-type-caption mt-2 text-sm">{text}</p>
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-lab-surface-3/80", className)} />;
}

export function TooltipTerm({ term, definition }: { term: string; definition: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="border-b border-dotted border-lab-text-dim text-lab-text-muted">{term}</button>
      </TooltipTrigger>
      <TooltipContent>{definition}</TooltipContent>
    </Tooltip>
  );
}

export function PremiumLockCard({
  title = "Премиум-аналитика",
  text = "Расширенные метрики и сигналы для продвинутой работы.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="lab-glass-card p-6">
      <div className="mb-3 inline-flex rounded-lg bg-lab-violet/15 p-2 text-lab-violet">
        <Lock className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold text-lab-text">{title}</h3>
      <p className="lab-type-caption mt-2 text-sm">{text}</p>
      <Button className="mt-4" variant="outline">
        <Sparkles className="mr-2 h-4 w-4" />
        Подключить
      </Button>
    </div>
  );
}
