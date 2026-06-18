"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Box,
  Gauge,
  Grid3x3,
  Hand,
  Layers,
  Shield,
  Skull,
  Zap,
} from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

type TermAccent = "cyan" | "violet" | "amber" | "rose" | "emerald";

type TermCard = {
  id: string;
  title: string;
  body: string;
  formula?: string;
  icon: LucideIcon;
  accent: TermAccent;
};

const ICON_TONE: Record<TermAccent, string> = {
  cyan: "text-cyan-400/90",
  violet: "text-violet-400/90",
  amber: "text-amber-400/90",
  rose: "text-rose-400/90",
  emerald: "text-emerald-400/90",
};

const CARD_BORDER: Record<TermAccent, string> = {
  cyan: "border-cyan-500/20 hover:border-cyan-500/35",
  violet: "border-violet-500/20 hover:border-violet-500/35",
  amber: "border-amber-500/20 hover:border-amber-500/35",
  rose: "border-rose-500/22 hover:border-rose-500/38",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35",
};

const TERMS: TermCard[] = [
  {
    id: "leverage",
    title: "Плечо",
    body: "Заёмный объём для увеличения размера позиции.",
    formula: "Плечо = размер позиции / собственная маржа",
    icon: Gauge,
    accent: "cyan",
  },
  {
    id: "margin",
    title: "Маржа",
    body: "Залог, который удерживает позицию открытой.",
    icon: Shield,
    accent: "violet",
  },
  {
    id: "liquidation",
    title: "Ликвидация",
    body: "Принудительное закрытие, когда маржи недостаточно.",
    icon: Skull,
    accent: "rose",
  },
  {
    id: "stop-loss",
    title: "Stop-loss",
    body: "Добровольное ограничение убытка по вашему плану.",
    icon: Hand,
    accent: "amber",
  },
  {
    id: "funding",
    title: "Funding",
    body: "Периодический платёж между long и short в perpetual.",
    icon: ArrowLeftRight,
    accent: "violet",
  },
  {
    id: "taker-fee",
    title: "Taker fee",
    body: "Комиссия за исполнение по рынку.",
    icon: Zap,
    accent: "cyan",
  },
  {
    id: "maker-fee",
    title: "Maker fee",
    body: "Комиссия за лимитную заявку, добавляющую ликвидность.",
    icon: Layers,
    accent: "emerald",
  },
  {
    id: "isolated",
    title: "Isolated margin",
    body: "Риск ограничен маржей этой позиции.",
    icon: Box,
    accent: "cyan",
  },
  {
    id: "cross",
    title: "Cross margin",
    body: "На поддержку позиции может уйти весь доступный баланс.",
    icon: Grid3x3,
    accent: "amber",
  },
];

function TermIcon({ icon: Icon, accent }: { icon: LucideIcon; accent: TermAccent }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/8 bg-black/50",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", ICON_TONE[accent])} strokeWidth={2} aria-hidden />
    </span>
  );
}

function CompactTermCard({ term }: { term: TermCard }) {
  return (
    <LabGlassPanel
      depth={10}
      className={cn(
        "perp-lab-card flex gap-2.5 p-3 transition duration-200",
        CARD_BORDER[term.accent],
      )}
    >
      <TermIcon icon={term.icon} accent={term.accent} />
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-semibold text-slate-100">{term.title}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">{term.body}</p>
        {term.formula ? (
          <p className="lab-number mt-1.5 text-[10px] leading-tight text-cyan-300/80">{term.formula}</p>
        ) : null}
      </div>
    </LabGlassPanel>
  );
}

export function PerpetualLeverageTermsMap() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Карта терминов perpetual и риска</p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TERMS.map((term) => (
          <CompactTermCard key={term.id} term={term} />
        ))}
      </div>

      <LabGlassPanel
        depth={20}
        className="grid gap-3 border-cyan-500/15 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5"
      >
        <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2.5">
          <Hand className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
          <p className="text-sm leading-snug text-slate-200">
            <span className="font-semibold text-cyan-200">Stop-loss</span> — это{" "}
            <span className="text-cyan-100/95">управление риском</span>.
          </p>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 py-2.5">
          <Skull className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/90" aria-hidden />
          <p className="text-sm leading-snug text-slate-200">
            <span className="font-semibold text-rose-200">Liquidation</span> — это{" "}
            <span className="text-rose-100/95">потеря контроля</span>.
          </p>
        </div>
      </LabGlassPanel>
    </div>
  );
}
