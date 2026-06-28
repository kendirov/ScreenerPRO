"use client";

import * as React from "react";
import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  buildFutureInspectorCopy,
  buildInstrumentInspectorCopy,
} from "@/lib/domain/instrument-inspector-copy";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function InstrumentQuickInspector({
  row,
  maxTurnover = 0,
  assetClass = "stock",
  onClose,
  className,
}: {
  row: ScreenerRow | null;
  maxTurnover?: number;
  assetClass?: "stock" | "future";
  onClose?: () => void;
  className?: string;
}) {
  if (!row) return null;

  const copy =
    assetClass === "future" ? buildFutureInspectorCopy(row) : buildInstrumentInspectorCopy(row, maxTurnover);
  const detailHref = assetClass === "future" ? `/futures/${row.ticker}` : `/stocks/${row.ticker}`;

  return (
    <LabGlassPanel depth={20} className={cn("sticky top-[4.5rem] px-3 py-2.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-lab-cyan">{row.ticker}</p>
          <p className="text-[11px] text-lab-dim">{row.shortName}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-[10px] text-lab-dim hover:text-lab-text">
            ✕
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] tabular-nums">
        <span>{tradingFormat.formatDynamicPrice(row.lastPrice)}</span>
        <span className={row.percentChange && row.percentChange > 0 ? "text-emerald-400" : "text-rose-400"}>
          {row.percentChange != null ? tradingFormat.formatSignedPercent(row.percentChange) : "—"}
        </span>
        <span className="text-lab-dim">{tradingFormat.formatTurnoverRub(row.turnover)}</span>
        <span className="text-lab-dim">
          {row.tradesCount ? `${tradingFormat.formatInteger(row.tradesCount)} сд.` : "—"}
        </span>
      </div>

      <p className="mt-2 text-[10px]">
        <span className="text-lab-dim">Статус: </span>
        <span className="text-lab-text">{copy.statusLabel}</span>
      </p>

      {copy.whyLines.length ? (
        <div className="mt-2 space-y-0.5">
          <p className="text-[9px] uppercase tracking-wide text-lab-dim">Почему в списке</p>
          {copy.whyLines.map((line) => (
            <p key={line} className="text-[11px] text-lab-muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {copy.riskLines.length ? (
        <div className="mt-2 space-y-0.5">
          <p className="text-[9px] uppercase tracking-wide text-amber-200/70">Риск для скальпа</p>
          {copy.riskLines.map((line) => (
            <p key={line} className="text-[11px] text-amber-100/85">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {copy.scenarioLine ? (
        <p className="mt-2 text-[10px] text-lab-dim">Сценарий: {copy.scenarioLine}</p>
      ) : null}

      <Link
        href={detailHref}
        className="mt-3 inline-flex text-[11px] text-lab-cyan transition hover:text-lab-text"
      >
        Открыть карточку →
      </Link>
    </LabGlassPanel>
  );
}
