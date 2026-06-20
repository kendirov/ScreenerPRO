"use client";

import { Users } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge, StatusChip } from "@/components/ui/metrics-minimalism";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import {
  CBR_EVENT_PLAYER_SIGNAL_LABELS,
  countEventPlayers,
  formatCbrEventPlayerRangePct,
  getCbrEventPlayersSnapshot,
  type CbrEventPlayerRow,
  type CbrEventPlayersSection,
} from "@/lib/domain/cbr-rate-event-players";
import { cbrDataStatusLabel } from "@/lib/domain/cbr-rate-reaction";
import { cn } from "@/lib/utils/cn";

export function CbrRateEventPlayersPanel({
  event,
  focusedTicker,
  onSelectTicker,
}: {
  event: CbrRateEvent;
  focusedTicker?: string | null;
  onSelectTicker?: (ticker: string) => void;
}) {
  const snapshot = getCbrEventPlayersSnapshot(event);
  const total = countEventPlayers(snapshot);
  const isMock = snapshot.source === "mock";

  return (
    <LabGlassPanel depth={20} className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border/45 px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-lab-violet/80" />
          <h3 className="text-[11px] font-semibold text-lab-text">Кто был в игре в день ставки</h3>
          <DataStatusBadge
            kind={isMock ? "fallback" : "live"}
            label={snapshot.sourceLabel}
            className="text-[8px]"
          />
          {total > 0 ? (
            <span className="font-mono text-[9px] text-lab-dim">{total} инстр.</span>
          ) : null}
        </div>
        <p className="text-[9px] text-lab-dim">Словарь ScreenerPRO · отдельно от Market Radar</p>
      </div>

      {snapshot.emptyReason ? (
        <p className="px-3 py-3 text-[11px] text-lab-muted">{snapshot.emptyReason}</p>
      ) : (
        <div className="grid gap-px bg-lab-border/25 lg:grid-cols-2 xl:grid-cols-3">
          {snapshot.sections.map((sec) => (
            <PlayersSection
              key={sec.id}
              section={sec}
              focusedTicker={focusedTicker}
              onSelectTicker={onSelectTicker}
              isMock={isMock}
            />
          ))}
        </div>
      )}

      <p className="border-t border-lab-border/35 px-3 py-1.5 text-[9px] text-lab-dim">
        Критерии: топ оборота · волатильность · всплеск сделок · реакция 13:30 / 15:00. Клик — фокус на графике.
      </p>
    </LabGlassPanel>
  );
}

function PlayersSection({
  section,
  focusedTicker,
  onSelectTicker,
  isMock,
}: {
  section: CbrEventPlayersSection;
  focusedTicker?: string | null;
  onSelectTicker?: (ticker: string) => void;
  isMock: boolean;
}) {
  if (!section.players.length) {
    return (
      <div className="bg-lab-bg-deep/20 px-3 py-2">
        <p className="text-[9px] uppercase tracking-[0.1em] text-lab-dim">{section.title}</p>
        <p className="mt-1 text-[10px] text-lab-dim">—</p>
      </div>
    );
  }

  return (
    <div className="bg-lab-bg-deep/20 px-2 py-2">
      <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-lab-dim">{section.title}</p>
      <ul className="space-y-1">
        {section.players.map((player) => (
          <PlayerRow
            key={player.ticker}
            player={player}
            selected={focusedTicker === player.ticker}
            onSelect={() => onSelectTicker?.(player.ticker)}
            isMock={isMock}
          />
        ))}
      </ul>
    </div>
  );
}

function PlayerRow({
  player,
  selected,
  onSelect,
  isMock,
}: {
  player: CbrEventPlayerRow;
  selected: boolean;
  onSelect: () => void;
  isMock: boolean;
}) {
  const isLive = player.dataStatus === "live";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
          selected
            ? "border-lab-cyan/40 bg-lab-cyan/10"
            : "border-lab-border/35 bg-lab-bg-deep/30 hover:border-lab-border/55 hover:bg-lab-bg-deep/50",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-semibold text-lab-text">{player.ticker}</span>
            <span className="ml-1.5 truncate text-[10px] text-lab-muted">{player.name}</span>
          </div>
          <StatusChip label={player.reactionTag} tone="neutral" className="shrink-0 text-[7px]" />
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] tabular-nums text-lab-dim">
          <span>оборот {player.turnover}</span>
          <span>сделки {player.trades}</span>
          <span>range {formatCbrEventPlayerRangePct(player.rangePct)}</span>
        </div>

        <p className="mt-1 text-[10px] leading-snug text-lab-muted">{player.whyInPlay}</p>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {player.signals.slice(0, 3).map((sig) => (
            <span
              key={sig}
              className="rounded border border-lab-border/40 px-1 py-px text-[7px] uppercase tracking-wide text-lab-dim"
            >
              {CBR_EVENT_PLAYER_SIGNAL_LABELS[sig]}
            </span>
          ))}
          <DataStatusBadge
            kind={isLive ? "live" : "fallback"}
            label={isLive ? "MOEX" : isMock ? "mock" : cbrDataStatusLabel(player.dataStatus)}
            className="ml-auto text-[7px]"
          />
        </div>
      </button>
    </li>
  );
}
