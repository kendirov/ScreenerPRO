import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

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
    <LabGlassPanel depth={20} className={cn("relative overflow-hidden px-3 py-2.5", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-45" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="lab-type-section text-xs text-lab-text">{title}</span>
        {children}
        {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </LabGlassPanel>
  );
}

export function ScreenerPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <LabGlassPanel depth={20} className={cn("px-2.5 py-2", className)}>
      {children}
    </LabGlassPanel>
  );
}