import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function ScreenerPageHeader({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("lab-glass-panel relative overflow-hidden px-3 py-2.5 shadow-none", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-45" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="lab-type-section text-xs text-lab-text">{title}</span>
        {children}
        {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </div>
  );
}

export function ScreenerPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("lab-glass-panel px-2.5 py-2 shadow-none", className)}>
      {children}
    </div>
  );
}
