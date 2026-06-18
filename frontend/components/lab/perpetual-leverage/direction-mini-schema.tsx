"use client";

import { cn } from "@/lib/utils/cn";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

type Props = {
  direction: PositionSide;
  className?: string;
  compact?: boolean;
};

export function DirectionMiniSchema({ direction, className, compact = false }: Props) {
  const isLong = direction === "long";
  const upLabel = isLong ? "Прибыль" : "Риск";
  const downLabel = isLong ? "Риск" : "Прибыль";
  const upClass = isLong ? "text-emerald-400/90" : "text-amber-400/88";
  const downClass = isLong ? "text-amber-400/85" : "text-emerald-400/90";

  return (
    <div
      className={cn(
        "direction-mini-schema flex flex-col items-center rounded-lg border bg-black/55 px-3 py-2",
        isLong
          ? "border-cyan-500/20 shadow-[inset_0_0_12px_rgba(34,211,238,0.04)]"
          : "border-violet-500/20 shadow-[inset_0_0_12px_rgba(139,92,246,0.05)]",
        compact ? "gap-0 min-w-[4.5rem]" : "gap-0.5 min-w-[5.25rem]",
        className,
      )}
      aria-hidden
    >
      <p className={cn("font-semibold leading-none", compact ? "text-[11px]" : "text-xs", upClass)}>
        ↑ {upLabel}
      </p>
      <p
        className={cn(
          "font-semibold leading-none text-cyan-400",
          compact ? "my-0.5 text-[11px]" : "my-1 text-xs",
        )}
      >
        ● Вход
      </p>
      <p className={cn("font-semibold leading-none", compact ? "text-[11px]" : "text-xs", downClass)}>
        ↓ {downLabel}
      </p>
    </div>
  );
}
