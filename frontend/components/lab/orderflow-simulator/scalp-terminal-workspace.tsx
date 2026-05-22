"use client";

import type { ReactNode } from "react";
import { ScalpTerminalLayout } from "@/components/lab/orderflow-simulator/scalp-terminal-layout";
import { cn } from "@/lib/utils/cn";

type ScalpTerminalWorkspaceProps = {
  topBar: ReactNode;
  scenarioBar?: ReactNode;
  tradeStrip?: ReactNode;
  presentationToolbar?: ReactNode;
  presentationHint?: ReactNode;
  explanation?: ReactNode;
  chart: ReactNode;
  tape: ReactNode;
  orderBook: ReactNode;
  clusters: ReactNode;
  sidePanel?: ReactNode;
  combinedBook?: boolean;
  isPresentation?: boolean;
  /** Скрыть полосу сценариев в рабочем приводе */
  hideScenarioBar?: boolean;
  className?: string;
};

export function ScalpTerminalWorkspace({
  topBar,
  scenarioBar,
  tradeStrip,
  presentationToolbar,
  presentationHint,
  explanation,
  chart,
  tape,
  orderBook,
  clusters,
  sidePanel,
  combinedBook = false,
  isPresentation = false,
  hideScenarioBar = false,
  className,
}: ScalpTerminalWorkspaceProps) {
  return (
    <div className={cn("orderflow-canvas scalp-terminal-canvas flex min-h-[min(78vh,760px)] flex-col", className)}>
      {isPresentation ? presentationToolbar : topBar}

      {isPresentation ? presentationHint : null}

      {!isPresentation && scenarioBar && !hideScenarioBar ? scenarioBar : null}

      {!isPresentation && tradeStrip ? (
        <details className="group border-b border-white/[0.04] bg-[#030508]/60">
          <summary className="cursor-pointer px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-600 hover:text-slate-400">
            Торговля и настройки
          </summary>
          <div className="border-t border-white/[0.03]">{tradeStrip}</div>
        </details>
      ) : null}

      {explanation}

      <ScalpTerminalLayout
        className="min-h-0 flex-1"
        chart={chart}
        tape={tape}
        orderBook={orderBook}
        clusters={clusters}
        sidePanel={sidePanel}
        combinedBook={combinedBook}
      />
    </div>
  );
}
