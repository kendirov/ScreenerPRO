"use client";

import { Flame } from "lucide-react";
import type { MarketDriver } from "@/lib/domain/preparation-events";
import { DRIVER_STATE_LABELS, driverStateToneClass } from "@/lib/domain/preparation-events";
import { cn } from "@/lib/utils/cn";

export function PreparationDriversCompact({
  drivers,
  limit = 3,
  className,
}: {
  drivers: MarketDriver[];
  limit?: number;
  className?: string;
}) {
  const hot = drivers
    .filter((d) => d.state === "active" || d.state === "fading")
    .slice(0, limit);

  return (
    <div className={cn("lab-glass-panel flex h-full flex-col p-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-lab-red/80" />
        <h3 className="text-xs font-semibold text-lab-text">Активные драйверы</h3>
      </div>

      {hot.length === 0 ? (
        <p className="text-[11px] text-lab-muted">Нет горячих тем — смотрим in-play</p>
      ) : (
        <ul className="space-y-1">
          {hot.map((driver) => (
            <li
              key={driver.id}
              className="rounded-md border border-lab-border/50 bg-lab-bg-deep/30 px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-[11px] font-medium text-lab-text">{driver.title}</p>
                <span
                  className={cn(
                    "shrink-0 lab-status-chip px-1 py-px text-[8px]",
                    driverStateToneClass(driver.state),
                  )}
                >
                  {DRIVER_STATE_LABELS[driver.state]}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[9px] text-lab-dim">{driver.whyMatters}</p>
              {driver.affectedInstruments.length > 0 ? (
                <p className="mt-0.5 font-mono text-[9px] text-lab-muted">
                  {driver.affectedInstruments.slice(0, 4).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-2 text-[9px] text-lab-dim">учебная модель · не live-новости</p>
    </div>
  );
}
