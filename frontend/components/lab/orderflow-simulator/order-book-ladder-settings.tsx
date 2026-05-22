"use client";

import {
  DEFAULT_LADDER_SETTINGS,
  type DepthScalePreset,
  type LadderLevelCount,
  type LadderLotStep,
  type LadderSettings,
} from "@/lib/domain/order-book-ladder-model";

export { DEFAULT_LADDER_SETTINGS };
import { cn } from "@/lib/utils/cn";

type OrderBookLadderSettingsProps = {
  settings: LadderSettings;
  onChange: (settings: LadderSettings) => void;
  compact?: boolean;
  onRecenter?: () => void;
  className?: string;
};

const LEVEL_OPTIONS: LadderLevelCount[] = [20, 40, 60, 80];
const LOT_OPTIONS: LadderLotStep[] = [1, 10, 100, 400, 2000];
const DEPTH_SCALE_OPTIONS: { value: DepthScalePreset; label: string }[] = [
  { value: 10000, label: "10K" },
  { value: 20000, label: "20K" },
  { value: 50000, label: "50K" },
  { value: "auto", label: "авто" },
];

const toggleClass = (on: boolean) =>
  cn(
    "rounded border px-1.5 py-0.5 font-mono text-[9px] transition",
    on
      ? "border-violet-500/35 bg-violet-950/45 text-violet-100"
      : "border-white/[0.07] bg-[#0a0f18] text-slate-500 hover:text-slate-300",
  );

export function OrderBookLadderSettings({ settings, onChange, compact = false, onRecenter, className }: OrderBookLadderSettingsProps) {
  const patch = (partial: Partial<LadderSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-b border-indigo-500/12 bg-[#030508] px-1.5",
        compact ? "py-0.5" : "px-2 py-1",
        className,
      )}
    >
      <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">Стакан</span>

      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-600">уровней</span>
        {LEVEL_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={toggleClass(settings.levelCount === n)}
            onClick={() => patch({ levelCount: n })}
          >
            {n}
          </button>
        ))}
      </div>

      <span className="h-3 w-px bg-white/[0.06]" />

      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-600">лотность</span>
        {LOT_OPTIONS.map((step) => (
          <button
            key={step}
            type="button"
            className={toggleClass(settings.lotStep === step)}
            onClick={() => patch({ lotStep: step })}
          >
            {step}
          </button>
        ))}
      </div>

      <span className="h-3 w-px bg-white/[0.06]" />

      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-600">масштаб</span>
        {DEPTH_SCALE_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            className={toggleClass(settings.depthScale === opt.value)}
            onClick={() => patch({ depthScale: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <span className="h-3 w-px bg-white/[0.06]" />

      <button
        type="button"
        className={toggleClass(settings.autoCenter)}
        onClick={() => patch({ autoCenter: !settings.autoCenter })}
      >
        автоцентр {settings.autoCenter ? "вкл" : "выкл"}
      </button>
      {onRecenter ? (
        <button type="button" className={toggleClass(false)} onClick={onRecenter}>
          центр
        </button>
      ) : null}
      <button
        type="button"
        className={toggleClass(settings.showProfile)}
        onClick={() => patch({ showProfile: !settings.showProfile })}
      >
        профиль {settings.showProfile ? "вкл" : "выкл"}
      </button>
      <button
        type="button"
        className={toggleClass(settings.showDensities)}
        onClick={() => patch({ showDensities: !settings.showDensities })}
      >
        плотности {settings.showDensities ? "вкл" : "выкл"}
      </button>
    </div>
  );
}
