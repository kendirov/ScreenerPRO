"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

export function TechnicalCharacteristicsColumnHeader({
  label,
  tooltip,
  sorted,
  sortDesc,
  onSort,
  align,
}: {
  label: string;
  tooltip?: string;
  sorted: boolean;
  sortDesc: boolean;
  onSort: () => void;
  align: "left" | "right";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center gap-1 transition hover:text-slate-200",
        align === "right" ? "justify-end" : "justify-start",
        sorted && "text-cyan-300",
      )}
      onClick={onSort}
    >
      <span>{label}</span>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex text-slate-500 hover:text-cyan-300"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") event.stopPropagation();
              }}
              aria-label="Подсказка по колонке"
            >
              <HelpCircle className="h-3 w-3 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs leading-relaxed">{tooltip}</TooltipContent>
        </Tooltip>
      ) : null}
      {sorted ? (sortDesc ? " ↓" : " ↑") : null}
    </button>
  );
}
