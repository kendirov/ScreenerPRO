"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type TerminalWorkspaceLayoutProps = {
  chart: ReactNode;
  orderBook: ReactNode;
  tape: ReactNode;
  clusters: ReactNode;
  sidePanel?: ReactNode;
  className?: string;
};

export function TerminalWorkspaceLayout({
  chart,
  orderBook,
  tape,
  clusters,
  sidePanel,
  className,
}: TerminalWorkspaceLayoutProps) {
  return (
    <div className={cn("orderflow-terminal-workspace flex min-h-0 flex-1 flex-col", className)}>
      <div className="orderflow-terminal-grid min-h-0 flex-1">
        <div className="orderflow-terminal-chart min-h-0">{chart}</div>
        <div className="orderflow-terminal-tape min-h-0">{tape}</div>
        <div className="orderflow-terminal-dom min-h-0">{orderBook}</div>
        {sidePanel ? <div className="orderflow-terminal-side min-h-0">{sidePanel}</div> : null}
      </div>
      <div className="orderflow-terminal-footprint min-h-0 shrink-0">{clusters}</div>
    </div>
  );
}
