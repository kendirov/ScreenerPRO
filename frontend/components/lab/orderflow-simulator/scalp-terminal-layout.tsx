"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ScalpTerminalLayoutProps = {
  chart: ReactNode;
  tape: ReactNode;
  orderBook: ReactNode;
  clusters: ReactNode;
  sidePanel?: ReactNode;
  /** Лента встроена в колонку стакана — без отдельной средней колонки */
  combinedBook?: boolean;
  className?: string;
};

export function ScalpTerminalLayout({
  chart,
  tape,
  orderBook,
  clusters,
  sidePanel,
  combinedBook = false,
  className,
}: ScalpTerminalLayoutProps) {
  return (
    <div className={cn("scalp-terminal-workspace flex min-h-0 flex-1 flex-col", className)}>
      <div
        className={cn(
          "scalp-terminal-grid min-h-0 flex-1",
          combinedBook && "scalp-terminal-grid--combined-book",
        )}
      >
        <div className="scalp-terminal-chart min-h-0">{chart}</div>
        {!combinedBook ? <div className="scalp-terminal-tape min-h-0">{tape}</div> : null}
        <div className="scalp-terminal-dom min-h-0">{orderBook}</div>
        {sidePanel ? <div className="scalp-terminal-side min-h-0">{sidePanel}</div> : null}
      </div>
      <div className="scalp-terminal-footprint min-h-0 shrink-0">{clusters}</div>
    </div>
  );
}
