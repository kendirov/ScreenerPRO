/**
 * DEV ONLY — синтетические свечи для Storybook и локальных smoke-тестов.
 * Не импортировать из production path страницы «Ставка ЦБ Replay».
 */
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import type { CbrChartCandle, CbrChartSlotId, CbrChartTimeframe } from "@/lib/domain/cbr-rate-chart-model";
import {
  getEventWindow,
  minutesFromSessionOpen,
} from "@/lib/domain/cbr-rate-event-window";

type MockScenario = {
  impulseAtDecision: number;
  impulseAtPress: number;
  drift: number;
  noise: number;
  postPressFade: number;
};

type SlotCalibration = {
  base: number;
  precision: number;
  impulseScale: number;
};

const SLOT_CALIBRATION: Record<CbrChartSlotId, SlotCalibration> = {
  "equity-index": { base: 2845, precision: 1, impulseScale: -0.85 },
  sber: { base: 305.2, precision: 2, impulseScale: -0.55 },
  gazp: { base: 128.6, precision: 2, impulseScale: -0.7 },
  lkoh: { base: 7120, precision: 1, impulseScale: -0.65 },
  vtbr: { base: 0.0245, precision: 4, impulseScale: -0.5 },
  bonds: { base: 118.4, precision: 2, impulseScale: -0.25 },
  "usd-rub": { base: 92.4, precision: 2, impulseScale: 1 },
  "cny-rub": { base: 12.85, precision: 3, impulseScale: 0.35 },
  "mx-futures": { base: 3185, precision: 1, impulseScale: -0.85 },
};

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashSeed(parts: string[]): number {
  let h = 0;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) | 0;
  }
  return Math.abs(h) + 1;
}

function resolveMockScenario(event: CbrRateEvent): MockScenario {
  const isUpcoming = event.status === "upcoming";

  if (isUpcoming) {
    return {
      impulseAtDecision: 0,
      impulseAtPress: 0,
      drift: 0.02,
      noise: 0.35,
      postPressFade: 0,
    };
  }

  const cut = event.decisionType === "cut";
  const hike = event.decisionType === "hike";
  const hawkish = event.tone === "hawkish";
  const dovish = event.tone === "dovish";

  let rubImpulse = 0.35;
  if (cut || dovish) rubImpulse = 0.55;
  if (hike || hawkish) rubImpulse = -0.45;
  if (event.decisionType === "hold" && !hawkish) rubImpulse = 0.12;

  const postPressFade = hawkish ? 0.25 : dovish ? -0.15 : 0.1;

  return {
    impulseAtDecision: rubImpulse,
    impulseAtPress: rubImpulse * 0.35,
    drift: rubImpulse * 0.04,
    noise: 0.42,
    postPressFade,
  };
}

function roundPrice(value: number, precision: number): number {
  const p = 10 ** precision;
  return Math.round(value * p) / p;
}

function phaseMultiplier(
  minuteFromOpen: number,
  decisionMin: number,
  pressMin: number,
  scenario: MockScenario,
  slotId: CbrChartSlotId,
): number {
  const isCurrency = slotId === "usd-rub" || slotId === "cny-rub";
  const isFuturesIndex = slotId === "mx-futures";
  const sign = isCurrency ? 1 : -1;

  if (minuteFromOpen < decisionMin - 15) {
    return sign * scenario.drift * 0.4;
  }
  if (minuteFromOpen < decisionMin) {
    return sign * scenario.drift * 0.8;
  }
  if (minuteFromOpen < decisionMin + 20) {
    return sign * scenario.impulseAtDecision;
  }
  if (minuteFromOpen < pressMin) {
    return sign * scenario.impulseAtDecision * 0.35;
  }
  if (minuteFromOpen < pressMin + 25) {
    return sign * (scenario.impulseAtPress + scenario.impulseAtDecision * 0.2);
  }
  if (minuteFromOpen < pressMin + 90) {
    return sign * scenario.postPressFade;
  }
  return sign * scenario.postPressFade * 0.35;
}

export function generateMockCbrCandles(input: {
  event: CbrRateEvent;
  slotId: CbrChartSlotId;
  secid: string;
  timeframe: CbrChartTimeframe;
}): CbrChartCandle[] {
  const { event, slotId, secid, timeframe } = input;
  const window = getEventWindow(event.date);
  const scenario = resolveMockScenario(event);
  const cal = SLOT_CALIBRATION[slotId] ?? SLOT_CALIBRATION["equity-index"];

  const decisionMin = minutesFromSessionOpen(event.date, event.decisionTime);
  const pressMin = minutesFromSessionOpen(event.date, event.pressConferenceTime);

  const rng = seededRandom(hashSeed([event.id, slotId, secid, String(timeframe)]));
  const stepSec = timeframe * 60;
  const bars: CbrChartCandle[] = [];

  let price = cal.base * (1 - scenario.drift * 0.0015);
  let t = window.startUnix;

  while (t <= window.endUnix) {
    const minuteFromOpen = Math.round((t - window.startUnix) / 60);
    const phase = phaseMultiplier(minuteFromOpen, decisionMin, pressMin, scenario, slotId);
    const scaledPhase = phase * cal.impulseScale;

    const noise = (rng() - 0.5) * scenario.noise * 0.0012;
    const move = scaledPhase * 0.0018 + noise;

    const open = price;
    const close = roundPrice(open * (1 + move), cal.precision);
    const wick = Math.abs(close - open) * (0.6 + rng() * 0.8) + cal.base * 0.00025;
    const high = roundPrice(Math.max(open, close) + wick, cal.precision);
    const low = roundPrice(Math.min(open, close) - wick, cal.precision);

    bars.push({ time: t, open, high, low, close });
    price = close;
    t += stepSec;
  }

  return bars;
}

export function mockCandleDayChangePct(candles: CbrChartCandle[]): number | null {
  if (candles.length < 2) return null;
  const first = candles[0]!.open;
  const last = candles[candles.length - 1]!.close;
  if (!first) return null;
  return ((last - first) / first) * 100;
}
