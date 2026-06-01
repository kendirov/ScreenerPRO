"use client";

import type { QuadHedgePipelineDebug } from "@/lib/domain/quad-hedge/debug";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  "no-candles": "NO CANDLES",
  "request-error": "ERROR",
  stale: "STALE",
  "not-resolved": "NOT RESOLVED",
};

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(11, 16);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(ms));
}

function formatDateKey(iso?: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function QuadHedgeDataDiagnostics({
  debug,
  isLoading,
  className,
}: {
  debug?: QuadHedgePipelineDebug;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <LabGlassPanel
      depth={20}
      className={cn("border-white/[0.05] bg-slate-950/40 px-2.5 py-2", className)}
    >
      <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Диагностика данных</p>

      {isLoading ? (
        <p className="mt-1 text-[10px] text-slate-500">Загрузка pipeline…</p>
      ) : !debug ? (
        <p className="mt-1 text-[10px] text-slate-500">Нет debug-данных.</p>
      ) : (
        <>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse font-mono text-[9px]">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="pb-1 pr-2 font-normal">Base</th>
                  <th className="pb-1 pr-2 font-normal">SECID</th>
                  <th className="pb-1 pr-2 font-normal">interval</th>
                  <th className="pb-1 pr-2 font-normal">candles</th>
                  <th className="pb-1 pr-2 font-normal">pages</th>
                  <th className="pb-1 pr-2 font-normal">first</th>
                  <th className="pb-1 pr-2 font-normal">last</th>
                  <th className="pb-1 pr-2 font-normal">normalized</th>
                  <th className="pb-1 font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {debug.legs.map((leg) => (
                  <tr key={leg.base} className="border-t border-white/[0.04] text-slate-300">
                    <td className="py-0.5 pr-2 text-cyan-400/80">{leg.base}</td>
                    <td className="py-0.5 pr-2">{leg.secid}</td>
                    <td className="py-0.5 pr-2">{leg.usedInterval ?? leg.interval ?? "—"}m</td>
                    <td className="py-0.5 pr-2 tabular-nums">{leg.rawCandlesCount}</td>
                    <td className="py-0.5 pr-2 tabular-nums">{leg.moexPages ?? "—"}</td>
                    <td className="py-0.5 pr-2 tabular-nums">{formatTime(leg.firstCandleTime)}</td>
                    <td className="py-0.5 pr-2 tabular-nums">{formatTime(leg.lastCandleTime)}</td>
                    <td className="py-0.5 pr-2 tabular-nums">{leg.normalizedPointsCount}</td>
                    <td className="py-0.5">{STATUS_LABEL[leg.status] ?? leg.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 font-mono text-[9px] text-slate-500">
            depth {debug.historyDepth ?? "—"} · history {debug.historyMode ?? "—"} · merged{" "}
            {debug.mergedPointsCount}
            {debug.tradingSessionsFound != null ? ` · sessions ${debug.tradingSessionsFound}` : ""}
            {debug.alignedPoints != null ? ` · aligned ${debug.alignedPoints}` : ""}
            {debug.missingPoints != null ? ` · missing ${debug.missingPoints}` : ""}
          </p>
          {debug.missingLegs?.length ? (
            <p className="font-mono text-[9px] text-rose-300/75">
              missing legs: {debug.missingLegs.join(", ")}
            </p>
          ) : null}
          {debug.requestedFrom && debug.requestedTill ? (
            <p className="font-mono text-[9px] text-slate-600">
              requested {debug.requestedFrom} → {debug.requestedTill}
            </p>
          ) : null}
          {debug.legs[0]?.from && debug.legs[0]?.till ? (
            <p className="font-mono text-[9px] text-slate-600">
              actual {formatDateKey(debug.legs[0].firstCandleTime)} →{" "}
              {formatDateKey(debug.legs[0].lastCandleTime)} · MOEX ISS futures/forts
            </p>
          ) : null}
          {debug.moexLimitNotice ? (
            <p className="mt-1 text-[10px] text-amber-300/85">{debug.moexLimitNotice}</p>
          ) : null}
          {debug.summary ? (
            <p className="mt-1 text-[10px] text-amber-300/80">{debug.summary}</p>
          ) : null}
          {debug.mergeNote ? (
            <p className="mt-0.5 text-[10px] text-amber-300/75">{debug.mergeNote}</p>
          ) : null}
        </>
      )}
    </LabGlassPanel>
  );
}

export function quadHedgePipelineMessage(
  debug: QuadHedgePipelineDebug | undefined,
): string | null {
  if (!debug) return null;

  const parts = debug.legs.map((l) => `${l.base}: ${l.rawCandlesCount} свечей`);
  parts.push(`merged points: ${debug.mergedPointsCount}`);
  if (debug.alignedPoints != null) parts.push(`aligned: ${debug.alignedPoints}`);
  if (debug.missingPoints != null) parts.push(`missing: ${debug.missingPoints}`);

  const okCount = debug.legs.filter((l) => l.status === "ok").length;
  if (okCount < 2) {
    return `${parts.join(" · ")}. Нужны минимум два фьючерса с данными.`;
  }
  if (debug.mergedPointsCount < 2 && okCount >= 2) {
    return `${parts.join(" · ")}. merged points: 0 — проверь window filter или timestamps.`;
  }
  if (debug.mergedPointsCount >= 2) return null;

  return debug.summary ?? parts.join(" · ");
}

/** Показать баннер ограниченной истории MOEX. */
export function isSpreadLabHistoryLimited(
  debug: QuadHedgePipelineDebug | undefined,
  alignedPoints?: number,
  historyDepth?: import("@/lib/domain/quad-hedge/spread-lab-config").SpreadLabHistoryDepth,
): boolean {
  if (!debug) return false;
  if (debug.moexLimitNotice) return true;
  if (debug.legs.some((l) => l.moexLimitNotice)) return true;

  const sessions = debug.tradingSessionsFound ?? debug.tradingSessions?.length ?? 0;
  const aligned = alignedPoints ?? debug.alignedPoints ?? 0;

  if (historyDepth === "1S") return sessions < 1 || aligned < 50;
  if (historyDepth === "3S") return sessions < 3 || aligned < 150;
  if (historyDepth === "7S") return sessions < 7 || aligned < 350;
  if (aligned > 0 && aligned < 800) return true;
  return false;
}

export const SPREAD_LAB_HISTORY_LIMITED_MESSAGE =
  "История ограничена MOEX ISS. Для стабильной глубокой истории нужен local collector.";
