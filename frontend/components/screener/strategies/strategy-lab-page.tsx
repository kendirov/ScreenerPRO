"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  StrategyCandlestickChart,
  type StrategyChartDiagnostics,
  type StrategyChartRuntimeDiagnostics,
  type StrategyOverlayDiagnostics,
} from "@/components/strategies/strategy-candlestick-chart";
import { StrategyChartRuntimeDebugPanel } from "@/components/strategies/strategy-chart-runtime-debug-panel";
import { StrategyChartBrowserParityDebugPanel } from "@/components/strategies/strategy-chart-browser-parity-debug-panel";
import { StrategyLabStrategyNav } from "@/components/screener/strategies/strategy-lab-strategy-nav";
import { StrategyLabHeader } from "@/components/screener/strategies/strategy-lab-header";
import { StrategyLabCompactControls } from "@/components/screener/strategies/strategy-lab-compact-controls";
import { StrategyLabContextPanel } from "@/components/screener/strategies/strategy-lab-context-panel";
import { StrategyLabBottomTabs } from "@/components/screener/strategies/strategy-lab-bottom-tabs";
import { StrategyLabSettingsPanel } from "@/components/screener/strategies/strategy-lab-settings-panel";
import {
  useStrategyCandles,
} from "@/lib/hooks/use-strategy-candles";
import { ScreenerPanel } from "@/components/screener/screener-page-chrome";
import {
  STRATEGY_LOAD_STATE_LABEL,
  STRATEGY_DEFAULT_BOARD,
} from "@/lib/screener/strategies/strategy-candles";
import {
  buildStrategyLabAiMarkdown,
  buildStrategyLabJsonExport,
  DEFAULT_STRATEGY_LAB_LAYER_MODES,
  DEFAULT_STRATEGY_LAB_PERIOD,
  DEFAULT_STRATEGY_LAB_TIMEFRAME,
  DEFAULT_STRATEGY_LAB_VISIBLE_RANGE,
  isStrategyLabStrategyId,
  layerModesToLegacyFlags,
  saveStrategyLabSnapshot,
  loadStrategyLabSnapshot,
  STRATEGY_LAB_SNAPSHOT_VERSION,
  STRATEGY_LAB_EXPORT_SCHEMA_VERSION,
  type StrategyLabExportContext,
  type StrategyLabLayerModes,
  type StrategyLabStrategyId,
} from "@/lib/strategies/strategy-lab-ux";
import {
  formatStrategyCandlesSummary,
  hashStrategyCandles,
  type StrategyCandlePeriodId,
} from "@/lib/screener/strategies/strategy-candle-range";
import {
  candlePriceRangeFromCandles,
  computeStrategyLevelsFromCandles,
  filterRoundLevelsForDisplay,
  findDefaultSelectedLevelPrice,
} from "@/lib/strategies/strategy-levels-display";
import type { RoundLevel } from "@/lib/strategies/round-levels-engine";
import {
  analyzeRoundLevelReactions,
  formatBounceRate,
  formatTechnicalityScore,
  type RoundLevelApproach,
  type RoundLevelReactionResult,
  type RoundLevelTechnicalityStats,
  type RoundLevelTouchEvent,
} from "@/lib/strategies/round-level-reaction-engine";
import {
  filterTouchesForChartMarkers,
  isPreliminaryReactionStats,
  MAX_REACTION_CHART_MARKERS,
  MAX_REACTION_CHART_MARKERS_ALL,
  reactionTotalsFromResult,
  selectedLevelTouchCount,
} from "@/lib/strategies/strategy-reaction-display";
import {
  formatLevelImportance,
  formatReactionType,
  formatTouchesShort,
  STRATEGY_LAB_FIELD_LABELS,
} from "@/lib/strategies/strategy-lab-labels";
import { formatStrategyCandleTimeMsk } from "@/lib/strategies/strategy-candles-normalizer";
import { createEmptyStrategyChartRuntimeDiagnostics } from "@/lib/strategies/strategy-chart-runtime-diagnostics";
import type { StrategyChartDebugState } from "@/lib/strategies/strategy-chart-runtime-diagnostics";
import {
  bumpStrategyLabPageMountCount,
  collectStrategyBrowserParityDiagnostics,
  createEmptyStrategyBrowserParityDiagnostics,
  ensureStrategyLabRuntimeMarker,
  getStrategyChartMountCount,
  getStrategyLabRuntimeVersion,
  reloadStrategyLabChartFresh,
  resetStrategyLabStateAndReload,
  type StrategyBrowserParityDiagnostics,
} from "@/lib/strategies/strategy-chart-browser-parity";
import { createSyntheticCandles } from "@/lib/strategies/strategy-chart-test-data";
import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import { resolveLevelBufferSize, type BufferDisplayMode } from "@/lib/strategies/strategy-buffer-zone-overlay";
import {
  buildDirectionalBufferZone,
  inferApproachDirectionToLevel,
  resolveActiveDirectionalBuffer,
  type ApproachDirection,
  type DirectionalBufferZone,
} from "@/lib/strategies/round-buffer-direction-engine";
import {
  computeRoundLevelApproaches,
  countApproachesForLevel,
  latestApproachForLevel,
  type RoundLevelApproachSegment,
} from "@/lib/strategies/round-level-approach-engine";
import {
  computeSessionBoxes,
  type SessionBox,
  type SessionPreset,
} from "@/lib/strategies/session-box-engine";
import {
  computeZigZagLite,
  nearestRoundLevelDistance,
  type ZigZagLiteResult,
} from "@/lib/strategies/zigzag-lite-engine";
import { MAX_ZIGZAG_CHART_MARKERS } from "@/lib/strategies/strategy-zigzag-display";
import {
  computeApproachWidth,
  DEFAULT_APPROACH_FACTOR_MODE,
  DEFAULT_CONTEXT_HUD_EXPANDED,
  DEFAULT_SHOW_NEAR_MISS,
  type ApproachFactorMode,
} from "@/lib/strategies/round-approach-zone-engine";
import {
  buildRecentLevelEvents,
  latestEventForLevel,
} from "@/lib/strategies/round-level-event-engine";
import { cn } from "@/lib/utils/cn";

type StrategyChartDebugSource = "moex" | "synthetic";
type AnalysisPresetId = "quick" | "normal" | "deep";
type ZigZagDisplayMode = "off" | "important" | "all";
type ReactionMarkerMode = "selected" | "all";

const CHART_HEIGHT =
  "h-[420px] md:h-[540px] lg:h-[clamp(650px,74vh,820px)]";

function formatMetricNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatPercentCompact(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatBarsCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value)}св`;
}

function formatVolumeRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `x${value.toFixed(1)}`;
}

function formatTouchApproachLine(approach: RoundLevelApproach): string {
  if (approach === "from_above") return "сверху вниз";
  if (approach === "from_below") return "снизу вверх";
  return "внутри зоны";
}

function technicalityBadge(score: number): { label: string; tone: "cyan" | "amber" | "danger" | "default" } {
  if (score >= 80) return { label: "отлично", tone: "cyan" };
  if (score >= 65) return { label: "хорошо", tone: "cyan" };
  if (score >= 45) return { label: "средне", tone: "amber" };
  return { label: "шумно", tone: "danger" };
}

function scoreBadgeExplanation(summary: RoundLevelReactionResult["summary"] | null): string {
  if (!summary) return "оценка пока предварительная: данных для объяснения мало";
  const score = summary.instrumentTechnicalityScore;
  if (score >= 80) {
    return "отлично: инструмент часто и чисто реагирует на уровни, шум низкий";
  }
  if (score >= 65) {
    return summary.falseBreakRate >= 0.2
      ? "хорошо: инструмент часто реагирует на уровни, но есть ложные пробои"
      : "хорошо: реакции на уровни заметны, хотя стабильность ещё не идеальна";
  }
  if (score >= 45) {
    return summary.chopRate >= 0.3
      ? "средне: реакции есть, но часть касаний уходит в пилу"
      : "средне: уровни работают неравномерно, сигнал смешан";
  }
  return "шумно: много неоднозначных реакций, уровни держатся нестабильно";
}

function strongSidesText(summary: RoundLevelReactionResult["summary"] | null): string {
  if (!summary) return "Сильные стороны: данных пока мало";
  const points: string[] = [];
  if (summary.totalTouches >= 25) points.push("много касаний");
  else if (summary.totalTouches >= 10) points.push("достаточная выборка");

  if (summary.scoreComponents.speed >= 80) points.push("быстрые реакции");
  if (summary.scoreComponents.lowChop >= 75) points.push("малый шум");
  if (summary.scoreComponents.clarity >= 70) points.push("чистые реакции");
  if (summary.bestLevels.length > 0) {
    points.push(`сильные уровни ${summary.bestLevels.map((level) => level.level).join(" / ")}`);
  }

  if (points.length === 0) points.push("локальные реакции на части уровней");
  return `Сильные стороны: ${points.join(", ")}`;
}

function weakSpotText(summary: RoundLevelReactionResult["summary"] | null, levels: RoundLevelTechnicalityStats[]): string {
  if (summary) {
    if (summary.falseBreakRate >= 0.25) {
      return `Слабое место: ложные пробои ${Math.round(summary.falseBreakRate * 100)}%`;
    }
    if (summary.chopRate >= 0.35) {
      return `Слабое место: пила ${Math.round(summary.chopRate * 100)}%`;
    }
    if (summary.scoreComponents.sample <= 40) {
      return "Слабое место: пока мало касаний для уверенной статистики";
    }
    if (summary.scoreComponents.speed <= 45) {
      return "Слабое место: реакции формируются медленно";
    }
  }

  const halfLevelChop = levels.filter((level) => String(level.level).includes(".5"));
  const noisyHalfLevels = halfLevelChop.filter((level) => level.chopRate >= 0.4);
  if (noisyHalfLevels.length > 0) {
    return "Слабое место: много пилы на полууровнях";
  }
  const noisiest = [...levels].sort((a, b) => b.chopRate - a.chopRate)[0];
  if (noisiest && noisiest.chopRate >= 0.35) {
    return `Слабое место: пила у уровня ${noisiest.level}`;
  }
  return "Слабое место: выраженной шумной зоны пока не видно";
}

function levelsHash(levels: RoundLevel[]): string {
  if (levels.length === 0) return "0";
  return levels.map((level) => `${level.price}:${level.importance}`).join("|");
}

function reactionIntervalForTimeframe(timeframe: StrategyTimeframeMinutes): 5 | 10 | 30 {
  if (timeframe === 30 || timeframe === 60) return 30;
  if (timeframe === 15) return 10;
  return 5;
}

function reactionWindowForPreset(
  preset: AnalysisPresetId,
  timeframe: StrategyTimeframeMinutes,
): number {
  if (preset === "deep") return 12;
  if (preset === "normal") return 8;
  if (timeframe === 60 || timeframe === 30) return 4;
  if (timeframe === 15) return 5;
  return 6;
}

function filterLevelsNearPrice(levels: RoundLevel[], currentPrice: number | null, maxCount = 18): RoundLevel[] {
  if (currentPrice == null || !Number.isFinite(currentPrice)) return levels.slice(0, maxCount);
  return [...levels]
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, maxCount)
    .sort((a, b) => a.price - b.price);
}

function filterLevelsWithPadding(levels: RoundLevel[], range: ReturnType<typeof candlePriceRangeFromCandles>): RoundLevel[] {
  if (!range) return levels;
  const span = Math.max(range.maxPrice - range.minPrice, range.currentPrice * 0.03);
  const padding = span * 0.25;
  const min = range.minPrice - padding;
  const max = range.maxPrice + padding;
  return levels.filter((level) => level.price >= min && level.price <= max);
}

function overlayDiagnosticsEqual(
  prev: StrategyOverlayDiagnostics,
  next: StrategyOverlayDiagnostics,
): boolean {
  return (
    prev.priceLineCount === next.priceLineCount &&
    prev.bufferZoneCount === next.bufferZoneCount &&
    prev.skippedNullCoords === next.skippedNullCoords &&
    prev.rectCount === next.rectCount &&
    prev.markerCount === next.markerCount &&
    prev.selectedPriceY === next.selectedPriceY &&
    prev.selectedUpperY === next.selectedUpperY &&
    prev.selectedLowerY === next.selectedLowerY &&
    prev.bufferDisplayMode === next.bufferDisplayMode &&
    prev.zonesRendered === next.zonesRendered &&
    prev.zonesSkipped === next.zonesSkipped &&
    prev.approachDirection === next.approachDirection &&
    prev.reactionZoneValues === next.reactionZoneValues &&
    prev.breakZoneValues === next.breakZoneValues
  );
}

function chartDiagnosticsEqual(prev: StrategyChartDiagnostics, next: StrategyChartDiagnostics): boolean {
  return prev.chartWidth === next.chartWidth && prev.chartHeight === next.chartHeight;
}

function runtimeDiagnosticsEqual(
  prev: StrategyChartRuntimeDiagnostics,
  next: StrategyChartRuntimeDiagnostics,
): boolean {
  return (
    prev.source === next.source &&
    prev.overlayIsolation === next.overlayIsolation &&
    prev.containerWidth === next.containerWidth &&
    prev.containerHeight === next.containerHeight &&
    prev.containerReady === next.containerReady &&
    prev.chartCreated === next.chartCreated &&
    prev.chartReady === next.chartReady &&
    prev.canvasCount === next.canvasCount &&
    prev.canvasBitmapWidth === next.canvasBitmapWidth &&
    prev.canvasBitmapHeight === next.canvasBitmapHeight &&
    prev.canvasCssWidth === next.canvasCssWidth &&
    prev.canvasCssHeight === next.canvasCssHeight &&
    prev.candlestickSeriesCreated === next.candlestickSeriesCreated &&
    prev.seriesReady === next.seriesReady &&
    prev.dataReady === next.dataReady &&
    prev.dataApplied === next.dataApplied &&
    prev.setDataCalled === next.setDataCalled &&
    prev.setDataCandlesLength === next.setDataCandlesLength &&
    prev.setDataCallCount === next.setDataCallCount &&
    prev.lastSetDataReason === next.lastSetDataReason &&
    prev.skippedSetDataReason === next.skippedSetDataReason &&
    prev.selfHealAttempts === next.selfHealAttempts &&
    prev.recreateAttempts === next.recreateAttempts &&
    prev.seriesDataLength === next.seriesDataLength &&
    prev.lastValueDataNoData === next.lastValueDataNoData &&
    prev.lastValuePrice === next.lastValuePrice &&
    prev.baseCandlesVisible === next.baseCandlesVisible &&
    prev.priceLinesCount === next.priceLinesCount &&
    prev.bufferZonesCount === next.bufferZonesCount &&
    prev.markersCount === next.markersCount &&
    prev.overlaysGateBlocked === next.overlaysGateBlocked &&
    prev.userZoomed === next.userZoomed &&
    prev.barSpacing === next.barSpacing &&
    prev.lastFitReason === next.lastFitReason &&
    prev.createSeriesError === next.createSeriesError &&
    prev.setDataError === next.setDataError &&
    prev.invalidTimeOhlcCount === next.invalidTimeOhlcCount &&
    prev.errors.length === next.errors.length &&
    prev.errors.every((value, index) => value === next.errors[index])
  );
}

function chartDebugStateEqual(
  prev: StrategyChartDebugState & { chartReadyRevision: number },
  next: StrategyChartDebugState & { chartReadyRevision: number },
): boolean {
  return (
    prev.chartReadyRevision === next.chartReadyRevision &&
    prev.containerReady === next.containerReady &&
    prev.chartCreated === next.chartCreated &&
    prev.chartReady === next.chartReady &&
    prev.candlestickSeriesCreated === next.candlestickSeriesCreated &&
    prev.seriesReady === next.seriesReady &&
    prev.dataReady === next.dataReady &&
    prev.dataApplied === next.dataApplied &&
    prev.baseVisible === next.baseVisible &&
    prev.setDataCalled === next.setDataCalled &&
    prev.setDataCandlesLength === next.setDataCandlesLength &&
    prev.setDataCallCount === next.setDataCallCount &&
    prev.lastSetDataAt === next.lastSetDataAt &&
    prev.lastSetDataReason === next.lastSetDataReason &&
    prev.skippedSetDataReason === next.skippedSetDataReason &&
    prev.selfHealAttempts === next.selfHealAttempts &&
    prev.recreateAttempts === next.recreateAttempts &&
    prev.fitContentCalled === next.fitContentCalled &&
    prev.userZoomed === next.userZoomed &&
    prev.barSpacing === next.barSpacing &&
    prev.lastFitReason === next.lastFitReason &&
    prev.createSeriesError === next.createSeriesError &&
    prev.setDataError === next.setDataError
  );
}

function reactionStatsMap(result: RoundLevelReactionResult | null): Map<number, RoundLevelTechnicalityStats> {
  return new Map((result?.stats ?? []).map((stat) => [stat.level, stat]));
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "cyan" | "amber" | "danger";
}) {
  const valueClass =
    tone === "cyan"
      ? "text-cyan-200"
      : tone === "amber"
        ? "text-amber-200"
        : tone === "danger"
          ? "text-rose-200/80"
          : "text-lab-text";

  return (
    <div className="rounded border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className={cn("mt-1 font-mono text-sm tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

function ScoreComponentCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const tone =
    value >= 80 ? "text-cyan-200" : value >= 65 ? "text-lab-text" : value >= 45 ? "text-amber-200/85" : "text-rose-200/80";
  return (
    <div className="rounded border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className={cn("mt-1 font-mono text-sm tabular-nums", tone)}>{Math.round(value)}/100</p>
    </div>
  );
}

function InstrumentTechnicalitySummary({
  reactionResult,
  candleCount,
  sessionBoxes,
}: {
  reactionResult: RoundLevelReactionResult | null;
  candleCount: number;
  sessionBoxes: SessionBox[];
}) {
  const summary = reactionResult?.summary ?? null;
  const isPreliminary =
    summary != null &&
    (Boolean(summary.sampleWarning) ||
      isPreliminaryReactionStats(candleCount, summary.totalTouches));
  const badge = technicalityBadge(summary?.instrumentTechnicalityScore ?? 0);
  const scoreExplanation = scoreBadgeExplanation(summary);
  const strongSides = strongSidesText(summary);
  const weakSides = weakSpotText(summary, reactionResult?.stats ?? []);
  const avgSessionRangePct =
    sessionBoxes.length > 0
      ? sessionBoxes.reduce((sum, box) => sum + box.rangePct, 0) / sessionBoxes.length
      : null;
  const widestSession =
    sessionBoxes.length > 0
      ? sessionBoxes.reduce((best, box) => (best == null || box.rangePct > best.rangePct ? box : best), null as SessionBox | null)
      : null;

  return (
    <ScreenerPanel className="space-y-3 border-white/[0.08] bg-black/45">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wide text-lab-text">
            Сводка техничности
          </h3>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">
            Инструмент и круглые уровни в текущем диапазоне
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded border border-cyan-800/35 bg-cyan-950/20 px-2.5 py-1 font-mono text-[11px] text-cyan-100">
            Техничность: {summary ? `${formatTechnicalityScore(summary.instrumentTechnicalityScore)}/100` : "0/100"}
          </div>
          <div
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide",
              badge.tone === "cyan" && "border-cyan-800/35 bg-cyan-950/20 text-cyan-200",
              badge.tone === "amber" && "border-amber-500/20 bg-amber-500/10 text-amber-200/85",
              badge.tone === "danger" && "border-rose-500/20 bg-rose-500/10 text-rose-200/80",
              badge.tone === "default" && "border-white/[0.08] bg-black/25 text-lab-text",
            )}
          >
            {badge.label}
          </div>
        </div>
        <p className="max-w-[440px] font-mono text-[10px] text-zinc-500">{scoreExplanation}</p>
        {isPreliminary ? (
          <p className="max-w-[360px] rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-200/85">
            {summary?.sampleWarning ?? "Статистика предварительная: мало истории"}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
        <MetricCard
          label="Оценка техничности"
          value={formatTechnicalityScore(summary?.instrumentTechnicalityScore ?? 0)}
          tone="cyan"
        />
        <MetricCard label="Касаний" value={String(summary?.totalTouches ?? 0)} />
        <MetricCard label="Сессий" value={String(sessionBoxes.length)} />
        <MetricCard label="Отбой %" value={formatPercentCompact(summary?.bounceRate)} tone="cyan" />
        <MetricCard label="Пробой %" value={formatPercentCompact(summary?.breakoutRate)} tone="danger" />
        <MetricCard label="Ложный пробой %" value={formatPercentCompact(summary?.falseBreakRate)} tone="amber" />
        <MetricCard label="Пила %" value={formatPercentCompact(summary?.chopRate)} tone="danger" />
        <MetricCard label="Ср. отскок" value={formatMetricNumber(summary?.avgBounce)} tone="cyan" />
        <MetricCard label="Ср. нырок" value={formatMetricNumber(summary?.avgDive)} tone="amber" />
        <MetricCard
          label="Средний диапазон сессии"
          value={avgSessionRangePct != null ? `${avgSessionRangePct.toFixed(1)}%` : "—"}
        />
        <MetricCard
          label="Самая широкая сессия"
          value={widestSession ? `${widestSession.date.slice(5)} · ${widestSession.rangePct.toFixed(1)}%` : "—"}
        />
        <MetricCard
          label="Среднее время реакции"
          value={formatBarsCompact(
            reactionResult?.stats.length
              ? reactionResult.stats.reduce((sum, stat) => sum + stat.avgBarsToDecision, 0) / reactionResult.stats.length
              : null,
          )}
        />
      </div>
      <div className="space-y-2 rounded border border-white/[0.06] bg-black/20 px-2.5 py-2.5">
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-wide text-lab-text">
            Почему такая оценка
          </h4>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">
            Те же компоненты, из которых считается итоговый `instrumentTechnicalityScore`
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <ScoreComponentCard label="Уровни" value={summary?.scoreComponents.levels ?? 0} />
          <ScoreComponentCard label="Выборка" value={summary?.scoreComponents.sample ?? 0} />
          <ScoreComponentCard label="Чистота реакций" value={summary?.scoreComponents.clarity ?? 0} />
          <ScoreComponentCard label="Мало пилы" value={summary?.scoreComponents.lowChop ?? 0} />
          <ScoreComponentCard label="Скорость" value={summary?.scoreComponents.speed ?? 0} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="rounded border border-white/[0.06] bg-black/25 px-2.5 py-2 font-mono text-[10px] text-zinc-300">
          {strongSides}
        </div>
        <div className="rounded border border-white/[0.06] bg-black/25 px-2.5 py-2 font-mono text-[10px] text-amber-100/80">
          {weakSides}
        </div>
      </div>
    </ScreenerPanel>
  );
}

function LevelStatsTable({
  levels,
  selectedLevelPrice,
  onSelectLevel,
}: {
  levels: Array<{ level: RoundLevel; stats: RoundLevelTechnicalityStats | null }>;
  selectedLevelPrice: number | null;
  onSelectLevel: (price: number | null) => void;
}) {
  return (
    <ScreenerPanel className="space-y-3 border-white/[0.08] bg-black/45">
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-wide text-lab-text">Таблица уровней</h3>
        <p className="mt-1 font-mono text-[10px] text-zinc-600">
          Выбранный уровень сверху, затем сортировка по technicality score
        </p>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded border border-white/[0.06]">
        <table className="min-w-full border-collapse font-mono text-[10px]">
          <thead className="sticky top-0 bg-[#09111c] text-zinc-500">
            <tr className="border-b border-white/[0.06]">
              <th className="px-2 py-2 text-left font-medium">Уровень</th>
              <th className="px-2 py-2 text-left font-medium">Тип</th>
              <th className="px-2 py-2 text-right font-medium">Кас.</th>
              <th className="px-2 py-2 text-right font-medium">Отбой</th>
              <th className="px-2 py-2 text-right font-medium">Пробой</th>
              <th className="px-2 py-2 text-right font-medium">Ложный</th>
              <th className="px-2 py-2 text-right font-medium">Пила</th>
              <th className="px-2 py-2 text-right font-medium">Ср. отскок</th>
              <th className="px-2 py-2 text-right font-medium">Ср. нырок</th>
              <th className="px-2 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {levels.map(({ level, stats }) => {
              const isSelected =
                selectedLevelPrice != null && Math.abs(selectedLevelPrice - level.price) < 1e-6;
              return (
                <tr
                  key={level.price}
                  className={cn(
                    "cursor-pointer border-b border-white/[0.04] text-lab-muted transition hover:bg-white/[0.03] hover:text-lab-text",
                    isSelected && "bg-cyan-950/20 text-cyan-100",
                  )}
                  onClick={() => onSelectLevel(level.price)}
                >
                  <td className="px-2 py-2 tabular-nums text-lab-text">{level.label}</td>
                  <td className="px-2 py-2">{formatLevelImportance(level.importance)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{stats?.touches ?? 0}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-cyan-200">
                    {formatPercentCompact(stats?.bounceRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-rose-200/80">
                    {formatPercentCompact(stats?.breakoutRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-200/85">
                    {formatPercentCompact(stats?.falseBreakRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-100/70">
                    {formatPercentCompact(stats?.chopRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-cyan-200">
                    {formatMetricNumber(stats?.avgMaxBounceAbs)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-200/85">
                    {formatMetricNumber(stats?.avgMaxDiveAbs)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-lab-text">
                    {formatTechnicalityScore(stats?.technicalityScore ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ScreenerPanel>
  );
}

function SelectedLevelTouchEvents({
  level,
  touches,
  selectedTouchEventId,
  markersCapped,
  onSelectTouchEvent,
}: {
  level: RoundLevel | null;
  touches: RoundLevelTouchEvent[];
  selectedTouchEventId: string | null;
  markersCapped: boolean;
  onSelectTouchEvent: (touch: RoundLevelTouchEvent) => void;
}) {
  return (
    <ScreenerPanel className="space-y-3 border-white/[0.08] bg-black/45">
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-wide text-lab-text">
          Лента касаний выбранного уровня
        </h3>
        <p className="mt-1 font-mono text-[10px] text-zinc-600">
          {level ? `Уровень ${level.label}` : "Выберите уровень в таблице"}
        </p>
        {markersCapped ? (
          <p className="mt-1 font-mono text-[10px] text-amber-200/85">
            На графике показаны последние 80 событий выбранного уровня
          </p>
        ) : null}
      </div>

      {!level ? (
        <p className="font-mono text-[10px] text-zinc-600">Выберите уровень в таблице ниже</p>
      ) : touches.length === 0 ? (
        <p className="font-mono text-[10px] text-zinc-600">По уровню {level.label} касаний нет</p>
      ) : (
        <div className="max-h-[24rem] space-y-1 overflow-auto">
          {touches.map((touch) => (
            <button
              key={touch.id}
              type="button"
              onClick={() => onSelectTouchEvent(touch)}
              className={cn(
                "block w-full rounded border px-2.5 py-2 text-left font-mono text-[10px] text-lab-muted transition",
                selectedTouchEventId === touch.id
                  ? "border-cyan-800/45 bg-cyan-950/20 text-cyan-100"
                  : "border-white/[0.06] bg-black/25 hover:border-white/[0.10] hover:bg-white/[0.03] hover:text-lab-text",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="tabular-nums text-lab-text">
                  {formatStrategyCandleTimeMsk(touch.touchTime)}
                </span>
                <span>·</span>
                <span>{formatTouchApproachLine(touch.approach)}</span>
                <span>·</span>
                <span
                  className={cn(
                    touch.outcome === "bounce" && "text-cyan-200",
                    touch.outcome === "false_break" && "text-amber-200/85",
                    touch.outcome === "breakout" && "text-rose-200/80",
                    touch.outcome === "chop" && "text-zinc-400",
                  )}
                >
                  {formatReactionType(touch.outcome)}
                </span>
                <span>·</span>
                <span>нырок {formatMetricNumber(touch.maxDiveAbs)}</span>
                <span>·</span>
                <span className="text-cyan-200">отскок {formatMetricNumber(touch.maxBounceAbs)}</span>
                <span>·</span>
                <span>{formatBarsCompact(touch.barsToDecision)}</span>
                <span>·</span>
                <span className="text-cyan-200/90">показать на графике</span>
                {touch.volumeRatio != null ? (
                  <>
                    <span>·</span>
                    <span>объём {formatVolumeRatio(touch.volumeRatio)}</span>
                  </>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </ScreenerPanel>
  );
}

function StrategyDebugStrip({
  rawCount,
  normalizedCount,
  invalidCount,
  duplicateTimeCount,
  firstTime,
  lastTime,
  daysLoaded,
  fetchRequestCount,
  periodLabel,
  chartSize,
  totalLevels,
  visibleLevels,
  selectedLevelPrice,
  priceLineCount,
  bufferZoneCount,
  skippedNullCoords,
  bufferSize,
  touchesTotal,
  markersCount,
  zigzagPivotCount,
  zigzagMarkerCount,
  zigzagMovementDirection,
  selectedLevelTouches,
  canvasWidth,
  canvasHeight,
  layoutMode,
  chartFocusMode,
  selectedPriceY,
  selectedUpperY,
  selectedLowerY,
  bufferDisplayMode,
  zonesRendered,
  zonesSkipped,
  approachDirection,
  reactionZoneValues,
  breakZoneValues,
}: {
  rawCount: number;
  normalizedCount: number;
  invalidCount: number;
  duplicateTimeCount: number;
  firstTime?: number;
  lastTime?: number;
  daysLoaded?: number;
  fetchRequestCount?: number;
  periodLabel: string;
  chartSize: StrategyChartDiagnostics;
  totalLevels: number;
  visibleLevels: number;
  selectedLevelPrice: number | null;
  priceLineCount: number;
  bufferZoneCount: number;
  skippedNullCoords: number;
  bufferSize: number | null;
  touchesTotal: number;
  markersCount: number;
  zigzagPivotCount: number;
  zigzagMarkerCount: number;
  zigzagMovementDirection: string;
  selectedLevelTouches: number;
  canvasWidth: number | null;
  canvasHeight: number | null;
  layoutMode: "desktop" | "mobile";
  chartFocusMode: boolean;
  selectedPriceY: number | null;
  selectedUpperY: number | null;
  selectedLowerY: number | null;
  bufferDisplayMode: BufferDisplayMode;
  zonesRendered: number;
  zonesSkipped: number;
  approachDirection: string;
  reactionZoneValues: string | null;
  breakZoneValues: string | null;
}) {
  const width = chartSize.chartWidth > 0 ? chartSize.chartWidth : 0;
  const height = chartSize.chartHeight > 0 ? chartSize.chartHeight : 0;
  const firstLabel = firstTime != null ? formatStrategyCandleTimeMsk(firstTime) : "—";
  const lastLabel = lastTime != null ? formatStrategyCandleTimeMsk(lastTime) : "—";
  const selectedLabel =
    selectedLevelPrice != null && Number.isFinite(selectedLevelPrice)
      ? String(selectedLevelPrice)
      : "—";
  const bufferLabel =
    bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0
      ? bufferSize.toFixed(2)
      : "—";
  const canvasLabel =
    canvasWidth != null && canvasHeight != null ? `${Math.round(canvasWidth)}x${Math.round(canvasHeight)}` : "—";
  const coordsLabel =
    selectedPriceY != null && selectedUpperY != null && selectedLowerY != null
      ? `${Math.round(selectedUpperY)} / ${Math.round(selectedPriceY)} / ${Math.round(selectedLowerY)}`
      : "—";

  return (
    <div className="space-y-0.5 font-mono text-[10px] text-zinc-500">
      <p>
        candles raw {rawCount} → normalized {normalizedCount} · invalid {invalidCount} · duplicates{" "}
        {duplicateTimeCount} · period {periodLabel} · days {daysLoaded ?? "—"} · fetch requests{" "}
        {fetchRequestCount ?? "—"} · chart {width}x{height} · first {firstLabel} · last {lastLabel}
      </p>
      <p>
        levels total {totalLevels} · visible {visibleLevels} · selected {selectedLabel} · priceLines{" "}
        {priceLineCount}
      </p>
      <p>
        buffer mode {bufferDisplayMode} · zones rendered {zonesRendered} · zones skipped {zonesSkipped} ·
        approach {approachDirection} · reaction {reactionZoneValues ?? "—"} · break {breakZoneValues ?? "—"}
      </p>
      <p>
        buffer zones {bufferZoneCount} · skipped null coords {skippedNullCoords} · selected {selectedLabel}{" "}
        · buffer {bufferLabel}
      </p>
      <p>
        touches total {touchesTotal} · markers {markersCount} · zigzag pivots {zigzagPivotCount} · zigzag markers{" "}
        {zigzagMarkerCount} · move {zigzagMovementDirection} · selected level touches {selectedLevelTouches}
      </p>
      <p>
        canvas {canvasLabel} · layout {layoutMode} · chart focus {chartFocusMode ? "on" : "off"}
      </p>
      <p>selected y upper/price/lower {coordsLabel}</p>
    </div>
  );
}

export function StrategyLabPage() {
  const searchParams = useSearchParams();
  const hasMounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const chartDebug = searchParams.get("screenerChartDebug") === "1";
  const routeMountedAtRef = React.useRef(typeof window === "undefined" ? "" : new Date().toISOString());
  const [routeMountCount] = React.useState(() =>
    typeof window === "undefined" ? 0 : bumpStrategyLabPageMountCount(),
  );
  const [parityDiagnostics, setParityDiagnostics] = React.useState<StrategyBrowserParityDiagnostics>(
    () => createEmptyStrategyBrowserParityDiagnostics(),
  );
  const [chartDebugState, setChartDebugState] = React.useState<
    (StrategyChartDebugState & { chartReadyRevision: number }) | null
  >(null);
  const dataRevisionRef = React.useRef(0);
  const [chartSize, setChartSize] = React.useState<StrategyChartDiagnostics>({
    chartWidth: 0,
    chartHeight: 0,
  });
  const layoutRef = React.useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = React.useState<"desktop" | "mobile">("mobile");
  const [runtimeDiagnostics, setRuntimeDiagnostics] = React.useState<StrategyChartRuntimeDiagnostics>(
    () => createEmptyStrategyChartRuntimeDiagnostics(chartDebug ? "synthetic" : "moex", chartDebug),
  );
  const [overlayDiagnostics, setOverlayDiagnostics] = React.useState<StrategyOverlayDiagnostics>({
    priceLineCount: 0,
    bufferZoneCount: 0,
    skippedNullCoords: 0,
    rectCount: 0,
    markerCount: 0,
    selectedPriceY: null,
    selectedUpperY: null,
    selectedLowerY: null,
    bufferDisplayMode: "active",
    zonesRendered: 0,
    zonesSkipped: 0,
    approachDirection: null,
    reactionZoneValues: null,
    breakZoneValues: null,
  });
  const [chartDebugSource, setChartDebugSource] = React.useState<StrategyChartDebugSource>(
    chartDebug ? "synthetic" : "moex",
  );
  const [layerModes, setLayerModes] = React.useState<StrategyLabLayerModes>(DEFAULT_STRATEGY_LAB_LAYER_MODES);
  const [sessionPreset, setSessionPreset] = React.useState<SessionPreset>("moex_stocks");
  const [draftSecid, setDraftSecid] = React.useState("GAZP");
  const [loadedSecid, setLoadedSecid] = React.useState("GAZP");
  const [timeframe, setTimeframe] = React.useState<StrategyTimeframeMinutes>(DEFAULT_STRATEGY_LAB_TIMEFRAME);
  const [period, setPeriod] = React.useState<StrategyCandlePeriodId>(DEFAULT_STRATEGY_LAB_PERIOD);
  const [analysisPreset, setAnalysisPreset] = React.useState<AnalysisPresetId>("normal");
  const [bufferAuto, setBufferAuto] = React.useState(true);
  const [customBuffer, setCustomBuffer] = React.useState("0.14");
  const [manualSelectedLevelPrice, setManualSelectedLevelPrice] = React.useState<number | null>(null);
  const [selectedTouchEventId, setSelectedTouchEventId] = React.useState<string | null>(null);
  const [showNearMiss, setShowNearMiss] = React.useState(DEFAULT_SHOW_NEAR_MISS);
  const [approachFactor, setApproachFactor] = React.useState<ApproachFactorMode>(DEFAULT_APPROACH_FACTOR_MODE);
  const [contextHudExpanded, setContextHudExpanded] = React.useState(DEFAULT_CONTEXT_HUD_EXPANDED);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [exportMarkdownPreview, setExportMarkdownPreview] = React.useState("");
  const [exportJsonPreview, setExportJsonPreview] = React.useState("");
  const [exportNotice, setExportNotice] = React.useState<string | null>(null);
  const [activeStrategy, setActiveStrategy] = React.useState<StrategyLabStrategyId>("round-levels");
  const runtimeVersion = getStrategyLabRuntimeVersion();
  const showRuntimeVersion = chartDebug && process.env.NODE_ENV !== "production";

  React.useEffect(() => {
    const snapshot = loadStrategyLabSnapshot();
    if (!snapshot) return;
    if (snapshot.showNearMiss != null) setShowNearMiss(snapshot.showNearMiss);
    if (snapshot.approachFactor) setApproachFactor(snapshot.approachFactor);
    if (snapshot.contextHudExpanded != null) setContextHudExpanded(snapshot.contextHudExpanded);
    if (snapshot.layerModes) setLayerModes(snapshot.layerModes);
    if (snapshot.selectedLevelPrice != null) setManualSelectedLevelPrice(snapshot.selectedLevelPrice);
    if (snapshot.selectedTouchEventId) setSelectedTouchEventId(snapshot.selectedTouchEventId);
  }, []);

  const legacyLayers = React.useMemo(() => layerModesToLegacyFlags(layerModes), [layerModes]);
  const {
    showLevels,
    showBuffers,
    showSessions,
    showReactions,
    showHalfLevels,
    levelScope,
    bufferDisplayMode,
    zigzagMode,
    reactionMarkerMode,
  } = legacyLayers;

  const isRoundLevels = activeStrategy === "round-levels";
  const effectiveChartDebugSource = chartDebug ? chartDebugSource : "moex";
  const isSyntheticDebug = chartDebug && effectiveChartDebugSource === "synthetic";

  const handleLayerModesChange = React.useCallback((patch: Partial<StrategyLabLayerModes>) => {
    setLayerModes((prev) => ({ ...prev, ...patch }));
  }, []);

  const candlesQuery = useStrategyCandles(loadedSecid, timeframe, period);
  const syntheticCandles = React.useMemo(() => createSyntheticCandles(), []);
  const chartCandles = isSyntheticDebug ? syntheticCandles : candlesQuery.candles;
  const candlesHash = React.useMemo(() => hashStrategyCandles(chartCandles), [chartCandles]);
  const levelsConfigKey = `${showHalfLevels}:${bufferAuto}:${customBuffer}`;

  React.useEffect(() => {
    ensureStrategyLabRuntimeMarker();
  }, []);

  React.useEffect(() => {
    dataRevisionRef.current += 1;
  }, [chartCandles]);

  React.useEffect(() => {
    const strategyParam = searchParams.get("strategy");
    const secidParam = searchParams.get("secid");
    const intervalParam = searchParams.get("interval");
    const periodParam = searchParams.get("period");

    if (isStrategyLabStrategyId(strategyParam)) {
      setActiveStrategy(strategyParam);
    }
    if (secidParam?.trim()) {
      const ticker = secidParam.trim().toUpperCase();
      setDraftSecid(ticker);
      setLoadedSecid(ticker);
    }
    if (intervalParam) {
      const n = Number(intervalParam);
      if (n === 1 || n === 5 || n === 15 || n === 30 || n === 60) {
        setTimeframe(n);
      }
    }
    if (
      periodParam === "today" ||
      periodParam === "3d" ||
      periodParam === "10d" ||
      periodParam === "20d" ||
      periodParam === "60d"
    ) {
      setPeriod(periodParam);
    }
  }, [searchParams]);

  React.useEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return;

    const updateLayoutMetrics = () => {
      const layoutWidth = layoutEl.getBoundingClientRect().width;
      setLayoutMode(layoutWidth >= 1280 ? "desktop" : "mobile");
    };
    updateLayoutMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateLayoutMetrics();
    });
    resizeObserver.observe(layoutEl);

    return () => resizeObserver.disconnect();
  }, []);

  const overlaysEnabled =
    !chartDebug &&
    !isSyntheticDebug &&
    isRoundLevels &&
    (showLevels || showBuffers || showReactions || zigzagMode !== "off");

  const refreshParityDiagnostics = React.useCallback(() => {
    if (!chartDebug) return;
    const debugState = chartDebugState;
    setParityDiagnostics(
      collectStrategyBrowserParityDiagnostics({
        routeMountedAt: routeMountedAtRef.current,
        routeMountCount,
        chartMountCount: getStrategyChartMountCount(),
        chartReadyRevision: debugState?.chartReadyRevision ?? 0,
        dataRevision: dataRevisionRef.current,
        candles: chartCandles,
        setDataCallCount: debugState?.setDataCallCount ?? 0,
        lastSetDataAt: debugState?.lastSetDataAt ?? null,
        lastSetDataReason: debugState?.lastSetDataReason ?? null,
        overlaysEnabled,
      }),
    );
  }, [chartCandles, chartDebug, chartDebugState, overlaysEnabled, routeMountCount]);

  React.useEffect(() => {
    refreshParityDiagnostics();
  }, [refreshParityDiagnostics, runtimeDiagnostics]);

  const handleChartDiagnostics = React.useCallback((next: StrategyChartDiagnostics) => {
    setChartSize((prev) => (chartDiagnosticsEqual(prev, next) ? prev : next));
  }, []);

  const handleOverlayDiagnostics = React.useCallback((next: StrategyOverlayDiagnostics) => {
    setOverlayDiagnostics((prev) => (overlayDiagnosticsEqual(prev, next) ? prev : next));
  }, []);

  const handleRuntimeDiagnostics = React.useCallback((next: StrategyChartRuntimeDiagnostics) => {
    setRuntimeDiagnostics((prev) => (runtimeDiagnosticsEqual(prev, next) ? prev : next));
  }, []);

  const handleChartDebugState = React.useCallback(
    (state: StrategyChartDebugState & { chartReadyRevision: number }) => {
      setChartDebugState((prev) => (prev != null && chartDebugStateEqual(prev, state) ? prev : state));
    },
    [],
  );

  const handleResetStrategyLabState = React.useCallback(() => {
    resetStrategyLabStateAndReload();
  }, []);

  const handleReloadChartFresh = React.useCallback(() => {
    reloadStrategyLabChartFresh();
  }, []);

  const priceRange = React.useMemo(
    () => candlePriceRangeFromCandles(chartCandles),
    [chartCandles],
  );

  const parsedBuffer = Number(customBuffer.replace(",", "."));
  const bufferSize = bufferAuto || !Number.isFinite(parsedBuffer) || parsedBuffer <= 0 ? undefined : parsedBuffer;

  const allLevels = React.useMemo(() => {
    if (!isRoundLevels || isSyntheticDebug || chartCandles.length === 0) return [];
    return computeStrategyLevelsFromCandles(chartCandles, {
      includeHalfLevels: showHalfLevels,
      bufferSize,
    });
  }, [isRoundLevels, isSyntheticDebug, chartCandles, candlesHash, levelsConfigKey, showHalfLevels, bufferSize]);

  const selectedLevelPrice = React.useMemo(() => {
    if (isSyntheticDebug || !priceRange || allLevels.length === 0) return null;
    if (
      manualSelectedLevelPrice != null &&
      allLevels.some((level) => Math.abs(level.price - manualSelectedLevelPrice) < 1e-6)
    ) {
      return manualSelectedLevelPrice;
    }
    return findDefaultSelectedLevelPrice(allLevels, priceRange.currentPrice);
  }, [allLevels, isSyntheticDebug, manualSelectedLevelPrice, priceRange]);

  const visibleLevels = React.useMemo(
    () =>
      filterRoundLevelsForDisplay(
        allLevels,
        {
          showHalfLevels,
          showMajorLevels: true,
          levelScope,
          selectedLevelPrice,
        },
        priceRange,
      ),
    [allLevels, showHalfLevels, levelScope, selectedLevelPrice, priceRange],
  );

  const analysisLevels = React.useMemo(() => {
    if (allLevels.length === 0) return [];
    if (analysisPreset === "deep") return allLevels;
    if (analysisPreset === "quick") {
      return filterLevelsNearPrice(allLevels, priceRange?.currentPrice ?? null);
    }

    const padded = filterLevelsWithPadding(allLevels, priceRange);
    return padded.length > 0 ? padded : visibleLevels;
  }, [allLevels, analysisPreset, priceRange, visibleLevels]);

  const chartLevels =
    isRoundLevels && (showLevels || showBuffers) ? visibleLevels : [];

  const selectedLevel = React.useMemo(() => {
    if (selectedLevelPrice == null) return null;
    return allLevels.find((level) => Math.abs(level.price - selectedLevelPrice) < 1e-6) ?? null;
  }, [allLevels, selectedLevelPrice]);

  const analysisLevelsHash = React.useMemo(() => levelsHash(analysisLevels), [analysisLevels]);

  const reactionResult = React.useMemo(() => {
    if (!isRoundLevels || isSyntheticDebug || chartCandles.length === 0 || analysisLevels.length === 0) return null;
    return analyzeRoundLevelReactions(chartCandles, analysisLevels, {
      intervalMinutes: reactionIntervalForTimeframe(timeframe),
      reactionWindow: reactionWindowForPreset(analysisPreset, timeframe),
    });
  }, [analysisLevels, analysisLevelsHash, analysisPreset, bufferSize, candlesHash, chartCandles, isRoundLevels, isSyntheticDebug, timeframe]);

  const reactionTotals = React.useMemo(
    () => reactionTotalsFromResult(reactionResult),
    [reactionResult],
  );

  const chartReactionMarkers = React.useMemo(() => {
    if (!reactionResult || !showReactions) return [];
    return filterTouchesForChartMarkers(
      reactionResult.touches,
      visibleLevels,
      selectedLevelPrice,
      reactionMarkerMode === "all" ? MAX_REACTION_CHART_MARKERS_ALL : MAX_REACTION_CHART_MARKERS,
      { mode: reactionMarkerMode },
    );
  }, [reactionMarkerMode, reactionResult, showReactions, visibleLevels, selectedLevelPrice]);

  const selectedLevelTouches = React.useMemo(() => {
    if (!reactionResult || selectedLevelPrice == null) return [];
    return reactionResult.touches
      .filter((touch) => Math.abs(touch.level - selectedLevelPrice) < 1e-6)
      .sort((a, b) => b.touchTime - a.touchTime);
  }, [reactionResult, selectedLevelPrice]);

  const sessionBoxes = React.useMemo(() => {
    if (isSyntheticDebug || chartCandles.length === 0 || !showSessions) return [];
    return computeSessionBoxes(chartCandles, sessionPreset);
  }, [chartCandles, isSyntheticDebug, sessionPreset, showSessions]);

  const selectedTouchEvent = React.useMemo(
    () => selectedLevelTouches.find((touch) => touch.id === selectedTouchEventId) ?? null,
    [selectedLevelTouches, selectedTouchEventId],
  );

  const selectedLevelMarkersCapped = React.useMemo(
    () =>
      reactionMarkerMode === "selected" &&
      selectedLevelTouches.filter((touch) => touch.outcome !== "pending").length > MAX_REACTION_CHART_MARKERS,
    [reactionMarkerMode, selectedLevelTouches],
  );

  const sortedLevelRows = React.useMemo(() => {
    const statsByLevel = reactionStatsMap(reactionResult);
    return analysisLevels
      .map((level) => ({ level, stats: statsByLevel.get(level.price) ?? null }))
      .sort((a, b) => {
        const aSelected = selectedLevelPrice != null && Math.abs(a.level.price - selectedLevelPrice) < 1e-6;
        const bSelected = selectedLevelPrice != null && Math.abs(b.level.price - selectedLevelPrice) < 1e-6;
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        const scoreDiff = (b.stats?.technicalityScore ?? -1) - (a.stats?.technicalityScore ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return a.level.price - b.level.price;
      });
  }, [analysisLevels, analysisLevelsHash, bufferSize, candlesHash, reactionResult, selectedLevelPrice, timeframe]);

  const handleSelectLevel = React.useCallback((price: number | null) => {
    setManualSelectedLevelPrice(price);
    setSelectedTouchEventId(null);
  }, []);

  const handleSelectTouchEvent = React.useCallback((touch: RoundLevelTouchEvent) => {
    setSelectedTouchEventId(touch.id);
  }, []);

  React.useEffect(() => {
    if (selectedLevelTouches.length === 0) {
      setSelectedTouchEventId(null);
      return;
    }
    if (selectedTouchEventId && selectedLevelTouches.some((touch) => touch.id === selectedTouchEventId)) return;
    setSelectedTouchEventId(selectedLevelTouches[0]?.id ?? null);
  }, [selectedLevelTouches, selectedTouchEventId]);

  const selectedBufferSize = React.useMemo(() => {
    if (selectedLevel) return resolveLevelBufferSize(selectedLevel);
    return null;
  }, [selectedLevel]);

  const effectiveHardBuffer = React.useMemo(() => {
    if (bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0) return bufferSize;
    return selectedBufferSize;
  }, [bufferSize, selectedBufferSize]);

  const approachWidth = React.useMemo(() => {
    if (effectiveHardBuffer == null || !Number.isFinite(effectiveHardBuffer) || effectiveHardBuffer <= 0) {
      return null;
    }
    return computeApproachWidth(effectiveHardBuffer, approachFactor);
  }, [approachFactor, effectiveHardBuffer]);

  const zigzagBufferBase = React.useMemo(() => {
    if (bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0) return bufferSize;
    return selectedBufferSize ?? 0;
  }, [bufferSize, selectedBufferSize]);

  const zigzagImportantResult = React.useMemo(() => {
    if (isSyntheticDebug || !isRoundLevels || chartCandles.length === 0) return null;
    return computeZigZagLite(chartCandles, {
      left: 5,
      right: 5,
      minMoveAbs: zigzagBufferBase > 0 ? zigzagBufferBase * 2 : 0,
      minMovePct: 0.35,
      minBarsBetweenPivots: 4,
      maxPivots: 80,
    });
  }, [chartCandles, isRoundLevels, isSyntheticDebug, zigzagBufferBase]);

  const zigzagAllResult = React.useMemo(() => {
    if (isSyntheticDebug || !isRoundLevels || chartCandles.length === 0) return null;
    return computeZigZagLite(chartCandles, {
      left: 3,
      right: 3,
      minMoveAbs: zigzagBufferBase > 0 ? zigzagBufferBase : 0,
      minMovePct: 0.15,
      minBarsBetweenPivots: 0,
      maxPivots: 120,
    });
  }, [chartCandles, isRoundLevels, isSyntheticDebug, zigzagBufferBase]);

  const zigzagLiteResult = React.useMemo(() => {
    if (zigzagMode === "off") return null;
    return zigzagMode === "important" ? zigzagImportantResult : zigzagAllResult;
  }, [zigzagAllResult, zigzagImportantResult, zigzagMode]);

  const zigzagChartMarkerCount = React.useMemo(() => {
    if (!zigzagLiteResult) return 0;
    return Math.min(zigzagLiteResult.pivots.length, MAX_ZIGZAG_CHART_MARKERS, 80);
  }, [zigzagLiteResult]);

  const activeApproaches = React.useMemo(() => {
    if (isSyntheticDebug || !isRoundLevels || !showBuffers || chartCandles.length === 0) return [];

    const buffer =
      bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0
        ? bufferSize
        : selectedBufferSize;
    if (buffer == null || !Number.isFinite(buffer) || buffer <= 0) return [];

    return computeRoundLevelApproaches({
      candles: chartCandles,
      levels: allLevels.map((level) => level.price),
      buffer,
      approachWidth: approachWidth ?? undefined,
      zigzagSegments: (zigzagMode === "all" ? zigzagAllResult : zigzagImportantResult)?.segments ?? [],
    });
  }, [
    allLevels,
    approachWidth,
    bufferSize,
    chartCandles,
    isRoundLevels,
    isSyntheticDebug,
    selectedBufferSize,
    showBuffers,
    zigzagAllResult,
    zigzagImportantResult,
    zigzagMode,
  ]);

  const focusedReactionApproach = React.useMemo((): RoundLevelApproachSegment | null => {
    if (!selectedTouchEvent || chartCandles.length === 0) return null;
    const direction = selectedTouchEvent.approach === "from_below" ? "up" : "down";
    const decisionIndex =
      selectedTouchEvent.barsToDecision != null && Number.isFinite(selectedTouchEvent.barsToDecision)
        ? Math.min(
            chartCandles.length - 1,
            selectedTouchEvent.touchIndex + Math.max(0, selectedTouchEvent.barsToDecision),
          )
        : selectedTouchEvent.touchIndex;
    const fromIndex = Math.max(0, selectedTouchEvent.touchIndex - 4);
    const fromCandle = chartCandles[fromIndex];
    const toCandle = chartCandles[decisionIndex];
    if (!fromCandle || !toCandle) return null;
    return {
      id: `focus-${selectedTouchEvent.id}`,
      level: selectedTouchEvent.level,
      direction,
      fromIndex,
      toIndex: decisionIndex,
      startTime: typeof fromCandle.time === "number" ? fromCandle.time : selectedTouchEvent.touchTime,
      endTime: typeof toCandle.time === "number" ? toCandle.time : selectedTouchEvent.touchTime,
      startPrice: fromCandle.close,
      endPrice: toCandle.close,
      reactionZone:
        direction === "up"
          ? { from: selectedTouchEvent.bufferFrom, to: selectedTouchEvent.level }
          : { from: selectedTouchEvent.level, to: selectedTouchEvent.bufferTo },
      breakZone:
        direction === "up"
          ? { from: selectedTouchEvent.level, to: selectedTouchEvent.bufferTo }
          : { from: selectedTouchEvent.bufferFrom, to: selectedTouchEvent.level },
      outcome: selectedTouchEvent.outcome,
    };
  }, [chartCandles, selectedTouchEvent]);

  const chartActiveApproaches = React.useMemo(() => {
    if (!focusedReactionApproach) return activeApproaches;
    return [focusedReactionApproach, ...activeApproaches];
  }, [activeApproaches, focusedReactionApproach]);

  const recentLevelEvents = React.useMemo(
    () =>
      buildRecentLevelEvents({
        approaches: activeApproaches,
        touches: reactionResult?.touches ?? [],
        limit: 30,
      }),
    [activeApproaches, reactionResult?.touches],
  );

  const latestSelectedLevelEvent = React.useMemo(
    () => latestEventForLevel(recentLevelEvents, selectedLevelPrice),
    [recentLevelEvents, selectedLevelPrice],
  );

  const focusedEventId = selectedTouchEventId ?? latestSelectedLevelEvent?.id ?? null;

  const latestSelectedLevelApproach = React.useMemo(
    () => latestApproachForLevel(activeApproaches, selectedLevelPrice),
    [activeApproaches, selectedLevelPrice],
  );

  const selectedLevelApproachCount = React.useMemo(
    () => countApproachesForLevel(activeApproaches, selectedLevelPrice),
    [activeApproaches, selectedLevelPrice],
  );

  const nearestRoundLevel = React.useMemo(() => {
    const currentPrice = priceRange?.currentPrice ?? chartCandles[chartCandles.length - 1]?.close ?? null;
    if (currentPrice == null) return null;
    return nearestRoundLevelDistance(
      currentPrice,
      allLevels.map((level) => level.price),
    );
  }, [allLevels, chartCandles, priceRange?.currentPrice]);

  const directionalBufferZone = React.useMemo(() => {
    if (
      isSyntheticDebug ||
      !isRoundLevels ||
      !showBuffers ||
      selectedLevelPrice == null ||
      chartCandles.length === 0
    ) {
      return null;
    }

    const buffer =
      bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0
        ? bufferSize
        : selectedBufferSize;

    if (buffer == null || !Number.isFinite(buffer) || buffer <= 0) return null;

    if (latestSelectedLevelApproach) {
      const fromLatest: DirectionalBufferZone = {
        level: latestSelectedLevelApproach.level,
        direction:
          latestSelectedLevelApproach.direction === "up" ? "up_to_level" : "down_to_level",
        buffer,
        reactionZone: {
          from: latestSelectedLevelApproach.reactionZone.from,
          to: latestSelectedLevelApproach.reactionZone.to,
          colorRole: "reaction",
        },
        breakZone: {
          from: latestSelectedLevelApproach.breakZone.from,
          to: latestSelectedLevelApproach.breakZone.to,
          colorRole: "break",
        },
        candleStartIndex: latestSelectedLevelApproach.fromIndex,
        candleEndIndex: latestSelectedLevelApproach.toIndex,
      };
      return fromLatest;
    }

    const resolved = resolveActiveDirectionalBuffer({
      candles: chartCandles,
      levels: allLevels.map((level) => level.price),
      selectedLevelPrice,
      buffer,
      useZigzagDirection: zigzagMode !== "off",
      zigzagMovementDirection: zigzagLiteResult?.movementDirection ?? null,
    });
    if (resolved) return resolved;

    const fallbackDirection = inferApproachDirectionToLevel(
      priceRange?.currentPrice ?? chartCandles[chartCandles.length - 1]?.close ?? NaN,
      selectedLevelPrice,
    );
    return buildDirectionalBufferZone(selectedLevelPrice, fallbackDirection, buffer);
  }, [
    allLevels,
    activeApproaches,
    bufferSize,
    chartCandles,
    isRoundLevels,
    isSyntheticDebug,
    latestSelectedLevelApproach,
    priceRange?.currentPrice,
    selectedBufferSize,
    selectedLevelPrice,
    showBuffers,
    zigzagLiteResult?.movementDirection,
    zigzagMode,
  ]);

  const effectiveChartBufferSize = React.useMemo(() => {
    if (bufferSize != null && Number.isFinite(bufferSize) && bufferSize > 0) return bufferSize;
    return selectedBufferSize;
  }, [bufferSize, selectedBufferSize]);

  const resolveBufferDirection = React.useCallback(
    (levelPrice: number): ApproachDirection => {
      if (
        selectedLevelPrice != null &&
        Math.abs(levelPrice - selectedLevelPrice) < 1e-6 &&
        directionalBufferZone
      ) {
        return directionalBufferZone.direction;
      }
      const currentPrice = priceRange?.currentPrice ?? null;
      if (currentPrice == null) return "unknown";
      return inferApproachDirectionToLevel(currentPrice, levelPrice);
    },
    [directionalBufferZone, priceRange?.currentPrice, selectedLevelPrice],
  );

  const loadInstrument = React.useCallback(() => {
    const next = draftSecid.trim().toUpperCase();
    if (next) setLoadedSecid(next);
  }, [draftSecid]);

  const chartFitContentKey = `${loadedSecid}-${timeframe}-${period}`;

  const candlesSummaryLine = formatStrategyCandlesSummary(
    isSyntheticDebug ? chartCandles.length : candlesQuery.candleCount,
    period,
  );
  const statusLabel = STRATEGY_LOAD_STATE_LABEL[candlesQuery.loadState];
  const instrumentScore = reactionResult?.summary?.instrumentTechnicalityScore ?? 0;
  const selectedLevelStats =
    selectedLevelPrice != null
      ? reactionStatsMap(reactionResult).get(selectedLevelPrice) ?? null
      : null;

  const exportContext = React.useMemo((): StrategyLabExportContext => {
    return {
      strategy: activeStrategy,
      ticker: loadedSecid,
      board: STRATEGY_DEFAULT_BOARD,
      timeframe,
      period,
      status: statusLabel,
      candleCount: chartCandles.length,
      visibleRangeFrom: runtimeDiagnostics.visibleRangeFrom,
      visibleRangeTo: runtimeDiagnostics.visibleRangeTo,
      currentPrice: priceRange?.currentPrice ?? null,
      selectedLevel,
      selectedLevelStats,
      technicalSummary: reactionResult?.summary ?? null,
      sessionBoxes,
      movement: {
        lastPivot: zigzagLiteResult?.lastPivot ?? null,
        movementDirection: zigzagLiteResult?.movementDirection ?? "unknown",
        nearestLevel: nearestRoundLevel?.level ?? null,
        nearestDistance: nearestRoundLevel?.distance ?? null,
      },
      directionalBufferZone,
      bufferAuto,
      bufferWidth: directionalBufferZone?.buffer ?? selectedBufferSize,
      bufferSource: bufferAuto ? "auto" : "manual",
      directionIntoSelectedLevel: directionalBufferZone?.direction ?? null,
      activeApproachCount: selectedLevelApproachCount,
      latestApproach: latestSelectedLevelApproach,
      levelsTable: sortedLevelRows,
      recentTouches: [...(reactionResult?.touches ?? [])]
        .sort((a, b) => b.touchTime - a.touchTime)
        .slice(0, 30),
      recentLevelEvents,
      activeApproaches: activeApproaches.slice(0, 30),
      layerModes,
      approachFactor,
      approachWidth,
      showNearMiss,
    };
  }, [
    activeApproaches,
    approachFactor,
    approachWidth,
    activeStrategy,
    bufferAuto,
    chartCandles.length,
    directionalBufferZone,
    layerModes,
    loadedSecid,
    nearestRoundLevel?.distance,
    nearestRoundLevel?.level,
    period,
    priceRange?.currentPrice,
    reactionResult,
    recentLevelEvents,
    runtimeDiagnostics.visibleRangeFrom,
    runtimeDiagnostics.visibleRangeTo,
    selectedBufferSize,
    selectedLevel,
    selectedLevelApproachCount,
    selectedLevelStats,
    sessionBoxes,
    showNearMiss,
    sortedLevelRows,
    statusLabel,
    timeframe,
    zigzagLiteResult?.lastPivot,
    zigzagLiteResult?.movementDirection,
    latestSelectedLevelApproach,
  ]);

  const copyText = React.useCallback(async (text: string, notice: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setExportNotice(notice);
    } catch {
      setExportNotice("Не удалось скопировать в буфер");
    }
  }, []);

  const handleExportAi = React.useCallback(() => {
    const markdown = buildStrategyLabAiMarkdown(exportContext);
    setExportMarkdownPreview(markdown);
    void copyText(markdown, "AI Markdown скопирован");
  }, [copyText, exportContext]);

  const handleExportJson = React.useCallback(() => {
    const json = buildStrategyLabJsonExport(exportContext);
    setExportJsonPreview(json);
    void copyText(json, "JSON скопирован");
  }, [copyText, exportContext]);

  const handleSnapshot = React.useCallback(() => {
    saveStrategyLabSnapshot({
      snapshotVersion: STRATEGY_LAB_SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      strategy: activeStrategy,
      ticker: loadedSecid,
      timeframe,
      period,
      selectedLevelPrice,
      visibleRangeMode: DEFAULT_STRATEGY_LAB_VISIBLE_RANGE,
      visibleRangeFrom: runtimeDiagnostics.visibleRangeFrom,
      visibleRangeTo: runtimeDiagnostics.visibleRangeTo,
      layerModes,
      analysisPreset,
      bufferAuto,
      customBuffer: bufferAuto ? null : customBuffer,
      sessionPreset,
      chartViewportMode: DEFAULT_STRATEGY_LAB_VISIBLE_RANGE,
      selectedTouchEventId: selectedTouchEvent?.id ?? null,
      exportSchemaVersion: STRATEGY_LAB_EXPORT_SCHEMA_VERSION,
      contextHudExpanded,
      showNearMiss,
      approachFactor,
      technicalSummary: reactionResult?.summary
        ? {
            instrumentTechnicalityScore: reactionResult.summary.instrumentTechnicalityScore,
            totalTouches: reactionResult.summary.totalTouches,
            bounceRate: reactionResult.summary.bounceRate,
            breakoutRate: reactionResult.summary.breakoutRate,
            falseBreakRate: reactionResult.summary.falseBreakRate,
            chopRate: reactionResult.summary.chopRate,
          }
        : null,
      selectedLevelEvents: selectedLevelTouches,
      activeApproaches,
    });
    setExportNotice("Snapshot сохранён в localStorage");
  }, [
    activeApproaches,
    activeStrategy,
    analysisPreset,
    approachFactor,
    bufferAuto,
    contextHudExpanded,
    customBuffer,
    layerModes,
    loadedSecid,
    period,
    reactionResult?.summary,
    runtimeDiagnostics.visibleRangeFrom,
    runtimeDiagnostics.visibleRangeTo,
    selectedLevelPrice,
    selectedLevelTouches,
    selectedTouchEvent?.id,
    sessionPreset,
    showNearMiss,
    timeframe,
  ]);

  React.useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);

  if (!hasMounted) {
    return (
      <div className="strategy-lab-page flex w-full max-w-none flex-col gap-3 pb-4">
        <StrategyLabHeader
          ticker="GAZP"
          timeframe={5}
          period="20d"
          score={0}
          status="загрузка"
          onExportAi={() => {}}
          onSnapshot={() => {}}
          onToggleSettings={() => {}}
          settingsOpen={false}
        />
        <div className={cn("strategy-lab-chart-column rounded border border-white/[0.08] bg-black/35", CHART_HEIGHT)} />
      </div>
    );
  }

  return (
    <div className="strategy-lab-page flex w-full max-w-none flex-col gap-3 pb-4">
      <StrategyLabStrategyNav activeStrategy={activeStrategy} onStrategyChange={setActiveStrategy} />

      {isRoundLevels ? (
        <>
          <StrategyLabHeader
            ticker={loadedSecid}
            timeframe={timeframe}
            period={period}
            score={instrumentScore}
            status={statusLabel}
            onExportAi={handleExportAi}
            onSnapshot={handleSnapshot}
            onToggleSettings={() => setSettingsOpen((prev) => !prev)}
            settingsOpen={settingsOpen}
          />
          {exportNotice ? (
            <p className="font-mono text-[10px] text-cyan-200/90">{exportNotice}</p>
          ) : null}
          {showRuntimeVersion ? (
            <p className="font-mono text-[9px] text-zinc-600">runtime {runtimeVersion}</p>
          ) : null}

          <div className="strategy-lab-workspace flex w-full min-w-0 max-w-none flex-col gap-3">
            <StrategyLabCompactControls
              draftSecid={draftSecid}
              onDraftSecidChange={setDraftSecid}
              onLoadInstrument={loadInstrument}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              period={period}
              onPeriodChange={setPeriod}
              layerModes={layerModes}
              onLayerModesChange={handleLayerModesChange}
              candlesSummary={!chartDebug && !isSyntheticDebug ? candlesSummaryLine : null}
            />

            {settingsOpen ? (
              <StrategyLabSettingsPanel
                analysisPreset={analysisPreset}
                onAnalysisPresetChange={setAnalysisPreset}
                bufferAuto={bufferAuto}
                onBufferAutoChange={setBufferAuto}
                customBuffer={customBuffer}
                onCustomBufferChange={setCustomBuffer}
                sessionPreset={sessionPreset}
                onSessionPresetChange={setSessionPreset}
                showNearMiss={showNearMiss}
                onShowNearMissChange={setShowNearMiss}
                approachFactor={approachFactor}
                onApproachFactorChange={setApproachFactor}
                contextHudExpanded={contextHudExpanded}
                onContextHudExpandedChange={setContextHudExpanded}
              />
            ) : null}

            {chartDebug ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 rounded border border-white/[0.06] bg-black/20 px-2 py-1">
                  <span className="font-mono text-[10px] text-zinc-600">Источник</span>
                  {(["synthetic", "moex"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setChartDebugSource(option)}
                      className={cn(
                        "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                        effectiveChartDebugSource === option
                          ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                          : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
                      )}
                    >
                      {option === "synthetic" ? "Синтетика" : "MOEX"}
                    </button>
                  ))}
                </div>
                <StrategyChartBrowserParityDebugPanel
                  parity={parityDiagnostics}
                  runtime={runtimeDiagnostics}
                  onResetState={handleResetStrategyLabState}
                  onReloadFresh={handleReloadChartFresh}
                />
                <StrategyChartRuntimeDebugPanel diagnostics={runtimeDiagnostics} />
                <StrategyDebugStrip
                  rawCount={candlesQuery.diagnostics.rawCount}
                  normalizedCount={candlesQuery.diagnostics.normalizedCount}
                  invalidCount={candlesQuery.diagnostics.invalidCount}
                  duplicateTimeCount={candlesQuery.diagnostics.duplicateTimeCount}
                  firstTime={candlesQuery.diagnostics.firstTime}
                  lastTime={candlesQuery.diagnostics.lastTime}
                  daysLoaded={candlesQuery.diagnostics.fetch?.daysLoaded}
                  fetchRequestCount={candlesQuery.diagnostics.fetch?.fetchRequestCount}
                  periodLabel={period}
                  chartSize={chartSize}
                  totalLevels={allLevels.length}
                  visibleLevels={visibleLevels.length}
                  selectedLevelPrice={selectedLevelPrice}
                  priceLineCount={overlayDiagnostics.priceLineCount}
                  bufferZoneCount={overlayDiagnostics.bufferZoneCount}
                  skippedNullCoords={overlayDiagnostics.skippedNullCoords}
                  bufferSize={selectedBufferSize}
                  touchesTotal={reactionTotals.touches}
                  markersCount={overlayDiagnostics.markerCount}
                  zigzagPivotCount={zigzagLiteResult?.pivots.length ?? 0}
                  zigzagMarkerCount={zigzagChartMarkerCount}
                  zigzagMovementDirection={zigzagLiteResult?.movementDirection ?? "unknown"}
                  selectedLevelTouches={selectedLevelTouchCount(reactionResult, selectedLevelPrice)}
                  canvasWidth={runtimeDiagnostics.canvasCssWidth}
                  canvasHeight={runtimeDiagnostics.canvasCssHeight}
                  layoutMode={layoutMode}
                  chartFocusMode={false}
                  selectedPriceY={overlayDiagnostics.selectedPriceY}
                  selectedUpperY={overlayDiagnostics.selectedUpperY}
                  selectedLowerY={overlayDiagnostics.selectedLowerY}
                  bufferDisplayMode={overlayDiagnostics.bufferDisplayMode}
                  zonesRendered={overlayDiagnostics.zonesRendered}
                  zonesSkipped={overlayDiagnostics.zonesSkipped}
                  approachDirection={overlayDiagnostics.approachDirection ?? "unknown"}
                  reactionZoneValues={overlayDiagnostics.reactionZoneValues}
                  breakZoneValues={overlayDiagnostics.breakZoneValues}
                />
              </>
            ) : null}

            <div ref={layoutRef} className="strategy-lab-workspace-chart w-full min-w-0 max-w-none space-y-3">
              <div className="relative min-w-0">
                <StrategyCandlestickChart
                  candles={chartCandles}
                  fitContentKey={chartFitContentKey}
                  debugSource={effectiveChartDebugSource}
                  initialVisibleRangeMode={DEFAULT_STRATEGY_LAB_VISIBLE_RANGE}
                  levels={chartLevels}
                  touchMarkers={chartReactionMarkers}
                  focusedTouchEventId={selectedTouchEvent?.id ?? null}
                  focusedTouchEventIndex={selectedTouchEvent?.touchIndex ?? null}
                  zigzagPivots={zigzagLiteResult?.pivots ?? []}
                  zigzagSegments={zigzagLiteResult?.segments ?? []}
                  showZigzagLabels={zigzagMode === "important"}
                  activeApproaches={chartActiveApproaches}
                  focusedApproachId={focusedReactionApproach?.id ?? null}
                  focusedEventId={focusedEventId}
                  showNearMiss={showNearMiss}
                  highlightedLevelPrice={selectedLevelPrice}
                  directionalBufferZone={directionalBufferZone}
                  bufferDisplayMode={bufferDisplayMode}
                  chartCurrentPrice={priceRange?.currentPrice ?? null}
                  chartBufferSize={effectiveChartBufferSize}
                  resolveBufferDirection={resolveBufferDirection}
                  sessionBoxes={sessionBoxes}
                  showSessionBoxes={!isSyntheticDebug && showSessions}
                  showLevelLines={!isSyntheticDebug && isRoundLevels && showLevels}
                  showBufferZones={!isSyntheticDebug && isRoundLevels && showBuffers}
                  showReactionMarkers={!isSyntheticDebug && isRoundLevels && showReactions}
                  showZigzagMarkers={!isSyntheticDebug && isRoundLevels && zigzagMode !== "off"}
                  showBufferDebug={chartDebug}
                  chartDebug={chartDebug}
                  className={CHART_HEIGHT}
                  isLoading={!isSyntheticDebug && (candlesQuery.isLoading || candlesQuery.isFetching)}
                  isError={!isSyntheticDebug && (candlesQuery.isError || candlesQuery.loadState === "error")}
                  errorMessage={
                    isSyntheticDebug
                      ? null
                      : candlesQuery.loadState === "no-data" || candlesQuery.isError
                        ? candlesQuery.errorMessage
                        : null
                  }
                  onChartDiagnostics={chartDebug ? handleChartDiagnostics : undefined}
                  onOverlayDiagnostics={chartDebug ? handleOverlayDiagnostics : undefined}
                  onRuntimeDiagnostics={chartDebug ? handleRuntimeDiagnostics : undefined}
                  onChartDebugState={chartDebug ? handleChartDebugState : undefined}
                />
                {!isSyntheticDebug ? (
                  <StrategyLabContextPanel
                    variant="overlay"
                    selectedLevel={selectedLevel}
                    levelScore={selectedLevelStats?.technicalityScore ?? null}
                    activeApproachCount={selectedLevelApproachCount}
                    latestApproach={latestSelectedLevelApproach}
                    latestEvent={latestSelectedLevelEvent}
                    directionalBufferZone={directionalBufferZone}
                    bufferWidth={directionalBufferZone?.buffer ?? selectedBufferSize}
                    approachWidth={approachWidth}
                    bufferSource={bufferAuto ? "auto" : "manual"}
                    lastPivot={zigzagLiteResult?.lastPivot ?? null}
                    movementDirection={zigzagLiteResult?.movementDirection ?? "unknown"}
                    nearestLevel={nearestRoundLevel?.level ?? null}
                    nearestDistance={nearestRoundLevel?.distance ?? null}
                    expanded={contextHudExpanded}
                    onExpandedChange={setContextHudExpanded}
                  />
                ) : null}
              </div>

                {!isSyntheticDebug ? (
                  <StrategyLabBottomTabs
                    summary={
                      <InstrumentTechnicalitySummary
                        reactionResult={reactionResult}
                        candleCount={chartCandles.length}
                        sessionBoxes={sessionBoxes}
                      />
                    }
                    levels={
                      <LevelStatsTable
                        levels={sortedLevelRows}
                        selectedLevelPrice={selectedLevelPrice}
                        onSelectLevel={handleSelectLevel}
                      />
                    }
                    touches={
                      <SelectedLevelTouchEvents
                        level={selectedLevel}
                        touches={selectedLevelTouches}
                        selectedTouchEventId={selectedTouchEvent?.id ?? null}
                        markersCapped={selectedLevelMarkersCapped}
                        onSelectTouchEvent={handleSelectTouchEvent}
                      />
                    }
                    exportPanel={
                      <div className="space-y-3 p-1">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleExportAi}
                            className="rounded border border-cyan-800/45 bg-cyan-950/20 px-2.5 py-1 font-mono text-[10px] text-cyan-200"
                          >
                            Копировать AI Markdown
                          </button>
                          <button
                            type="button"
                            onClick={handleExportJson}
                            className="rounded border border-white/[0.08] bg-black/30 px-2.5 py-1 font-mono text-[10px] text-lab-muted hover:text-lab-text"
                          >
                            Копировать JSON
                          </button>
                          <button
                            type="button"
                            onClick={handleSnapshot}
                            className="rounded border border-white/[0.08] bg-black/30 px-2.5 py-1 font-mono text-[10px] text-lab-muted hover:text-lab-text"
                          >
                            Snapshot → localStorage
                          </button>
                        </div>
                        <pre className="max-h-64 overflow-auto rounded border border-white/[0.06] bg-black/30 p-2 font-mono text-[10px] text-zinc-400">
                          {exportMarkdownPreview || buildStrategyLabAiMarkdown(exportContext)}
                        </pre>
                      </div>
                    }
                  />
                ) : null}
            </div>
          </div>
        </>
      ) : (
        <ScreenerPanel className="border-white/[0.08] bg-black/45">
          <p className="font-mono text-[11px] text-lab-muted">Стратегия в разработке</p>
        </ScreenerPanel>
      )}
    </div>
  );
}
