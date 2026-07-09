"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { ScreenerPanel } from "@/components/screener/screener-page-chrome";
import { cn } from "@/lib/utils/cn";
import type { RoundLevel } from "@/lib/strategies/round-levels-engine";
import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import type { RoundLevelEvent } from "@/lib/strategies/round-level-event-engine";
import { STRATEGY_LAB_FIELD_LABELS, formatApproachDirection } from "@/lib/strategies/strategy-lab-labels";
import { formatTechnicalityScore } from "@/lib/strategies/round-level-reaction-engine";
import {
  formatDirectionalPriceRange,
  type DirectionalBufferZone,
} from "@/lib/strategies/round-buffer-direction-engine";
import {
  buildApproachZone,
  eventKindLabelRu,
} from "@/lib/strategies/round-approach-zone-engine";
import { formatStrategyCandleTimeMsk } from "@/lib/strategies/strategy-candles-normalizer";
import type { ZigZagLiteResult } from "@/lib/strategies/zigzag-lite-engine";

function ContextRow({
  label,
  value,
  valueClassName,
  compact = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 font-mono",
        compact ? "text-[9px]" : "text-[10px]",
      )}
    >
      <span className="text-zinc-600">{label}</span>
      <span className={cn("text-right text-lab-text", valueClassName)}>{value}</span>
    </div>
  );
}

function useContextLabels(
  latestApproach: RoundLevelApproachSegment | null,
  latestEvent: RoundLevelEvent | null,
  lastPivot: ZigZagLiteResult["lastPivot"],
  movementDirection: ZigZagLiteResult["movementDirection"] | "unknown",
) {
  const latestDirectionLabel =
    latestApproach == null
      ? latestEvent?.direction === "from_below"
        ? "снизу вверх"
        : latestEvent?.direction === "from_above"
          ? "сверху вниз"
          : "—"
      : latestApproach.direction === "up"
        ? "снизу вверх"
        : "сверху вниз";

  const latestOutcomeLabel =
    latestApproach?.outcome === "bounce"
      ? "отбой"
      : latestApproach?.outcome === "breakout"
        ? "пробой"
        : latestApproach?.outcome === "false_break"
          ? "ложный"
          : latestApproach?.outcome === "chop"
            ? "пила"
            : latestApproach?.outcome === "pending"
              ? "в работе"
              : latestEvent
                ? eventKindLabelRu(latestEvent.eventKind)
                : "—";

  const lastPivotLabel =
    lastPivot == null
      ? "—"
      : `${lastPivot.type === "high" ? "H" : "L"} ${lastPivot.price.toFixed(2)} · ${
          typeof lastPivot.time === "number" ? formatStrategyCandleTimeMsk(lastPivot.time) : lastPivot.time
        }`;

  const swingLabel =
    movementDirection === "up" ? "вверх" : movementDirection === "down" ? "вниз" : "не определён";

  return { latestDirectionLabel, latestOutcomeLabel, lastPivotLabel, swingLabel };
}

function buildCollapsedHudLine(options: {
  selectedLevel: RoundLevel | null;
  levelScore: number | null;
  latestDirectionLabel: string;
  latestEvent: RoundLevelEvent | null;
  directionalBufferZone: DirectionalBufferZone | null;
}): string {
  const { selectedLevel, levelScore, latestDirectionLabel, latestEvent, directionalBufferZone } = options;
  if (!selectedLevel) return "уровень не выбран";

  const parts = [
    selectedLevel.label,
    levelScore != null ? `score ${formatTechnicalityScore(levelScore)}` : null,
    latestDirectionLabel !== "—" ? latestDirectionLabel : null,
    latestEvent ? eventKindLabelRu(latestEvent.eventKind) : null,
    directionalBufferZone
      ? `реакция ${formatDirectionalPriceRange(
          directionalBufferZone.reactionZone.from,
          directionalBufferZone.reactionZone.to,
        )}`
      : null,
    directionalBufferZone
      ? `слом ${formatDirectionalPriceRange(
          directionalBufferZone.breakZone.from,
          directionalBufferZone.breakZone.to,
        )}`
      : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function StrategyLabContextPanel({
  selectedLevel,
  levelScore,
  activeApproachCount,
  latestApproach,
  latestEvent,
  directionalBufferZone,
  bufferWidth,
  approachWidth,
  bufferSource,
  lastPivot,
  movementDirection,
  nearestLevel,
  nearestDistance,
  expanded = false,
  onExpandedChange,
  variant = "panel",
}: {
  selectedLevel: RoundLevel | null;
  levelScore: number | null;
  activeApproachCount: number;
  latestApproach: RoundLevelApproachSegment | null;
  latestEvent?: RoundLevelEvent | null;
  directionalBufferZone: DirectionalBufferZone | null;
  bufferWidth: number | null;
  approachWidth?: number | null;
  bufferSource: "auto" | "manual";
  lastPivot: ZigZagLiteResult["lastPivot"];
  movementDirection: ZigZagLiteResult["movementDirection"] | "unknown";
  nearestLevel: number | null;
  nearestDistance: number | null;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: "panel" | "overlay";
}) {
  const resolvedLatestEvent = latestEvent ?? null;
  const { latestDirectionLabel, latestOutcomeLabel, lastPivotLabel, swingLabel } = useContextLabels(
    latestApproach,
    resolvedLatestEvent,
    lastPivot,
    movementDirection,
  );

  const collapsedLine = buildCollapsedHudLine({
    selectedLevel,
    levelScore,
    latestDirectionLabel,
    latestEvent: resolvedLatestEvent,
    directionalBufferZone,
  });

  const approachZone =
    selectedLevel && approachWidth != null && Number.isFinite(approachWidth)
      ? buildApproachZone(selectedLevel.price, approachWidth)
      : null;

  const expandedBody = (
    <>
      <div className="space-y-1.5 rounded border border-white/[0.06] bg-black/25 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wide text-lab-text">Контекст уровня</h3>
            <p className="mt-1 font-mono text-[10px] text-zinc-600">Выбранный уровень и структура движения</p>
          </div>
          {variant === "overlay" && onExpandedChange ? (
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              className="rounded border border-white/[0.08] p-0.5 text-zinc-500 hover:text-lab-text"
              aria-label="Свернуть контекст"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <ContextRow
          label={STRATEGY_LAB_FIELD_LABELS.selectedLevel}
          value={selectedLevel?.label ?? "—"}
        />
        <ContextRow
          label="Level score"
          value={levelScore != null ? `${formatTechnicalityScore(levelScore)}/100` : "—"}
          valueClassName="text-cyan-200"
        />
        <ContextRow label="Активных подходов" value={String(activeApproachCount)} />
        <ContextRow label="Последний подход" value={latestDirectionLabel} />
        <ContextRow label="Последний исход" value={latestOutcomeLabel} />
        <ContextRow
          label={STRATEGY_LAB_FIELD_LABELS.reactionZone}
          value={
            directionalBufferZone
              ? formatDirectionalPriceRange(
                  directionalBufferZone.reactionZone.from,
                  directionalBufferZone.reactionZone.to,
                )
              : "—"
          }
          valueClassName="text-cyan-200/90"
        />
        <ContextRow
          label={STRATEGY_LAB_FIELD_LABELS.breakZone}
          value={
            directionalBufferZone
              ? formatDirectionalPriceRange(
                  directionalBufferZone.breakZone.from,
                  directionalBufferZone.breakZone.to,
                )
              : "—"
          }
          valueClassName="text-amber-200/85"
        />
        {approachZone ? (
          <ContextRow
            label="Approach zone"
            value={formatDirectionalPriceRange(approachZone.from, approachZone.to)}
            valueClassName="text-zinc-300"
          />
        ) : null}
        <ContextRow
          label="Hard buffer"
          value={bufferWidth != null && Number.isFinite(bufferWidth) ? bufferWidth.toFixed(2) : "—"}
        />
        <ContextRow
          label="Approach width"
          value={approachWidth != null && Number.isFinite(approachWidth) ? approachWidth.toFixed(2) : "—"}
        />
        {resolvedLatestEvent ? (
          <>
            <ContextRow
              label="Last event kind"
              value={eventKindLabelRu(resolvedLatestEvent.eventKind)}
            />
            <ContextRow
              label="Last event time"
              value={formatStrategyCandleTimeMsk(resolvedLatestEvent.time)}
            />
          </>
        ) : null}
        <ContextRow
          label="Источник буфера"
          value={bufferSource === "auto" ? "авто" : "ручной"}
        />
        <ContextRow
          label="Направление к уровню"
          value={formatApproachDirection(directionalBufferZone?.direction ?? null)}
        />
      </div>

      <div className="space-y-2 rounded border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Структура движения</p>
        <ContextRow label="Последний экстремум" value={lastPivotLabel} />
        <ContextRow label="Текущий swing" value={swingLabel} />
        <ContextRow label="Ближайший круглый уровень" value={nearestLevel != null ? String(nearestLevel) : "—"} />
        <ContextRow
          label="Расстояние до уровня"
          value={
            nearestDistance != null && Number.isFinite(nearestDistance)
              ? nearestDistance.toFixed(2)
              : "—"
          }
        />
      </div>
    </>
  );

  if (variant === "overlay") {
    if (!expanded) {
      return (
        <button
          type="button"
          onClick={() => onExpandedChange?.(true)}
          className="absolute left-2 top-11 z-[4] max-w-[calc(100%-1rem)] rounded border border-white/[0.10] bg-[#050b14]/72 px-2 py-1 font-mono text-[9px] text-cyan-100/90 backdrop-blur-[1px] transition-colors hover:border-cyan-800/40 hover:bg-[#050b14]/85"
          title="Развернуть контекст уровня"
        >
          <span className="flex items-center gap-1.5">
            <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{collapsedLine}</span>
          </span>
        </button>
      );
    }

    return (
      <div
        className="absolute left-2 top-11 z-[4] w-[min(100%,18rem)] max-w-[300px] rounded border border-white/[0.10] bg-[#050b14]/78 backdrop-blur-[2px] shadow-lg"
        onMouseLeave={() => onExpandedChange?.(false)}
      >
        <div className="pointer-events-auto space-y-2 p-2">{expandedBody}</div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <ScreenerPanel className="border-white/[0.08] bg-black/45">
        <button
          type="button"
          onClick={() => onExpandedChange?.(true)}
          className="flex w-full items-center gap-2 font-mono text-[10px] text-lab-text"
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate text-left">{collapsedLine}</span>
        </button>
      </ScreenerPanel>
    );
  }

  return (
    <ScreenerPanel className="space-y-3 border-white/[0.08] bg-black/45">
      <button
        type="button"
        onClick={() => onExpandedChange?.(false)}
        className="flex w-full items-center gap-2 font-mono text-[10px] text-zinc-500 hover:text-lab-text"
      >
        <ChevronUp className="h-3.5 w-3.5" />
        <span>Свернуть контекст</span>
      </button>
      {expandedBody}
    </ScreenerPanel>
  );
}
