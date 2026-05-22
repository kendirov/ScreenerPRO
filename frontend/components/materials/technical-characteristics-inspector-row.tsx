"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TechnicalCharacteristicsInspectorRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
      <span className="inline-flex items-center gap-1 text-slate-500">
        {label}
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex text-slate-600 hover:text-cyan-300" aria-label="Подсказка">
                <HelpCircle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
      <span className="text-right font-mono text-slate-200">{value}</span>
    </div>
  );
}
