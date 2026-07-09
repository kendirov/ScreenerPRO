# Strategy Scanner Architecture

**ScreenerPRO · Strategy Lab / Strategy Scanner / Strategy Ratings**  
**Дата:** 2026-07-08

---

## 1. Product model

### Strategy Lab

`/screener/strategies` = **один инструмент подробно**.

Задача Strategy Lab:

- загрузить свечи одного инструмента;
- визуализировать стратегию;
- объяснить score;
- показать уровни, реакции, сессии и context.

Это режим **deep-dive / explainability**.

### Strategy Scanner

Strategy Scanner = **batch scan по universe**.

Задача scanner:

- взять universe инструментов;
- загрузить свечи для каждого;
- прогнать strategy adapter;
- получить унифицированный `StrategyRunResult`;
- сохранить snapshot результатов.

Это режим **server/script-side batch evaluation**.

### Strategy Ratings

Strategy Ratings = **таблица лучших инструментов по стратегии**.

Задача ratings:

- читать уже посчитанные batch results;
- сортировать по `score`;
- фильтровать по asset / timeframe / period / strategy;
- открывать Strategy Lab на конкретном инструменте.

Это режим **ranking / discovery**, а не место расчёта стратегии.

---

## 2. Strategy interface

Базовый контракт должен быть общим для всех стратегий, чтобы:

- одна batch pipeline могла запускать любую стратегию;
- результаты разных стратегий хранились в одном формате;
- рейтинг и future UI не зависели от внутренней математики конкретной стратегии.

```ts
export type StrategyRunInput = {
  secid: string;
  board: string;
  assetClass: "stock" | "future";
  timeframe: "5m" | "10m" | "30m";
  period: "3d" | "10d" | "20d";
  candles: StrategyCandle[];
};

export type StrategyRunResult = {
  strategyId: string;
  secid: string;
  board: string;
  timeframe: string;
  period: string;
  score: number;
  badge: "excellent" | "good" | "medium" | "noisy";
  metrics: Record<string, number | string>;
  bestLevels?: number[];
  weakPoint?: string;
  sampleWarning?: string;
  updatedAt: string;
};
```

### Recommended runtime contract

Поверх типов нужен единый adapter interface:

```ts
export type StrategyAdapter = {
  id: string;
  version: string;
  run(input: StrategyRunInput): StrategyRunResult;
};
```

Дополнительно полезно:

```ts
export type StrategyRegistry = Record<string, StrategyAdapter>;
```

Тогда CLI runner может просто делать:

1. получить adapter из registry;
2. подготовить `StrategyRunInput`;
3. вызвать `adapter.run(input)`;
4. сериализовать `StrategyRunResult`.

---

## 3. Round level strategy adapter

Для `round-levels` нужен adapter, который использует уже существующие блоки:

- `computeRoundLevels`
- `analyzeRoundLevelReactions`
- `instrumentTechnicalityScore` из `summary`

### Proposed adapter

```ts
export const RoundLevelsStrategy: StrategyAdapter = {
  id: "round-levels",
  version: "v1",
  run(input) {
    const levels = computeStrategyLevelsFromCandles(input.candles, {
      includeHalfLevels: false,
    });

    const reactionResult = analyzeRoundLevelReactions(input.candles, levels, {
      intervalMinutes: Number(input.timeframe.replace("m", "")) as 5 | 10 | 30,
    });

    const summary = reactionResult.summary;
    const score = summary.instrumentTechnicalityScore;

    return {
      strategyId: "round-levels",
      secid: input.secid,
      board: input.board,
      timeframe: input.timeframe,
      period: input.period,
      score,
      badge: score >= 80 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "medium" : "noisy",
      metrics: {
        touches: summary.totalTouches,
        bounceRate: summary.bounceRate,
        breakoutRate: summary.breakoutRate,
        falseBreakRate: summary.falseBreakRate,
        chopRate: summary.chopRate,
        avgBounce: summary.avgBounce,
        avgDive: summary.avgDive,
        levelsScore: summary.scoreComponents.levels,
        sampleScore: summary.scoreComponents.sample,
        clarityScore: summary.scoreComponents.clarity,
        lowChopScore: summary.scoreComponents.lowChop,
        speedScore: summary.scoreComponents.speed,
      },
      bestLevels: summary.bestLevels.map((item) => item.level),
      weakPoint: undefined,
      sampleWarning: summary.sampleWarning,
      updatedAt: new Date().toISOString(),
    };
  },
};
```

### Why this scales

Такой adapter:

- изолирует логику стратегии от scanner pipeline;
- переиспользует ту же математику, что уже объясняется в Strategy Lab;
- позволяет позже добавить `zigzag`, `opening-range`, `false-breakout` без переделки batch runner.

---

## 4. Universe

### Stocks v0

Для stocks universe:

- только акции;
- исключить фонды / ETF / облигации / паи / индексы;
- board по умолчанию `TQBR`;
- illiquid/no-data инструменты пропускать.

### Futures later

Futures universe нужно делать отдельным слоем позже, потому что:

- другая торговая сессия;
- другой lifecycle контрактов;
- rollover / main contract mapping;
- другие эвристики liquidity filter.

### Proposed universe abstraction

```ts
export type StrategyUniverseInstrument = {
  secid: string;
  board: string;
  assetClass: "stock" | "future";
  lotSize?: number;
  minStep?: number;
};

export type StrategyUniverseProvider = {
  id: "stocks" | "futures";
  list(): Promise<StrategyUniverseInstrument[]>;
};
```

---

## 5. Runner options

Batch runner должен быть ограниченным и бережным к MOEX.

### Required options

- `concurrency limit 3–5`
- candle cache
- retry на временные ошибки MOEX
- skip `illiquid / no data`
- `max candles cap`
- progress reporting

### Recommended runner config

```ts
export type StrategyScanOptions = {
  strategyId: string;
  asset: "stocks" | "futures";
  timeframe: "5m" | "10m" | "30m";
  period: "3d" | "10d" | "20d";
  concurrency: number;      // default 4
  maxInstruments?: number;  // for smoke runs
  retryCount?: number;      // default 2
  retryDelayMs?: number;    // default 1500
  candlesCap?: number;      // default 5000
  useCache?: boolean;       // default true
};
```

### Runner pipeline

1. Получить universe
2. Ограничить список (`maxInstruments`) для smoke/dev
3. Для каждого инструмента:
   - fetch candles
   - normalize candles
   - skip если данных нет / sample слишком плохой / fetch failed
   - run strategy adapter
4. Писать progress:
   - `loaded N/M`
   - `success`
   - `skipped`
   - `failed`
5. Сериализовать snapshot results

### Retry / throttle policy

- retry только на transient fetch errors;
- no retry на deterministic `no data`;
- между батчами держать throttle;
- не запускать 300+ инструментов в параллель.

---

## 6. Storage options

### v0 — local JSON generated by script

Самый безопасный старт:

- script формирует JSON snapshot;
- API только читает JSON;
- никаких production writes;
- легко дебажить и version-control schema.

**Текущий v0 (implemented):**

- script: `frontend/scripts/scan-round-levels-strategy.ts`
- hardcoded universe: `GAZP, SBER, VTBR, ROSN, LKOH, T, IRAO, TRNFP, SIBN, NVTK`
- adapter: `frontend/lib/strategies/round-levels-strategy-runner.ts`
- types: `frontend/lib/strategies/strategy-runner-types.ts`
- output: `frontend/public/strategy-runs/round-levels-stocks-5m-10d.json`
- defaults:
  - timeframe `5m`
  - period `10d`
  - concurrency `3`
  - retries `2`

### Proposed v0 file shape

Папка:

```txt
frontend/public/strategy-runs/
```

Файлы:

```txt
round-levels-stocks-5m-10d.json
```

Структура:

```ts
export type StrategyRatingsSnapshot = {
  generatedAt: string;
  strategyId: string;
  assetClass: "stock" | "future";
  timeframe: "5m" | "10m" | "30m";
  period: "3d" | "10d" | "20d";
  universeSize: number;
  successCount: number;
  failedCount: number;
  results: StrategyRunResult[];
  errors?: Array<{ secid: string; message: string }>;
};
```

### v1 — database table `strategy_runs`

Когда JSON snapshot перестанет хватать:

- хранить `strategy_runs` в БД;
- поддержать history / latest snapshot / filtering;
- хранить `strategyId + secid + timeframe + period + updatedAt`.

### Suggested DB shape

```ts
strategy_runs
- id
- strategy_id
- strategy_version
- secid
- board
- asset_class
- timeframe
- period
- score
- badge
- metrics_json
- best_levels_json
- weak_point
- sample_warning
- updated_at
```

Но это **v1+**, не часть текущей реализации.

---

## 7. CLI script

Будущий entrypoint:

```bash
pnpm -C frontend strategy:scan --strategy round-levels --asset stocks --tf 5m --period 10d
```

### Suggested CLI flow

1. parse args
2. resolve universe provider
3. resolve strategy adapter
4. scan with concurrency
5. output JSON snapshot
6. print compact summary in terminal

### Recommended intermediate script files

- `frontend/scripts/strategy-scan.ts`
- `frontend/lib/strategies/scanner/strategy-registry.ts`
- `frontend/lib/strategies/scanner/strategy-scan-runner.ts`
- `frontend/lib/strategies/scanner/strategy-scan-storage.ts`
- `frontend/lib/strategies/scanner/universe/stocks-universe.ts`
- `frontend/lib/strategies/adapters/round-levels-strategy.ts`

---

## 8. UI future

Будущий route:

```txt
/screener/strategies/rating
```

### Columns

- тикер
- score
- badge
- касания
- отбой
- пробой
- ложный
- пила
- ср. отскок
- ср. нырок
- лучшие уровни
- обновлено

### Click behavior

Строка открывает Strategy Lab:

```txt
/screener/strategies?secid=GAZP&strategy=round-levels&period=10d
```

### Important separation

Ratings page **не должна** сама запускать scan.

Она должна:

- читать готовый snapshot;
- отображать ranking;
- давать drill-down в Strategy Lab.

---

## 9. Safety

Обязательные ограничения:

- не запускать 300 инструментов с фронта;
- batch scan только `server/script-side`;
- не перегружать MOEX;
- cache / retry / throttle обязательны;
- no production data writes без отдельного подтверждения;
- futures universe отдельно, не смешивать с акциями на v0.

### Recommended safe defaults

- `concurrency = 4`
- `maxInstruments = 10` для первых smoke runs
- `useCache = true`
- `retryCount = 2`
- snapshot generation вручную через CLI

---

## 10. Implementation plan

### Iteration 1

**Только interface + docs**

- `StrategyRunInput`
- `StrategyRunResult`
- `StrategyAdapter`
- architecture docs

### Iteration 2

**CLI scan for 5–10 tickers**

- registry
- round-levels adapter
- runner with concurrency
- terminal progress

**Статус:** выполнено для v0 small universe через отдельный script и JSON snapshot.

### Iteration 3

**JSON result + ratings page**

- generated JSON snapshot
- read-only API
- `/screener/strategies/rating`

### Iteration 4

**Full stocks universe**

- stock universe provider
- liquidity/no-data filtering
- scheduled snapshot refresh

### Iteration 5

**Futures universe**

- отдельный provider
- futures-specific session/liquidity logic
- separate ratings view if needed

---

## Recommended next files

Когда начнётся реализация, логично трогать в таком порядке:

1. `frontend/lib/strategies/strategy-runner-types.ts`
2. `frontend/lib/strategies/round-levels-strategy-runner.ts`
3. `frontend/scripts/scan-round-levels-strategy.ts`
4. `frontend/scripts/verify-strategy-scan-result.ts`
5. `frontend/lib/strategies/scanner/strategy-registry.ts`
6. `frontend/lib/strategies/scanner/universe/stocks-universe.ts`
7. `frontend/lib/strategies/scanner/strategy-scan-runner.ts`
8. `frontend/public/strategy-runs/*.json`
9. future: `frontend/app/api/strategies/ratings/route.ts`
10. future: `frontend/app/(app)/screener/strategies/rating/page.tsx`
