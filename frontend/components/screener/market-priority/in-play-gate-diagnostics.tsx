"use client";

import type { InPlayGateDebugStats } from "@/lib/screener/market-priority-debug";
import {
  formatInPlayGateDiagnosticsLine,
  IN_PLAY_GATE_DEBUG_TOOLTIP,
} from "@/lib/screener/market-priority-debug";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

export function InPlayGateDiagnostics({
  stats,
  className,
}: {
  stats?: InPlayGateDebugStats | null;
  className?: string;
}) {
  if (!stats) return null;

  const line = formatInPlayGateDiagnosticsLine(stats);
  if (!line) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p
          className={cn(
            "cursor-help truncate font-mono text-[9px] tabular-nums tracking-tight text-lab-dim/75",
            className,
          )}
          aria-label="Диагностика отбора В игре"
        >
          {line}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] whitespace-pre-line text-[10px]">
        {IN_PLAY_GATE_DEBUG_TOOLTIP}
      </TooltipContent>
    </Tooltip>
  );
}
