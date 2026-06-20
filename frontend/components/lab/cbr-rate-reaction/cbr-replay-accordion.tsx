"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function CbrReplayAccordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cn(
        "group rounded-lg border border-lab-border/30 bg-lab-bg-deep/20",
        className,
      )}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-medium text-lab-muted marker:content-none hover:text-lab-text">
        <span className="group-open:text-lab-text">{title}</span>
      </summary>
      <div className="space-y-2 border-t border-lab-border/25 p-2">{children}</div>
    </details>
  );
}
