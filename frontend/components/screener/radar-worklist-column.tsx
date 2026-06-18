"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import {
  resolveRadarActivityTag,
  type RadarRankContext,
} from "@/lib/domain/market-radar-selectors";
import { RADAR_SECTION } from "@/lib/domain/radar-ui-labels";
import { RADAR_DISPLAY_LIMITS } from "@/components/screener/radar-display-limits";
import { RadarColumnShell } from "@/components/screener/radar-column-shell";
import { RadarMiniRow } from "@/components/screener/radar-mini-row";
import { ScreenerDateModeMessages } from "@/lib/domain/screener-date-mode";

function mergeActivityRows(inPlayRows: ScreenerRow[], activeRows: ScreenerRow[]): ScreenerRow[] {
  const inPlayVisible = inPlayRows.slice(0, RADAR_DISPLAY_LIMITS.inPlay);
  const inPlayTickers = new Set(inPlayVisible.map((row) => row.ticker.toUpperCase()));
  const activeVisible = activeRows.filter((row) => !inPlayTickers.has(row.ticker.toUpperCase()));
  return [...inPlayVisible, ...activeVisible].slice(0, RADAR_DISPLAY_LIMITS.active);
}

export function RadarWorklistColumn({
  inPlayRows,
  activeRows,
  activeCandidateCount,
  inPlayTickerSet,
  rankCtx,
  historicalUnavailable,
  onTickerSelect,
  isSelected,
}: {
  inPlayRows: ScreenerRow[];
  activeRows: ScreenerRow[];
  activeCandidateCount: number;
  inPlayTickerSet: Set<string>;
  rankCtx: RadarRankContext;
  historicalUnavailable: boolean;
  onTickerSelect?: (ticker: string) => void;
  isSelected: (ticker: string) => boolean;
}) {
  const merged = mergeActivityRows(inPlayRows, activeRows);
  const moreInTable = Math.max(0, inPlayRows.length + activeCandidateCount - merged.length);

  return (
    <RadarColumnShell
      title={RADAR_SECTION.activity.title}
      subtitle={RADAR_SECTION.activity.subtitle}
      hint={RADAR_SECTION.activity.hint}
      count={merged.length}
      emphasis
      className="market-radar-column--worklist"
    >
      {historicalUnavailable ? (
        <p className="px-1.5 py-1 text-[10px] text-slate-600">{ScreenerDateModeMessages.historicalBlockNotConnected}</p>
      ) : merged.length === 0 ? (
        <p className="px-1.5 py-1 text-[10px] text-slate-600">—</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-slate-800/40 overflow-hidden">
          {merged.map((row) => {
            const tickerKey = row.ticker.toUpperCase();
            const isHardInPlay = inPlayTickerSet.has(tickerKey);
            const displayTag = resolveRadarActivityTag(row, rankCtx);
            return (
              <li key={row.ticker}>
                <RadarMiniRow
                  row={row}
                  reasonKey="activity"
                  variant="activity"
                  displayTag={displayTag}
                  inPlayBadge={isHardInPlay}
                  inPlayAccent={isHardInPlay}
                  onTickerSelect={onTickerSelect}
                  selected={isSelected(row.ticker)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {moreInTable > 0 ? (
        <p className="shrink-0 border-t border-slate-800/40 px-1 py-0.5 text-center text-[9px] text-slate-500">
          ещё {moreInTable}
        </p>
      ) : null}
    </RadarColumnShell>
  );
}
