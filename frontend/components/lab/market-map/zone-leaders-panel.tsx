"use client";

import {
  formatZoneLeaderLine,
  SEMANTIC_ZONE_META,
  type ZoneLeader,
} from "@/lib/domain/market-map-semantics";
import { cn } from "@/lib/utils/cn";

export function ZoneLeadersPanel({ leaders, className }: { leaders: ZoneLeader[]; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl",
        className,
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Лидеры зон</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {leaders.map((leader) => {
          const meta = SEMANTIC_ZONE_META[leader.zoneId];
          return (
            <li
              key={leader.zoneId}
              className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2"
            >
              <p className="text-[11px] font-medium text-slate-300">{meta.title}</p>
              <p className="mt-0.5 font-mono text-[10px] leading-snug text-slate-500">
                {leader.node ? formatZoneLeaderLine(leader) : "нет явного лидера"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
