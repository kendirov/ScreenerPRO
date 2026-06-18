"use client";

import { cn } from "@/lib/utils/cn";
import { getLeverageLadderPhrase, type LeverageLadderPhraseTone } from "@/lib/domain/perpetual-leverage";

const TONE_CLASS: Record<LeverageLadderPhraseTone, string> = {
  calm: "text-slate-200",
  warm: "text-amber-100/95",
  alert: "text-amber-200/90",
  danger: "text-rose-200/95",
  extreme: "text-rose-100",
};

type Props = {
  leverage: number;
  className?: string;
};

export function LeverageLadderPhrase({ leverage, className }: Props) {
  const { text, tone } = getLeverageLadderPhrase(leverage);

  return (
    <p
      key={text}
      className={cn(
        "text-balance text-lg font-semibold leading-snug tracking-tight transition-colors duration-300 sm:text-xl",
        TONE_CLASS[tone],
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {text}
    </p>
  );
}
