"use client";

import { cn } from "@/lib/utils/cn";
import {
  buildLeverageImpactCards,
  formatLeverageX,
  formatPercentFixed,
  formatUsd,
  type LeverageImpactCard,
  type LeveragePickCardTone,
} from "@/lib/domain/perpetual-leverage";

const TONE_STYLES: Record<
  LeveragePickCardTone,
  { border: string; value: string; muted: string; active: string }
> = {
  cyan: {
    border: "border-white/[0.06] hover:border-white/10",
    value: "text-slate-100",
    muted: "text-slate-500",
    active: "border-slate-400/30 ring-1 ring-slate-400/20",
  },
  amber: {
    border: "border-amber-500/12 hover:border-amber-500/20",
    value: "text-amber-100/95",
    muted: "text-amber-600/80",
    active: "border-amber-500/30 ring-1 ring-amber-500/15",
  },
  red: {
    border: "border-rose-500/15 hover:border-rose-500/25",
    value: "text-rose-100/95",
    muted: "text-rose-600/80",
    active: "border-rose-500/35 ring-1 ring-rose-500/20",
  },
};

function ImpactCard({
  card,
  active,
  onSelect,
}: {
  card: LeverageImpactCard;
  active: boolean;
  onSelect: () => void;
}) {
  const tone = TONE_STYLES[card.cardTone];
  const distance =
    card.adverseMovePercent != null ? `~${formatPercentFixed(card.adverseMovePercent, 1)}` : "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "perp-lab-card w-full rounded-xl border bg-black/50 p-3 text-left transition duration-200 sm:p-3.5",
        tone.border,
        active && tone.active,
      )}
    >
      <p className={cn("lab-number text-xl font-bold leading-none sm:text-2xl", tone.value)}>
        {formatLeverageX(card.leverage)}
      </p>
      <p className={cn("lab-number mt-2 text-sm font-medium leading-tight", tone.value)}>
        {formatUsd(card.positionSize)}
        <span className={cn("mx-1.5 font-normal", tone.muted)}>·</span>
        <span className={cn("font-normal", tone.muted)}>{distance}</span>
      </p>
      <p className={cn("mt-2 text-xs capitalize leading-tight", tone.muted)}>{card.statusLabel}</p>
    </button>
  );
}

type Props = {
  deposit: number;
  activeLeverage: number;
  onLeverageSelect: (leverage: number) => void;
};

export function PerpetualLeverageImpactCards({ deposit, activeLeverage, onLeverageSelect }: Props) {
  const cards = buildLeverageImpactCards(deposit);

  return (
    <section className="space-y-2.5" aria-label="Выбор плеча">
      <h2 className="px-0.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        Плечо · дистанция
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <ImpactCard
            key={card.leverage}
            card={card}
            active={activeLeverage === card.leverage}
            onSelect={() => onLeverageSelect(card.leverage)}
          />
        ))}
      </div>
    </section>
  );
}
