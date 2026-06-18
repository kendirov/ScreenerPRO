"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { resolveRadarVolatilityTag, type RadarRankContext } from "@/lib/domain/market-radar-selectors";
import { RADAR_SECTION } from "@/lib/domain/radar-ui-labels";
import { RADAR_DISPLAY_LIMITS } from "@/components/screener/radar-display-limits";
import { RadarColumnShell } from "@/components/screener/radar-column-shell";
import { RadarMiniRow } from "@/components/screener/radar-mini-row";
import { ScreenerDateModeMessages } from "@/lib/domain/screener-date-mode";

export function RadarShotsColumn({
  rows,
  rankCtx,
  historicalUnavailable,
  onTickerSelect,
  isSelected,
}: {
  rows: ScreenerRow[];
  rankCtx: RadarRankContext;
  historicalUnavailable: boolean;
  onTickerSelect?: (ticker: string) => void;
  isSelected: (ticker: string) => boolean;
}) {
  const visible = rows.slice(0, RADAR_DISPLAY_LIMITS.shots);

  return (
    <RadarColumnShell
      title={RADAR_SECTION.volatility.title}
      subtitle={RADAR_SECTION.volatility.subtitle}
      hint={RADAR_SECTION.volatility.hint}
      count={visible.length}
      className="market-radar-column--volatility"
    >
      {historicalUnavailable ? (
        <p className="px-1.5 py-1 text-[10px] text-slate-600">{ScreenerDateModeMessages.historicalBlockNotConnected}</p>
      ) : visible.length === 0 ? (
        <p className="px-1.5 py-1 text-[10px] text-slate-600">—</p>
      ) : (
        <ul className="divide-y divide-slate-800/40">
          {visible.map((row) => {
            const displayTag = resolveRadarVolatilityTag(row, rankCtx);
            return (
              <li key={row.ticker}>
                <RadarMiniRow
                  row={row}
                  reasonKey="wideRange"
                  variant="volatility"
                  displayTag={displayTag}
                  onTickerSelect={onTickerSelect}
                  selected={isSelected(row.ticker)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </RadarColumnShell>
  );
}
