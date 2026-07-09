import type { IChartApi, ISeriesApi, LogicalRange, Time } from "lightweight-charts";
import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { ChartVisibleRangePreset } from "@/lib/strategies/chart-visible-range";

export type StrategyCandleSnapshot = {
  begin?: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type StrategyChartRuntimeDiagnostics = {
  collectedAt: string;
  source: "moex" | "synthetic";
  overlayIsolation: boolean;

  containerWidth: number;
  containerHeight: number;
  containerReady: boolean;
  chartCreated: boolean;
  chartReady: boolean;
  canvasCount: number;
  canvasBitmapWidth: number | null;
  canvasBitmapHeight: number | null;
  canvasCssWidth: number | null;
  canvasCssHeight: number | null;
  paneWidth: number | null;
  paneHeight: number | null;

  candlestickSeriesCreated: boolean;
  seriesReady: boolean;
  dataReady: boolean;
  dataApplied: boolean;
  setDataCalled: boolean;
  setDataCandlesLength: number;
  setDataCallCount: number;
  lastSetDataReason: string | null;
  skippedSetDataReason: string | null;
  selfHealAttempts: number;
  recreateAttempts: number;
  seriesDataLength: number | null;
  lastValueDataNoData: boolean | null;
  lastValuePrice: number | null;
  firstCandle: StrategyCandleSnapshot | null;
  lastCandle: StrategyCandleSnapshot | null;
  durationMinutes: number | null;
  intervalGuessSeconds: number | null;

  timeScaleWidth: number | null;
  timeScaleHeight: number | null;
  visibleLogicalRange: LogicalRange | null;
  visibleRangeFrom: number | null;
  visibleRangeTo: number | null;
  visiblePreset: ChartVisibleRangePreset | null;
  visibleBarsCount: number | null;
  lastApplyVisibleRangeReason: string | null;
  firstTimeToCoordinate: number | null;
  lastTimeToCoordinate: number | null;
  fitContentCalled: boolean;
  userZoomed: boolean;
  barSpacing: number | null;
  lastFitReason: string | null;

  priceToCoordinateFirstOpen: number | null;
  priceToCoordinateLastClose: number | null;
  priceToCoordinateMinLow: number | null;
  priceToCoordinateMaxHigh: number | null;

  createSeriesError: string | null;
  setDataError: string | null;
  invalidTimeOhlcCount: number;
  errors: string[];

  baseCandlesVisible: boolean;
  priceLinesCount: number;
  bufferZonesCount: number;
  markersCount: number;
  overlaysGateBlocked: boolean;
};

export type StrategyChartDebugState = {
  containerReady: boolean;
  chartCreated: boolean;
  chartReady: boolean;
  candlestickSeriesCreated: boolean;
  seriesReady: boolean;
  dataReady: boolean;
  dataApplied: boolean;
  baseVisible: boolean;
  setDataCalled: boolean;
  setDataCandlesLength: number;
  setDataCallCount: number;
  lastSetDataAt: string | null;
  lastSetDataReason: string | null;
  skippedSetDataReason: string | null;
  selfHealAttempts: number;
  recreateAttempts: number;
  fitContentCalled: boolean;
  userZoomed: boolean;
  barSpacing: number | null;
  lastFitReason: string | null;
  visiblePreset: ChartVisibleRangePreset | null;
  lastApplyVisibleRangeReason: string | null;
  createSeriesError: string | null;
  setDataError: string | null;
};

export const EMPTY_STRATEGY_CHART_DEBUG_STATE: StrategyChartDebugState = {
  containerReady: false,
  chartCreated: false,
  chartReady: false,
  candlestickSeriesCreated: false,
  seriesReady: false,
  dataReady: false,
  dataApplied: false,
  baseVisible: false,
  setDataCalled: false,
  setDataCandlesLength: 0,
  setDataCallCount: 0,
  lastSetDataAt: null,
  lastSetDataReason: null,
  skippedSetDataReason: null,
  selfHealAttempts: 0,
  recreateAttempts: 0,
  fitContentCalled: false,
  userZoomed: false,
  barSpacing: null,
  lastFitReason: null,
  visiblePreset: null,
  lastApplyVisibleRangeReason: null,
  createSeriesError: null,
  setDataError: null,
};

export function createEmptyStrategyChartRuntimeDiagnostics(
  source: "moex" | "synthetic" = "moex",
  overlayIsolation = false,
): StrategyChartRuntimeDiagnostics {
  return {
    collectedAt: new Date().toISOString(),
    source,
    overlayIsolation,
    containerWidth: 0,
    containerHeight: 0,
    containerReady: false,
    chartCreated: false,
    chartReady: false,
    canvasCount: 0,
    canvasBitmapWidth: null,
    canvasBitmapHeight: null,
    canvasCssWidth: null,
    canvasCssHeight: null,
    paneWidth: null,
    paneHeight: null,
    candlestickSeriesCreated: false,
    seriesReady: false,
    dataReady: false,
    dataApplied: false,
    setDataCalled: false,
    setDataCandlesLength: 0,
    setDataCallCount: 0,
    lastSetDataReason: null,
    skippedSetDataReason: null,
    selfHealAttempts: 0,
    recreateAttempts: 0,
    seriesDataLength: null,
    lastValueDataNoData: null,
    lastValuePrice: null,
    firstCandle: null,
    lastCandle: null,
    durationMinutes: null,
    intervalGuessSeconds: null,
    timeScaleWidth: null,
    timeScaleHeight: null,
    visibleLogicalRange: null,
    visibleRangeFrom: null,
    visibleRangeTo: null,
    visiblePreset: null,
    visibleBarsCount: null,
    lastApplyVisibleRangeReason: null,
    firstTimeToCoordinate: null,
    lastTimeToCoordinate: null,
    fitContentCalled: false,
    userZoomed: false,
    barSpacing: null,
    lastFitReason: null,
    priceToCoordinateFirstOpen: null,
    priceToCoordinateLastClose: null,
    priceToCoordinateMinLow: null,
    priceToCoordinateMaxHigh: null,
    createSeriesError: null,
    setDataError: null,
    invalidTimeOhlcCount: 0,
    errors: [],
    baseCandlesVisible: false,
    priceLinesCount: 0,
    bufferZonesCount: 0,
    markersCount: 0,
    overlaysGateBlocked: false,
  };
}

export function isStrategyBaseCandlesVisible(
  diagnostics: Pick<
    StrategyChartRuntimeDiagnostics,
    | "setDataCalled"
    | "setDataCandlesLength"
    | "seriesDataLength"
    | "lastValueDataNoData"
    | "visibleLogicalRange"
    | "firstTimeToCoordinate"
    | "lastTimeToCoordinate"
    | "priceToCoordinateMinLow"
    | "priceToCoordinateMaxHigh"
  >,
): boolean {
  return (
    diagnostics.setDataCalled &&
    diagnostics.setDataCandlesLength > 0 &&
    (diagnostics.seriesDataLength ?? 0) > 0 &&
    diagnostics.lastValueDataNoData !== true &&
    diagnostics.visibleLogicalRange != null &&
    (diagnostics.firstTimeToCoordinate != null || diagnostics.lastTimeToCoordinate != null) &&
    diagnostics.priceToCoordinateMinLow != null &&
    diagnostics.priceToCoordinateMaxHigh != null
  );
}

function toCandleSnapshot(candle: StrategyCandle | undefined): StrategyCandleSnapshot | null {
  if (!candle) return null;
  return {
    begin: candle.begin,
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function toCoordinate(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function timeToUnixSeconds(time: Time): number | null {
  if (typeof time === "number" && Number.isFinite(time)) return time;
  if (typeof time === "string") {
    const parsed = Math.floor(new Date(time).getTime() / 1000);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (time && typeof time === "object" && "year" in time) {
    const { year, month, day } = time;
    const parsed = Math.floor(Date.UTC(year, month - 1, day) / 1000);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function countInvalidStrategyChartCandles(candles: StrategyCandle[]): number {
  let invalid = 0;
  for (const candle of candles) {
    if (!Number.isFinite(candle.time) || candle.time <= 0) {
      invalid += 1;
      continue;
    }
    const ohlc = [candle.open, candle.high, candle.low, candle.close];
    if (!ohlc.every(Number.isFinite)) {
      invalid += 1;
      continue;
    }
    if (candle.high < candle.low || candle.high < candle.open || candle.high < candle.close) {
      invalid += 1;
      continue;
    }
    if (candle.low > candle.open || candle.low > candle.close) {
      invalid += 1;
    }
  }
  return invalid;
}

function detectIntervalGuessSeconds(candles: StrategyCandle[]): number | null {
  if (candles.length < 2) return null;
  const counts = new Map<number, number>();

  for (let index = 1; index < candles.length; index += 1) {
    const diff = candles[index]!.time - candles[index - 1]!.time;
    if (!Number.isFinite(diff) || diff <= 0) continue;
    counts.set(diff, (counts.get(diff) ?? 0) + 1);
  }

  let best: { diff: number; count: number } | null = null;
  for (const [diff, count] of counts) {
    if (best == null || count > best.count || (count === best.count && diff < best.diff)) {
      best = { diff, count };
    }
  }

  return best?.diff ?? null;
}

export function collectStrategyChartRuntimeDiagnostics(options: {
  container: HTMLDivElement | null;
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  candles: StrategyCandle[];
  debugState: StrategyChartDebugState;
  source: "moex" | "synthetic";
  overlayIsolation: boolean;
}): StrategyChartRuntimeDiagnostics {
  const { container, chart, candleSeries, candles, debugState, source, overlayIsolation } = options;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const minLow = candles.reduce((value, candle) => Math.min(value, candle.low), Number.POSITIVE_INFINITY);
  const maxHigh = candles.reduce((value, candle) => Math.max(value, candle.high), Number.NEGATIVE_INFINITY);

  const diagnostics = createEmptyStrategyChartRuntimeDiagnostics(source, overlayIsolation);
  diagnostics.collectedAt = new Date().toISOString();
  diagnostics.containerWidth = container?.clientWidth ?? 0;
  diagnostics.containerHeight = container?.clientHeight ?? 0;
  diagnostics.containerReady = debugState.containerReady;
  diagnostics.chartCreated = debugState.chartCreated && chart != null;
  diagnostics.chartReady = debugState.chartReady;
  diagnostics.canvasCount = container?.querySelectorAll("canvas").length ?? 0;
  const primaryCanvas = container?.querySelector("canvas");
  if (primaryCanvas) {
    diagnostics.canvasBitmapWidth = primaryCanvas.width;
    diagnostics.canvasBitmapHeight = primaryCanvas.height;
    diagnostics.canvasCssWidth = primaryCanvas.getBoundingClientRect().width;
    diagnostics.canvasCssHeight = primaryCanvas.getBoundingClientRect().height;
  }
  diagnostics.candlestickSeriesCreated = debugState.candlestickSeriesCreated && candleSeries != null;
  diagnostics.seriesReady = debugState.seriesReady;
  diagnostics.dataReady = debugState.dataReady;
  diagnostics.dataApplied = debugState.dataApplied;
  diagnostics.setDataCalled = debugState.setDataCalled;
  diagnostics.setDataCandlesLength = debugState.setDataCandlesLength;
  diagnostics.setDataCallCount = debugState.setDataCallCount;
  diagnostics.lastSetDataReason = debugState.lastSetDataReason;
  diagnostics.skippedSetDataReason = debugState.skippedSetDataReason;
  diagnostics.selfHealAttempts = debugState.selfHealAttempts;
  diagnostics.recreateAttempts = debugState.recreateAttempts;
  diagnostics.fitContentCalled = debugState.fitContentCalled;
  diagnostics.userZoomed = debugState.userZoomed;
  diagnostics.barSpacing = debugState.barSpacing;
  diagnostics.lastFitReason = debugState.lastFitReason;
  diagnostics.visiblePreset = debugState.visiblePreset;
  diagnostics.lastApplyVisibleRangeReason = debugState.lastApplyVisibleRangeReason;
  diagnostics.createSeriesError = debugState.createSeriesError;
  diagnostics.setDataError = debugState.setDataError;
  diagnostics.invalidTimeOhlcCount = countInvalidStrategyChartCandles(candles);
  diagnostics.firstCandle = toCandleSnapshot(first);
  diagnostics.lastCandle = toCandleSnapshot(last);
  diagnostics.durationMinutes =
    first && last ? Math.max(0, Math.floor((last.time - first.time) / 60)) : null;
  diagnostics.intervalGuessSeconds = detectIntervalGuessSeconds(candles);

  const errors: string[] = [];
  if (debugState.createSeriesError) errors.push(debugState.createSeriesError);
  if (debugState.setDataError) errors.push(debugState.setDataError);
  if (diagnostics.invalidTimeOhlcCount > 0) {
    errors.push(`invalid time/OHLC count: ${diagnostics.invalidTimeOhlcCount}`);
  }

  if (!chart || !candleSeries) {
    diagnostics.errors = errors;
    return diagnostics;
  }

  try {
    const paneSize = chart.paneSize();
    diagnostics.paneWidth = paneSize.width;
    diagnostics.paneHeight = paneSize.height;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "paneSize() failed");
  }

  try {
    diagnostics.seriesDataLength = candleSeries.data().length;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "series.data() failed");
  }

  try {
    const lastValue = candleSeries.lastValueData(true);
    diagnostics.lastValueDataNoData = lastValue.noData;
    diagnostics.lastValuePrice = lastValue.noData ? null : lastValue.price;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "lastValueData() failed");
  }

  try {
    const timeScale = chart.timeScale();
    const timeScaleWidth = timeScale.width();
    const timeScaleHeight = timeScale.height();
    diagnostics.timeScaleWidth = Number.isFinite(timeScaleWidth) ? timeScaleWidth : null;
    diagnostics.timeScaleHeight = Number.isFinite(timeScaleHeight) ? timeScaleHeight : null;
    diagnostics.visibleLogicalRange = timeScale.getVisibleLogicalRange();
    diagnostics.barSpacing = timeScale.options().barSpacing;

    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      diagnostics.visibleRangeFrom = timeToUnixSeconds(visibleRange.from);
      diagnostics.visibleRangeTo = timeToUnixSeconds(visibleRange.to);

      if (diagnostics.visibleRangeFrom != null && diagnostics.visibleRangeTo != null) {
        const from = Math.min(diagnostics.visibleRangeFrom, diagnostics.visibleRangeTo);
        const to = Math.max(diagnostics.visibleRangeFrom, diagnostics.visibleRangeTo);
        diagnostics.visibleBarsCount = candles.reduce((count, candle) => {
          if (!candle || !Number.isFinite(candle.time)) return count;
          return candle.time >= from && candle.time <= to ? count + 1 : count;
        }, 0);
      }
    }

    if (first) {
      diagnostics.firstTimeToCoordinate = toCoordinate(
        timeScale.timeToCoordinate(first.time as Time),
      );
    }
    if (last) {
      diagnostics.lastTimeToCoordinate = toCoordinate(timeScale.timeToCoordinate(last.time as Time));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "timeScale diagnostics failed");
  }

  if (first) {
    try {
      diagnostics.priceToCoordinateFirstOpen = toCoordinate(candleSeries.priceToCoordinate(first.open));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "priceToCoordinate(first.open) failed");
    }
  }

  if (last) {
    try {
      diagnostics.priceToCoordinateLastClose = toCoordinate(candleSeries.priceToCoordinate(last.close));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "priceToCoordinate(last.close) failed");
    }
  }

  if (Number.isFinite(minLow)) {
    try {
      diagnostics.priceToCoordinateMinLow = toCoordinate(candleSeries.priceToCoordinate(minLow));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "priceToCoordinate(minLow) failed");
    }
  }

  if (Number.isFinite(maxHigh)) {
    try {
      diagnostics.priceToCoordinateMaxHigh = toCoordinate(candleSeries.priceToCoordinate(maxHigh));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "priceToCoordinate(maxHigh) failed");
    }
  }

  diagnostics.errors = errors;
  return diagnostics;
}

export function inferStrategyChartBlankCause(
  diagnostics: StrategyChartRuntimeDiagnostics,
): string {
  if (!diagnostics.chartCreated) {
    return "chart lifecycle — createChart не выполнен (container/canRender)";
  }
  if (!diagnostics.candlestickSeriesCreated) {
    return "series — candlestick series не создана";
  }
  if (diagnostics.createSeriesError || diagnostics.setDataError) {
    return "errors — createSeries/setData выбросили исключение";
  }
  if (!diagnostics.setDataCalled || diagnostics.setDataCandlesLength < 1) {
    return "data — setData не вызван или передан пустой массив";
  }
  if (diagnostics.seriesDataLength === 0) {
    return "data — series.data() пуст после setData";
  }
  if (diagnostics.lastValueDataNoData === true) {
    return "data — lastValueData.noData=true (series без баров)";
  }
  if (diagnostics.invalidTimeOhlcCount > 0) {
    return "data — невалидные time/OHLC в исходных candles";
  }
  if (
    diagnostics.containerWidth <= 0 ||
    diagnostics.containerHeight <= 0 ||
    diagnostics.canvasCount < 1
  ) {
    return "CSS/layout — контейнер или canvas нулевого размера";
  }
  if (
    diagnostics.firstTimeToCoordinate == null ||
    diagnostics.lastTimeToCoordinate == null
  ) {
    return "time scale — timeToCoordinate(null) для first/last (бары вне visible range)";
  }
  if (
    diagnostics.priceToCoordinateFirstOpen == null ||
    diagnostics.priceToCoordinateLastClose == null ||
    diagnostics.priceToCoordinateMinLow == null ||
    diagnostics.priceToCoordinateMaxHigh == null
  ) {
    return "price scale — priceToCoordinate(null) (цены вне шкалы)";
  }
  if (
    !diagnostics.fitContentCalled &&
    (diagnostics.visibleRangeFrom == null || diagnostics.visibleRangeTo == null)
  ) {
    return "time scale — fitContent не вызывался";
  }
  if (
    diagnostics.canvasBitmapWidth != null &&
    diagnostics.canvasCssWidth != null &&
    diagnostics.canvasBitmapWidth > 0 &&
    diagnostics.canvasCssWidth > diagnostics.canvasBitmapWidth * 1.5
  ) {
    return "CSS/layout — canvas bitmap меньше CSS-размера (размытие/невидимые свечи)";
  }
  if (!diagnostics.overlayIsolation) {
    return "overlay — возможное перекрытие слоями (включите ?screenerChartDebug=1 для изоляции)";
  }
  return "unknown — координаты в норме; проверить стили свечей / z-index / pane margins";
}
