"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type CopyTickerBadgeProps = {
  ticker: string;
  className?: string;
  /** compact — радар; default — таблица */
  size?: "compact" | "default";
};

export function CopyTickerBadge({ ticker, className, size = "default" }: CopyTickerBadgeProps) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(ticker);
        setCopied(true);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => setCopied(false), 1600);
      } catch {
        /* clipboard недоступен — тихо игнорируем */
      }
    },
    [ticker],
  );

  const sizeClass =
    size === "compact"
      ? "text-[10px] font-semibold tracking-wide"
      : "text-[12px] font-semibold tracking-[0.04em]";

  return (
    <Tooltip open={copied ? true : undefined}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "shrink-0 truncate rounded px-0.5 text-left text-lab-text-main transition-colors",
            "hover:text-lab-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40",
            copied && "text-emerald-300",
            sizeClass,
            className,
          )}
          aria-label={copied ? `${ticker} скопирован` : `Скопировать ${ticker}`}
        >
          {ticker}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="border-white/10 bg-slate-950/95 text-[10px]">
        {copied ? `${ticker} скопирован` : `Клик — скопировать ${ticker}`}
      </TooltipContent>
    </Tooltip>
  );
}
