/**
 * MOEX ISS поддерживает interval (мин): 1, 10, 60, 24, … — не 5 и не 15.
 * UI replay запрашивает 1/5/15 → fetch 1м (или 10/60) + ресемпл.
 */

export type MoexResampleCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type MoexUiCandleInterval = 1 | 5 | 15 | 60;

/** Интервалы, которые MOEX ISS реально принимает в candles.json. */
export const MOEX_ISS_NATIVE_INTERVALS = [1, 10, 60, 24] as const;

export type MoexIssNativeInterval = (typeof MOEX_ISS_NATIVE_INTERVALS)[number];

export type MoexIssFetchPlan = {
  targetIntervalMinutes: MoexUiCandleInterval;
  issIntervalMinutes: MoexIssNativeInterval;
  resampleToMinutes: MoexUiCandleInterval | null;
};

export function isMoexUiCandleInterval(value: number): value is MoexUiCandleInterval {
  return value === 1 || value === 5 || value === 15 || value === 60;
}

export function resolveMoexIssFetchPlan(target: MoexUiCandleInterval): MoexIssFetchPlan {
  if (target === 1) {
    return { targetIntervalMinutes: 1, issIntervalMinutes: 1, resampleToMinutes: null };
  }
  if (target === 5) {
    return { targetIntervalMinutes: 5, issIntervalMinutes: 1, resampleToMinutes: 5 };
  }
  if (target === 15) {
    return { targetIntervalMinutes: 15, issIntervalMinutes: 1, resampleToMinutes: 15 };
  }
  return { targetIntervalMinutes: 60, issIntervalMinutes: 60, resampleToMinutes: null };
}

/** Fallback, если 1м недоступен на дату (редко для старых серий). */
export function resolveMoexIssFallbackPlan(
  target: MoexUiCandleInterval,
): MoexIssFetchPlan | null {
  if (target === 1) return null;
  if (target === 5 || target === 15) {
    return { targetIntervalMinutes: target, issIntervalMinutes: 10, resampleToMinutes: null };
  }
  return null;
}

export function aggregateMoexCandles(
  candles: MoexResampleCandle[],
  bucketMinutes: number,
): MoexResampleCandle[] {
  if (bucketMinutes <= 1 || candles.length === 0) return candles;

  const bucketSec = bucketMinutes * 60;
  const buckets = new Map<number, MoexResampleCandle[]>();

  for (const candle of candles) {
    const bucketStart = Math.floor(candle.time / bucketSec) * bucketSec;
    const group = buckets.get(bucketStart);
    if (group) group.push(candle);
    else buckets.set(bucketStart, [candle]);
  }

  const out: MoexResampleCandle[] = [];
  for (const time of [...buckets.keys()].sort((a, b) => a - b)) {
    const group = buckets.get(time)!.sort((a, b) => a.time - b.time);
    const open = group[0]!.open;
    const close = group[group.length - 1]!.close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    let value = 0;
    let hasVolume = false;
    let hasValue = false;

    for (const c of group) {
      high = Math.max(high, c.high);
      low = Math.min(low, c.low);
      if (c.volume != null) {
        volume += c.volume;
        hasVolume = true;
      }
      if (c.value != null) {
        value += c.value;
        hasValue = true;
      }
    }

    out.push({
      time,
      open,
      high: Number.isFinite(high) ? high : open,
      low: Number.isFinite(low) ? low : open,
      close,
      volume: hasVolume ? volume : undefined,
      value: hasValue ? value : undefined,
    });
  }

  return out;
}

export function resolveMoexCandlesBoard(
  engine: string,
  market: string,
  board?: string,
): string | undefined {
  if (board) return board;
  if (engine === "stock" && market === "shares") return "TQBR";
  return undefined;
}
