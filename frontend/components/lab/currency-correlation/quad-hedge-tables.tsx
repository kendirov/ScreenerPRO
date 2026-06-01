"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  buildQuadHedgeTablesModel,
  type QuadHedgeDivergenceTableRow,
  type QuadHedgeLegTableRow,
  type QuadHedgeTablesModel,
} from "@/lib/domain/quad-hedge/tables-model";
import type { QuadHedgeAnalyticsResult } from "@/lib/domain/quad-hedge";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import { tradingFormat } from "@/lib/formatters/trading";
import type { ScreenerRow } from "@screenerpro/shared";
import { cn } from "@/lib/utils/cn";
import * as React from "react";

function fmtNum(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(v);
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return tradingFormat.formatSignedPercent(v);
}

function fmtSigned(v: number | null, suffix = ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtNum(v)}${suffix}`;
}

function fmtTurnover(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return tradingFormat.formatTurnoverRub(v);
}

function pctTone(v: number | null): string {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.04) return "text-slate-400";
  return v > 0 ? "text-emerald-300/90" : "text-rose-300/90";
}

function zTone(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return "text-slate-500";
  const abs = Math.abs(z);
  if (abs >= 2) return "text-rose-300/95";
  if (abs >= 1.5) return "text-violet-200/90";
  if (abs >= 1) return "text-amber-200/85";
  return "text-cyan-200/80";
}

function signalTone(signal: string): string {
  if (signal.includes("STRONG")) return "text-rose-300/90";
  if (signal === "DIVERGENCE") return "text-violet-200/90";
  if (signal === "WATCH") return "text-amber-200/85";
  if (signal === "CONFIRMATION") return "text-emerald-300/90";
  if (signal === "NO DATA") return "text-slate-500";
  return "text-slate-400";
}

const TH = "px-2 py-1.5 text-left text-[8px] font-medium uppercase tracking-[0.12em] text-slate-600";
const TD = "px-2 py-1 font-mono text-[10px] tabular-nums text-slate-300/90";

function LegsTable({ rows }: { rows: QuadHedgeLegTableRow[] }) {
  return (
    <div className="max-h-[min(42vh,320px)] overflow-auto rounded-md border border-white/[0.05]">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md">
          <tr className="border-b border-white/[0.06]">
            <th className={TH}>Связка</th>
            <th className={TH}>Инструмент</th>
            <th className={TH}>Цена</th>
            <th className={TH}>Δ%</th>
            <th className={TH}>Norm%</th>
            <th className={TH}>High</th>
            <th className={TH}>Low</th>
            <th className={TH}>Range</th>
            <th className={TH}>Оборот</th>
            <th className={TH}>Время</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.channelLabel}
              className={cn(
                "border-b border-white/[0.03] transition-colors",
                !row.hasData && "text-slate-600 opacity-70",
                row.hasData && "hover:bg-white/[0.02]",
              )}
            >
              <td className={cn(TD, "text-[9px] text-violet-200/75")}>{row.channelLabel}</td>
              <td className={cn(TD, "max-w-[120px] truncate text-slate-200")} title={row.instrumentLabel}>
                <span>{row.instrumentLabel}</span>
                {row.refInstrumentLabel ? (
                  <span className="block truncate text-[8px] text-slate-600">
                    ref {row.refInstrumentLabel}
                  </span>
                ) : null}
              </td>
              <td className={TD}>{fmtNum(row.price, 4)}</td>
              <td className={cn(TD, pctTone(row.changePct))}>{fmtPct(row.changePct)}</td>
              <td className={cn(TD, pctTone(row.normalizedPct))}>{fmtPct(row.normalizedPct)}</td>
              <td className={TD}>{fmtNum(row.high, 4)}</td>
              <td className={TD}>{fmtNum(row.low, 4)}</td>
              <td className={TD}>{row.rangePct != null ? `${fmtNum(row.rangePct)}%` : "—"}</td>
              <td className={cn(TD, "text-[9px]")}>{fmtTurnover(row.turnoverRub)}</td>
              <td className={cn(TD, "text-[9px] text-cyan-400/70")}>{row.timestampLabel ?? "—"}</td>
              <td className={cn(TD, "text-[9px] uppercase text-slate-500")}>{row.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DivergenceTable({ rows }: { rows: QuadHedgeDivergenceTableRow[] }) {
  return (
    <div className="max-h-[min(36vh,260px)] overflow-auto rounded-md border border-white/[0.05]">
      <table className="w-full min-w-[680px] border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md">
          <tr className="border-b border-white/[0.06]">
            <th className={TH}>Pair</th>
            <th className={TH}>Spread</th>
            <th className={TH}>Z</th>
            <th className={TH}>Corr</th>
            <th className={TH}>Direction</th>
            <th className={TH}>Dur</th>
            <th className={TH}>Signal</th>
            <th className={TH}>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.pairKey}
              className={cn(
                "border-b border-white/[0.03]",
                !row.hasData && "opacity-65",
                row.hasData && "hover:bg-white/[0.02]",
              )}
            >
              <td className={cn(TD, "text-violet-200/80")}>{row.pairLabel}</td>
              <td className={cn(TD, pctTone(row.spreadPp))}>
                {row.spreadPp != null ? `${fmtSigned(row.spreadPp)} pp` : "—"}
              </td>
              <td className={cn(TD, zTone(row.zScore))}>
                {row.zScore != null ? fmtNum(row.zScore, 2) : "—"}
              </td>
              <td className={TD}>{row.correlation != null ? fmtNum(row.correlation, 2) : "—"}</td>
              <td className={cn(TD, "text-[9px] text-slate-400")}>{row.direction ?? "—"}</td>
              <td className={TD}>{row.durationBars != null && row.durationBars > 0 ? row.durationBars : "—"}</td>
              <td className={cn(TD, "text-[9px] font-semibold uppercase", signalTone(row.signal))}>
                {row.signal}
              </td>
              <td className="max-w-[220px] px-2 py-1 text-[9px] leading-snug text-slate-400">
                {row.interpretation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuadHedgeTables({
  model,
  intradayEnabled,
}: {
  model: QuadHedgeTablesModel | null;
  intradayEnabled: boolean;
}) {
  if (!intradayEnabled) {
    return (
      <LabGlassPanel depth={10} className="px-3 py-2 text-[10px] text-slate-500">
        Таблицы ног и расхождений доступны в режиме <span className="text-cyan-400/80">Интрадей</span>.
      </LabGlassPanel>
    );
  }

  if (!model) {
    return (
      <LabGlassPanel depth={10} className="px-3 py-2 text-[10px] text-slate-500">
        Загрузка таблиц квадрохеджа…
      </LabGlassPanel>
    );
  }

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      <LabGlassPanel depth={10} className="px-2.5 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Ноги связки
        </p>
        <LegsTable rows={model.legs} />
      </LabGlassPanel>

      <LabGlassPanel depth={10} className="px-2.5 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Расхождения
        </p>
        <DivergenceTable rows={model.divergences} />
      </LabGlassPanel>
    </div>
  );
}

export function useQuadHedgeTablesModel(
  intraday: IntradayCurrencyResponse | undefined,
  screenerRows: ScreenerRow[],
  analytics: QuadHedgeAnalyticsResult | null,
  screenerSource: "MOEX ISS" | "demo" | undefined,
  enabled: boolean,
): QuadHedgeTablesModel | null {
  return React.useMemo(() => {
    if (!enabled) return null;
    return buildQuadHedgeTablesModel({
      intradayInstruments: intraday?.instruments,
      screenerRows,
      analytics,
      screenerSource,
    });
  }, [enabled, intraday?.instruments, screenerRows, analytics, screenerSource]);
}
