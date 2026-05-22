"use client";

import {
  type DepthScalePreset,
  type LadderLevelCount,
  type LadderRowHeight,
  type LadderSettings,
} from "@/lib/domain/order-book-ladder-model";
import { cn } from "@/lib/utils/cn";

type DomLadderSettingsProps = {
  settings: LadderSettings;
  onChange: (settings: LadderSettings) => void;
  onRecenter?: () => void;
  className?: string;
};

const LEVEL_OPTIONS: LadderLevelCount[] = [40, 60, 80, 100];
const ROW_HEIGHT_OPTIONS: LadderRowHeight[] = [15, 16, 18, 22];
const DEPTH_SCALE_OPTIONS: { value: DepthScalePreset; label: string }[] = [
  { value: 10000, label: "10K" },
  { value: 20000, label: "20K" },
  { value: 50000, label: "50K" },
  { value: "auto", label: "авто" },
];

const btn = (on: boolean) =>
  cn(
    "rounded px-1 py-px font-mono text-[8px] leading-tight transition",
    on
      ? "bg-white/[0.08] text-slate-200"
      : "text-slate-600 hover:bg-white/[0.04] hover:text-slate-400",
  );

export function DomLadderSettings({ settings, onChange, onRecenter, className }: DomLadderSettingsProps) {
  const patch = (partial: Partial<LadderSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className={cn(
        "dom-ladder-settings flex flex-wrap items-center gap-x-1 gap-y-0 border-b border-white/[0.04] bg-[#010204] px-1 py-px",
        className,
      )}
    >
      <span className="mr-0.5 font-mono text-[7px] uppercase tracking-widest text-slate-600">DOM</span>

      {LEVEL_OPTIONS.map((n) => (
        <button key={n} type="button" className={btn(settings.levelCount === n)} onClick={() => patch({ levelCount: n })}>
          {n}
        </button>
      ))}

      <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />

      {ROW_HEIGHT_OPTIONS.map((h) => (
        <button key={h} type="button" className={btn(settings.rowHeight === h)} onClick={() => patch({ rowHeight: h })}>
          {h}px
        </button>
      ))}

      <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />

      {DEPTH_SCALE_OPTIONS.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={btn(settings.depthScale === opt.value)}
          onClick={() => patch({ depthScale: opt.value })}
        >
          {opt.label}
        </button>
      ))}

      <span className="mx-0.5 h-2.5 w-px bg-white/[0.06]" />

      <button type="button" className={btn(settings.showDensities)} onClick={() => patch({ showDensities: !settings.showDensities })}>
        плотн
      </button>
      <button
        type="button"
        className={btn(settings.showRoundPrints)}
        onClick={() => patch({ showRoundPrints: !settings.showRoundPrints })}
      >
        сделки
      </button>
      <button type="button" className={btn(settings.autoCenter)} onClick={() => patch({ autoCenter: !settings.autoCenter })}>
        центр
      </button>
      {onRecenter ? (
        <button type="button" className={btn(false)} onClick={onRecenter}>
          ↻
        </button>
      ) : null}
    </div>
  );
}
