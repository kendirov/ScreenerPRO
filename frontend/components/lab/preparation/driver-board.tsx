"use client";

import { Zap } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import { DEMO_MARKET_DRIVERS } from "@/lib/domain/preparation-demo-data";
import {
  DRIVER_BOARD_COLUMN_LABELS,
  DRIVER_STATE_LABELS,
  driverStateToneClass,
  groupDriversByColumn,
  type DriverBoardColumn,
  type MarketDriver,
} from "@/lib/domain/preparation-events";
import { cn } from "@/lib/utils/cn";

const COLUMN_ORDER: DriverBoardColumn[] = ["hot", "fading", "potential", "sleeping"];

export function DriverBoard({
  mode,
  className,
}: {
  mode: BriefingMode;
  className?: string;
}) {
  const columns = groupDriversByColumn(DEMO_MARKET_DRIVERS);

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <div className="relative">
        <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-violet/90">
          <Zap className="h-3.5 w-3.5" />
          Драйверы сейчас
        </LabSectionHeading>
        <p className="text-[11px] text-lab-muted">
          {mode === "day"
            ? "Кто двигает рынок сегодня — по статусу чувствительности, не по календарю."
            : "Недельная карта тем: что горячо, что остывает, что может проснуться."}
        </p>
        <p className="mt-1 text-[10px] text-lab-amber/85">Учебная модель · не автоматический анализ рынка</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {COLUMN_ORDER.map((columnKey) => (
          <DriverColumn
            key={columnKey}
            columnKey={columnKey}
            title={DRIVER_BOARD_COLUMN_LABELS[columnKey]}
            drivers={columns[columnKey]}
          />
        ))}
      </div>
    </section>
  );
}

function DriverColumn({
  columnKey,
  title,
  drivers,
}: {
  columnKey: DriverBoardColumn;
  title: string;
  drivers: MarketDriver[];
}) {
  const columnAccent = {
    hot: "border-lab-red/25 from-lab-red/6",
    fading: "border-lab-amber/25 from-lab-amber/6",
    potential: "border-lab-cyan/20 from-lab-cyan/5",
    sleeping: "border-lab-border/80 from-transparent",
  }[columnKey];

  return (
    <div
      className={cn(
        "lab-glass-card min-h-[140px] border bg-gradient-to-b to-transparent p-2",
        columnAccent,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-lab-text">{title}</p>
        <span className="font-mono text-[10px] text-lab-dim">{drivers.length}</span>
      </div>

      {drivers.length === 0 ? (
        <p className="text-[11px] text-lab-dim">— пусто</p>
      ) : (
        <ul className="space-y-1.5">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DriverCard({ driver }: { driver: MarketDriver }) {
  return (
    <li className="rounded-md border border-lab-border/60 bg-lab-bg-deep/40 px-2 py-1.5">
      <div className="flex flex-wrap items-start justify-between gap-1">
        <p className="text-[11px] font-medium text-lab-text">{driver.title}</p>
        <span className={cn("lab-status-chip px-1 py-px text-[8px]", driverStateToneClass(driver.state))}>
          {DRIVER_STATE_LABELS[driver.state]}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-lab-muted">{driver.whyMatters}</p>
      {driver.affectedInstruments.length > 0 ? (
        <p className="mt-1 font-mono text-[9px] text-lab-dim">
          {driver.affectedInstruments.join(" · ")}
        </p>
      ) : null}
      {driver.lastReaction ? (
        <p className="mt-1 text-[9px] italic text-lab-dim">{driver.lastReaction}</p>
      ) : null}
    </li>
  );
}
