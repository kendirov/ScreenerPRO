"use client";

import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { getCbrEventPlayersSnapshot } from "@/lib/domain/cbr-rate-event-players";

/** Одна строка — топ инструментов «в игре» для accordion. */
export function CbrRateEventPlayersCompact({ event }: { event: CbrRateEvent }) {
  const snapshot = getCbrEventPlayersSnapshot(event);

  if (snapshot.emptyReason) {
    return <p className="text-[10px] text-lab-muted">{snapshot.emptyReason}</p>;
  }

  const flat = snapshot.sections.flatMap((s) =>
    s.players.map((p) => ({ ...p, section: s.title })),
  );

  if (!flat.length) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {flat.slice(0, 8).map((p) => (
        <li
          key={p.ticker}
          className="rounded border border-lab-border/40 bg-lab-bg-deep/40 px-2 py-1 text-[10px]"
        >
          <span className="font-mono font-medium text-lab-cyan">{p.ticker}</span>
          <span className="ml-1 text-lab-muted">{p.reactionTag}</span>
        </li>
      ))}
    </ul>
  );
}
