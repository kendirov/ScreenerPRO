"use client";

import type { SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";
import {
  formatLots,
  isLargeWall,
  type ActiveFlash,
  type DomGridLineKind,
  type DomLevelTooltipData,
  type LadderRowHeight,
  volumeBarAlpha,
} from "@/lib/domain/order-book-ladder-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

const ROW_HEIGHT_PX: Record<LadderRowHeight, number> = {
  15: 15,
  16: 16,
  18: 18,
  22: 22,
};

const LARGE_TOOLTIP = "Крупная лимитная заявка";
const ICEBERG_TOOLTIP = "Видимый объём восстановился после исполнения — модель айсберга.";

function DomRowTooltip({
  data,
  icebergExecuted,
}: {
  data: DomLevelTooltipData;
  icebergExecuted?: number;
}) {
  return (
    <div className="pointer-events-none absolute left-0 top-full z-50 mt-0.5 hidden min-w-[210px] rounded border border-white/10 bg-[#0a0c10] p-2 text-left font-mono text-[9px] leading-relaxed text-slate-300 shadow-xl group-hover/domrow:block">
      <p className="text-sky-300">Цена: {formatPrice(data.price)}</p>
      <p>
        Объём ({data.side}): {data.volume > 0 ? formatLots(data.volume) : "—"}
      </p>
      <p className="text-slate-500">
        {data.pctOfScale.toFixed(1)}% от масштаба ({formatLots(data.depthScale)})
      </p>
      <p>Крупная плотность: {data.isLarge ? "да" : "нет"}</p>
      <p>Круглый уровень: {data.isRoundLevel ? "да" : "нет"}</p>
      <p>Айсберг: {data.side === "ask" ? (data.askIceberg ? "да" : "нет") : data.bidIceberg ? "да" : "нет"}</p>
      {icebergExecuted != null && icebergExecuted > 0 ? (
        <p className="text-violet-300/90">Исполнено (скрытый резерв): {formatLots(icebergExecuted)}</p>
      ) : null}
      <p>Маркетмейкер: {data.isMarketMaker ? "да" : "нет"}</p>
      {data.aggressorHint ? (
        <p className="text-amber-200/90">
          Исполнено: {data.aggressorHint === "buy" ? "рыночная покупка" : "рыночная продажа"}
        </p>
      ) : null}
    </div>
  );
}

function PrintDot({ flashes, side }: { flashes: ActiveFlash[]; side: "ask" | "bid" }) {
  if (flashes.length === 0) return null;
  const latest = flashes[0]!;
  const isBuy = latest.aggressorSide === "buy";
  const opacity = Math.max(0.35, 1 - latest.ageMs / 600);

  return (
    <span
      className={cn(
        "dom-print-flash inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        side === "ask"
          ? isBuy
            ? "bg-rose-300"
            : "bg-rose-600/70"
          : isBuy
            ? "bg-emerald-600/70"
            : "bg-emerald-300",
      )}
      style={{ opacity }}
    />
  );
}

export type DomLadderRowProps = {
  level: SimOrderBookLevel;
  side: "ask" | "bid";
  rowHeight: LadderRowHeight;
  depthScale: number;
  depthPct: number;
  isBestTouch: boolean;
  gridLine: DomGridLineKind;
  flashes: ActiveFlash[];
  showRoundPrints: boolean;
  icebergPulse: boolean;
  tapeHighlight?: boolean;
  tapeHighlightStrong?: boolean;
  teachingHighlight?: boolean;
  teachingHighlightStrong?: boolean;
  selected?: boolean;
  tooltip: DomLevelTooltipData;
  icebergExecuted?: number;
  hovered: boolean;
  onHover: (price: number | null) => void;
  onSelect?: () => void;
};

export function DomLadderRow({
  level,
  side,
  rowHeight,
  depthScale: _depthScale,
  depthPct,
  isBestTouch,
  gridLine,
  flashes,
  showRoundPrints,
  icebergPulse,
  tapeHighlight = false,
  tapeHighlightStrong = false,
  teachingHighlight = false,
  teachingHighlightStrong = false,
  selected = false,
  tooltip,
  icebergExecuted,
  hovered,
  onHover,
  onSelect,
}: DomLadderRowProps) {
  const isAsk = side === "ask";
  const size = isAsk ? level.askSize : level.bidSize;
  const isIceberg = isAsk ? level.askIsIceberg : level.bidIsIceberg;
  const isLarge = isLargeWall(size, isAsk ? level.askIsLarge : level.bidIsLarge);
  const ratio = depthPct / 100;
  const barAlpha = volumeBarAlpha(ratio);
  const hasHit = flashes.length > 0;
  const h = ROW_HEIGHT_PX[rowHeight];
  const gridKind = gridLine;

  const barColor = isLarge
    ? `rgba(245, 158, 11, ${Math.min(0.72, barAlpha + 0.22)})`
    : isAsk
      ? `rgba(190, 24, 93, ${barAlpha})`
      : `rgba(5, 150, 105, ${barAlpha})`;

  const volumeLabel = size > 0 ? formatLots(size) : "";
  const showMicro = showRoundPrints || isIceberg;

  return (
    <div
      className={cn(
        "group/domrow relative grid items-stretch font-mono text-[9px] leading-none",
        showMicro ? "grid-cols-[9px_minmax(0,1fr)_46px]" : "grid-cols-[minmax(0,1fr)_46px]",
        isAsk ? "dom-row-ask" : "dom-row-bid",
        isBestTouch && (isAsk ? "dom-row-best-ask" : "dom-row-best-bid"),
        isLarge && "dom-row-wall",
        gridKind === "tick10" && "dom-grid-tick10",
        gridKind === "round" && "dom-grid-round",
        level.isRoundLevel && gridKind !== "round" && "dom-row-psycho",
        hasHit && (isAsk ? "dom-hit-ask" : "dom-hit-bid"),
        tapeHighlight && (isAsk ? "dom-tape-highlight-ask" : "dom-tape-highlight-bid"),
        tapeHighlightStrong && "dom-tape-highlight-strong",
        teachingHighlight && "dom-teaching-highlight",
        teachingHighlightStrong && "dom-teaching-highlight-strong",
        selected && "dom-row-selected",
        icebergPulse && "dom-iceberg-pulse",
        onSelect && "cursor-pointer",
      )}
      style={{ height: h, minHeight: h, maxHeight: h }}
      onMouseEnter={() => onHover(level.price)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect?.()}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {hovered ? <DomRowTooltip data={tooltip} icebergExecuted={icebergExecuted} /> : null}

      {showMicro ? (
        <div className="flex flex-col items-center justify-center gap-px opacity-90">
          {level.isMarketMakerLevel ? (
            <span className="text-[6px] font-semibold leading-none text-cyan-400/90" title="Маркетмейкерская заявка (модель)">
              MM
            </span>
          ) : null}
          {showRoundPrints ? <PrintDot flashes={flashes} side={side} /> : null}
          {isIceberg ? (
            <span className="text-[6px] leading-none text-violet-400" title={ICEBERG_TOOLTIP}>
              ice
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative flex min-w-0 items-center overflow-hidden pr-0.5">
        {size > 0 ? (
          <>
            <div
              className={cn(
                "absolute inset-y-0 right-0",
                isLarge ? "dom-bar-wall" : isAsk ? "dom-bar-ask" : "dom-bar-bid",
                hasHit && (isAsk ? "dom-depth-flash-ask" : "dom-depth-flash-bid"),
              )}
              style={{ width: `${depthPct}%`, backgroundColor: barColor }}
            />
            <span
              className={cn(
                "relative z-[1] truncate pl-0.5 tabular-nums",
                isLarge ? "font-semibold text-amber-100" : isAsk ? "text-rose-200/92" : "text-emerald-300/92",
              )}
              title={isLarge ? LARGE_TOOLTIP : isIceberg ? ICEBERG_TOOLTIP : undefined}
            >
              {volumeLabel}
            </span>
          </>
        ) : (
          <span className="pl-0.5 text-[9px] text-slate-800/70">·</span>
        )}
      </div>

      <span
        className={cn(
          "flex items-center justify-end pr-1 tabular-nums tracking-tight",
          isBestTouch
            ? isAsk
              ? "font-semibold text-rose-50"
              : "font-semibold text-emerald-50"
            : isAsk
              ? "text-rose-200/85"
              : "text-emerald-200/85",
          gridKind === "round" && "text-slate-100/90",
        )}
      >
        {formatPrice(level.price)}
      </span>
    </div>
  );
}
