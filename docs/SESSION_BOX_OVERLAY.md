# Session Box Overlay

**ScreenerPRO · Strategy Lab · `/screener/strategies`**  
**Дата:** 2026-07-08

## Зачем

Session Box Overlay показывает контекст торговой сессии поверх свечного графика:

- где был `high/low` сессии;
- каков диапазон дня;
- в какой сессии цена тестировала круглые уровни;
- насколько реакции распределялись внутри конкретного session box.

Это не торговый сигнал, а визуальный контекст для Round Levels.

## Presets

Поддерживаются:

- `moex_stocks` — **09:50–18:50 MSK**
- `extended_msk` — **07:00–23:50 MSK**
- `utc_day` — **00:00–23:59 UTC**

Default в UI: **MOEX акции**.

## Engine

Файл: `frontend/lib/strategies/session-box-engine.ts`

```ts
export type SessionPreset = "moex_stocks" | "extended_msk" | "utc_day";

export type SessionBox = {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  rangeAbs: number;
  rangePct: number;
  candleStartIndex: number;
  candleEndIndex: number;
};
```

`computeSessionBoxes(candles, preset)`:

1. группирует свечи по сессионной дате;
2. фильтрует свечи по окну preset;
3. считает `open/high/low/close`;
4. считает `rangeAbs = high - low`;
5. считает `rangePct = rangeAbs / open * 100`.

Один detected trading day внутри session window = один `SessionBox`.

## Визуализация

Файл: `frontend/components/strategies/strategy-session-box-overlay.tsx`

- SVG overlay поверх chart pane;
- очень лёгкая заливка `rgba(56,189,248,0.05)`;
- тонкая рамка blue-gray;
- внутренние линии `high/low` dashed;
- label вида: `08.07 · 2.1%`;
- `pointer-events: none`;
- `null` coords / invalid rect → skip.

## Verify

```bash
pnpm -C frontend verify:session-box
```

Проверки:

- одна MOEX-сессия → один box;
- несколько дней → несколько boxes;
- `open/high/low/close` корректны;
- `rangePct` корректен;
- `utc_day` группирует по UTC-дню;
- no NaN.
