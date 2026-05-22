"use client";

import type {
  DivergenceMapCard,
  DivergenceMapModel,
} from "@/lib/domain/currency-correlation-divergence-map";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import {
  LIFECYCLE_STATE_CHART_COLORS,
  type SpreadLifecycleState,
} from "@/lib/domain/spread-lifecycle";
import type { SpreadUnitMode } from "@/lib/domain/currency-spread-units";
import { CurrencyCorrelationZScale } from "@/components/lab/currency-correlation/currency-correlation-z-scale";
import { cn } from "@/lib/utils/cn";

const CARD_SHELL: Record<SpreadLifecycleState, string> = {
  normal: "border-white/[0.06] bg-slate-900/35",
  watch: "border-amber-500/18 bg-amber-950/12",
  stretch: "border-violet-500/28 bg-violet-950/18",
  extreme: "border-orange-500/30 bg-orange-950/20",
  returning: "border-emerald-500/20 bg-emerald-950/12",
  returned: "border-emerald-500/15 bg-emerald-950/10",
  breakdown: "border-rose-500/32 bg-rose-950/22",
  "outside-week-context": "border-cyan-500/25 bg-cyan-950/15",
};

const STATE_BADGE: Record<SpreadLifecycleState, string> = {
  normal: "border-slate-600/40 bg-slate-900/60 text-slate-400",
  watch: "border-amber-500/25 bg-amber-950/25 text-amber-200/90",
  stretch: "border-violet-500/30 bg-violet-950/30 text-violet-200",
  extreme: "border-orange-500/30 bg-orange-950/28 text-orange-200",
  returning: "border-emerald-500/25 bg-emerald-950/25 text-emerald-200",
  returned: "border-emerald-500/20 bg-emerald-950/20 text-emerald-200/80",
  breakdown: "border-rose-500/30 bg-rose-950/28 text-rose-200",
  "outside-week-context": "border-cyan-500/30 bg-cyan-950/25 text-cyan-200",
};

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function DivergenceMapCardView({
  card,
  unitMode,
  selected,
  onSelect,
}: {
  card: DivergenceMapCard;
  unitMode: SpreadUnitMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const st = card.current.state;
  const spread =
    card.displaySpread != null ? card.displaySpread : card.current.currentSpread;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!card.available}
      className={cn(
        "group relative flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition",
        "backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-45",
        CARD_SHELL[st],
        selected &&
          "ring-1 ring-cyan-500/35 shadow-[0_0_28px_rgba(34,211,238,0.1)]",
        card.available && !selected && "hover:border-white/12 hover:bg-slate-900/50",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span
            className="font-mono text-xs tracking-tight"
            style={{ color: selected ? "#a5f3fc" : LIFECYCLE_STATE_CHART_COLORS[st] }}
          >
            {card.label}
          </span>
          <p className="text-[9px] text-slate-600">
            режим: {card.modeLabelRu}
            {card.experimental ? " · эксп." : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] uppercase tracking-wide",
            STATE_BADGE[st],
          )}
        >
          {card.current.stateLabel}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
        <dt className="text-slate-600">Спред</dt>
        <dd className="text-right font-mono tabular-nums text-slate-100">
          {card.displaySpreadFormatted}
        </dd>
        <dt className="text-slate-600">z-score</dt>
        <dd className="text-right font-mono tabular-nums text-cyan-200/85">
          {fmtZ(card.current.currentZ)}
        </dd>
        <dt className="text-slate-600">Кто сильнее</dt>
        <dd className="text-right text-slate-300">{card.current.leaderLabel}</dd>
        <dt className="text-slate-600">В состоянии</dt>
        <dd className="text-right font-mono text-slate-500">{card.current.barsInZone} св.</dd>
        <dt className="text-slate-600">Последняя свеча</dt>
        <dd className="col-span-2 text-right font-mono text-[9px] text-slate-500">
          {card.lastCandleLabel}
        </dd>
      </dl>

      <CurrencyCorrelationZScale
        z={card.current.currentZ}
        state={st}
        className="mt-2.5"
      />
    </button>
  );
}

export function CurrencyCorrelationDivergenceMap({
  model,
  selectedPair,
  onSelectPair,
  unitMode,
}: {
  model: DivergenceMapModel | null;
  selectedPair: PointsPairKey;
  onSelectPair: (p: PointsPairKey) => void;
  unitMode: SpreadUnitMode;
}) {
  if (!model?.hasData) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 px-3 py-4 text-center text-[11px] text-slate-500">
        Карта расхождений: недостаточно общих интрадей-свечей.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2.5 backdrop-blur-xl">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Карта расхождений
      </p>
      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-400">{model.headline}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {model.cards.map((card) => (
          <DivergenceMapCardView
            key={card.pairKey}
            card={card}
            unitMode={unitMode}
            selected={selectedPair === card.pairKey}
            onSelect={() => onSelectPair(card.pairKey)}
          />
        ))}
      </div>
    </section>
  );
}
