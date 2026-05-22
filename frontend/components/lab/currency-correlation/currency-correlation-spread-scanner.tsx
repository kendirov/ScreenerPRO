"use client";

import type {
  SpreadScannerCard,
  SpreadScannerModel,
  SpreadScannerSensitivity,
} from "@/lib/domain/currency-correlation-spread-scanner";
import {
  SCANNER_SENSITIVITY_LABELS,
  zScaleTone,
  zScoreScalePercent,
} from "@/lib/domain/currency-correlation-spread-scanner";
import { SPREAD_LIFECYCLE_THRESHOLDS } from "@/lib/domain/spread-lifecycle";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const SENSITIVITY_OPTIONS: Array<{ id: SpreadScannerSensitivity; label: string }> = (
  ["soft", "standard", "strict"] as const
).map((id) => ({
  id,
  label: SCANNER_SENSITIVITY_LABELS[id],
}));

const STATUS_TONE: Record<SpreadScannerCard["status"], string> = {
  спокойно: "border-slate-600/40 bg-slate-950/50 text-slate-400",
  наблюдение: "border-amber-500/25 bg-amber-950/20 text-amber-200/90",
  расхождение: "border-orange-500/30 bg-orange-950/25 text-orange-200",
  "сильное расхождение": "border-violet-500/35 bg-violet-950/30 text-violet-200",
  "—": "border-slate-700/40 bg-slate-950/40 text-slate-500",
};

const SCALE_DOT: Record<ReturnType<typeof zScaleTone>, string> = {
  neutral: "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.5)]",
  watch: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]",
  alert: "bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.65)]",
};

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function StretchScale({ z }: { z: number | null }) {
  const pct = zScoreScalePercent(z);
  const tone = zScaleTone(z);

  return (
    <div className="mt-3 space-y-1">
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/[0.06]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400/50" aria-hidden />
        <div className="absolute inset-y-0 left-[12.5%] w-px bg-amber-500/20" aria-hidden />
        <div className="absolute inset-y-0 left-[87.5%] w-px bg-amber-500/20" aria-hidden />
        <div className="absolute inset-y-0 left-[5%] w-px bg-violet-500/15" aria-hidden />
        <div className="absolute inset-y-0 left-[95%] w-px bg-violet-500/15" aria-hidden />
        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20",
            SCALE_DOT[tone],
          )}
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-slate-600">
        <span>−2σ</span>
        <span>0</span>
        <span>+2σ</span>
      </div>
    </div>
  );
}

function ScannerCardView({
  card,
  unitMode,
}: {
  card: SpreadScannerCard;
  unitMode: SpreadUnitMode;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-3 backdrop-blur-xl",
        card.available ? "border-white/[0.08]" : "border-dashed border-white/[0.05] opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-sm font-semibold text-slate-100">{card.label}</h3>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-wide",
            STATUS_TONE[card.status],
          )}
        >
          {card.status}
        </span>
      </div>

      {!card.available ? (
        <p className="mt-3 text-xs text-slate-500">Нет общих свечей MOEX для этой пары</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <dt className="text-slate-600">Спред</dt>
            <dd className="text-right font-mono tabular-nums text-slate-100">
              {formatUnitValueShort(card.currentSpread, unitMode)}
            </dd>
            <dt className="text-slate-600">Отклонение</dt>
            <dd className="text-right font-mono tabular-nums text-cyan-200/90">
              {fmtZ(card.currentZ)}
            </dd>
            <dt className="text-slate-600">Направление</dt>
            <dd className="text-right text-slate-300">{card.direction}</dd>
            <dt className="text-slate-600">Последняя свеча</dt>
            <dd className="text-right font-mono text-[10px] text-slate-400">
              {card.lastCandleLabel}
            </dd>
            <dt className="text-slate-600">Свечей в расчёте</dt>
            <dd className="text-right font-mono tabular-nums text-slate-400">
              {card.candlesInCalc}
            </dd>
          </dl>
          <StretchScale z={card.currentZ} />
          <p className="mt-2 text-[10px] text-slate-600">Растяжение спреда относительно окна z</p>
        </>
      )}
    </article>
  );
}

export function CurrencyCorrelationSpreadScanner({
  model,
  sensitivity,
  onSensitivityChange,
  compact,
  unitMode = "raw-points",
}: {
  model: SpreadScannerModel | null;
  sensitivity: SpreadScannerSensitivity;
  onSensitivityChange: (s: SpreadScannerSensitivity) => void;
  compact?: boolean;
  unitMode?: SpreadUnitMode;
}) {
  if (!model) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-950/15 via-slate-950/90 to-slate-950/80 backdrop-blur-xl",
        compact ? "space-y-2 p-2.5" : "space-y-3 p-4",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={cn("font-semibold tracking-tight text-slate-100", compact ? "text-xs" : "text-sm")}>
            Спред-сканер
          </h2>
          {!compact ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Где сейчас растянут spread между валютными фьючерсами (MOEX ISS, beta 1:1)
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Чувствительность
          </span>
          {SENSITIVITY_OPTIONS.map((opt) => {
            const th = SPREAD_LIFECYCLE_THRESHOLDS[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSensitivityChange(opt.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition",
                  sensitivity === opt.id
                    ? "border-violet-500/40 bg-violet-950/50 text-violet-100"
                    : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
                )}
                title={`растяжение ${th.stretch} · экстрим ${th.extreme} · невозврат ${th.breakdown}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {!model.hasData ? (
        <p className="rounded-lg border border-dashed border-white/[0.08] bg-black/20 px-4 py-6 text-center text-sm text-slate-500">
          Недостаточно интрадей-свечей для сканера. Дождитесь данных MOEX или расширьте период.
        </p>
      ) : (
        <div className={cn("grid md:grid-cols-3", compact ? "gap-2" : "gap-3")}>
          {model.cards.map((card) => (
            <ScannerCardView key={card.pairKey} card={card} unitMode={unitMode} />
          ))}
        </div>
      )}
    </section>
  );
}
