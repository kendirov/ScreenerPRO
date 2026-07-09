# Intraday Baseline Layer — проектирование v0/v1/v2

**Дата:** 2026-07-06  
**Статус:** проектирование (код baseline v0 **не реализован** в этой итерации)  
**Связано:** `docs/MARKET_PRIORITY_PAGE_MODEL.md`, `docs/MARKET_RADAR_FORMULAS.md`, `frontend/lib/domain/intraday-baseline.ts`

---

## Проблема

Без baseline «В игре» не может сравнивать инструмент **с собственной нормой**:

- Сбер/ВТБ всегда лидируют по абсолютному обороту — это ликвидность, не событие.
- Неликвид может дать случайный широкий range на 8 сделках — это риск, не in-play.
- Cross-sectional rank («топ рынка сегодня») не отвечает на вопрос *«эта бумага сейчас торгуется сильнее, чем обычно в это время?»*

**Продуктовое правило:** `confirmedActivityShock` только при наличии ratio vs baseline. Без baseline — `confidence: low`, fallback weak, In Play пустой — **норма**.

---

## Аудит: что уже есть в проекте

### 1. Historical data / candles

| Источник | Где | Что даёт |
|----------|-----|----------|
| **MOEX ISS history** | `historyUrl()` в `moex-screener.ts`, `moex-candles.ts`, `preparation-candles.ts`, `stock-screener-candles.ts` | Daily OHLCV + turnover по тикеру |
| **MOEX ISS intraday candles** | `stockCandlesUrl()` в `moex-candles.ts` | 10/60 мин свечи за сессию |
| **Prisma `DailyBar`** | `frontend/prisma/schema.prisma` | `open/high/low/close/volume/turnover` по `instrumentId` + `barDate` |
| **Ingest** | `moex-ingest.ts` → `ingestDailyBars()` | До 80 инструментов, 120 дней, upsert в БД |

### 2. Daily history из MOEX ISS

- **Да**, используется on-demand (candles API, preparation) и через ingest в SQLite.
- `fetchStockHistoricalBaselines()` в `moex-screener.ts` читает **последние 25 daily bars** из Prisma (если `canUsePrismaHistoricalBaselines()`).
- Считает: `turnoverAverage`, `rangeAveragePct`, `previousDayTurnover` (не median — **average**).

### 3. Intraday baseline (частично v1)

| Модуль | Роль |
|--------|------|
| `frontend/lib/domain/intraday-baseline.ts` | `buildIntradayBaselineMetric`, `avgCumulativeTurnoverAtTime`, kinds: `intraday-ok` / `partial` / `rough-day-avg` |
| `loadIntradayBaselinesWithBudget()` | Вызывается из `moex-screener.ts` при live fetch |
| `metricsFieldsFromIntraday()` | Пишет в `ScreenerRow.metrics`: `volumeRatioNow`, `tradesRatioNow`, `intradayBaselineKind` |

**Факт на live MOEX (2026-07-06):** только **3 из 496** строк имеют `volumeRatioNow` + `intraday-ok`. Budget/latency ограничивают покрытие.

### 4. Где безопасно хранить baseline

| Хранилище | Плюсы | Минусы | Рекомендация |
|-----------|-------|--------|--------------|
| **SQLite / Prisma `DailyBar`** | Уже есть ingest, персистентно | Не все тикеры, average не median | **v0 primary** |
| **Server memory cache** | Быстро для top-N | Пропадает при рестарте | Кэш на 1 сессию для top-35 ликвидов |
| **JSON file** | Простой seed | Ручное обновление | Только dev/fixtures |
| **Client localStorage** | Нет | Не для 500 тикеров | **Не использовать** |
| **Новая таблица `InstrumentBaseline`** | Явный контракт | Миграция | **v0.1** если Prisma baseline стабилен |

### 5. Поля, реально доступные сейчас

| Поле v0 | Источник сегодня | Покрытие |
|---------|------------------|----------|
| `medianValue20d` | Prisma `DailyBar.turnover` → сейчас **average**, не median | ~80 инструментов ingest |
| `medianTrades20d` | Prisma — `tradesAverage: null` в baseline | **Нет** |
| `medianVolume20d` | Prisma `DailyBar.volume` | Частично |
| `medianRangePct20d` | `rangeAveragePct` из daily bars | Частично |
| `volumeRatioNow` | intraday same-time | **3/496** live |
| `tradesRatioNow` | intraday | **0/496** live |
| `turnoverVsAverage` | full-day vs 20d avg | Зависит от Prisma |

---

## Версии baseline layer

### v0 — Daily median baseline (20 sessions)

**Цель:** минимальный слой без нового API endpoint — enrich `/api/screener` rows.

```
medianValue20d     — median(daily turnover, 20 sessions)
medianTrades20d    — median(daily trades, 20 sessions)   // нужен trades в DailyBar или ISS
medianVolume20d    — median(daily volume, 20 sessions)
medianRangePct20d  — median((high-low)/close × 100, 20 sessions)
```

**Ratios на клиенте/engine:**

```
valueRatio   = currentTurnover / medianValue20d
tradesRatio  = currentTrades / medianTrades20d
volumeRatio  = currentVolume / medianVolume20d
rangeRatio   = dayRangePct / medianRangePct20d
```

**Правила engine (уже заложены в `market-priority-engine.ts`):**

- `confirmedActivityShock` только если ratio-поля присутствуют и ≥ 1.8.
- `confirmedRangeExpansion` также при `rangePct / medianRangePct20d ≥ 1.5`.
- Без baseline → `confidence: low`, cross-sectional rank = weak fallback only.

**Быстрая реализация v0 (следующая итерация, после подтверждения):**

1. Расширить `fetchStockHistoricalBaselines()` — median вместо average, добавить trades.
2. Писать в `metrics`: `medianValue20d`, `medianRangePct20d`, `valueRatio`, `rangeRatio`.
3. Поднять ingest coverage: top-200 TQBR в `ingestDailyBars`.
4. Fallback: ISS history on-demand для тикеров без Prisma bar (с TTL cache 4h).

### v1 — Time-of-day expected volume

```
expectedVolumeByTime   — накопленный объём к текущей минуте MSK, median по 20 сессиям
expectedValueByTime    — то же для turnover
volumeRunRate          — current / expected at time
```

**Уже частично:** `intraday-baseline.ts` + `loadIntradayBaselinesWithBudget`.  
**Нужно:** увеличить budget, кэшировать intraday curves per ticker, писать `expectedVolumeRatio` в metrics.

### v2 — Session memory snapshots

```
delta20m / delta40m / delta60m  — Δturnover, Δtrades
freshness                        — ускорение vs run-rate
acceleration                     — вторая производная run-rate
newHigh / newLow                 — структура сессии
```

**Требует:** in-session snapshot store (Redis / SQLite `SessionSnapshot` / polling MOEX каждые N мин).  
**Не v0** — отдельный проект.

---

## Минимальная реализация v0 (предложение, без кода)

### Шаг 1 — Server enrich (не ломая API contract)

Файлы:

- `frontend/lib/server/services/moex-screener.ts` — enrich metrics
- `frontend/lib/server/services/moex-screener-history.ts` — ISS fallback
- `frontend/lib/domain/intraday-baseline.ts` — `computeDailyMedianBaseline(bars[])`
- `shared/src/contracts/market.ts` — optional fields: `medianValue20d`, `valueRatio`, `rangeRatio`

### Шаг 2 — Engine уже готов

- `market-priority-engine.ts` читает `metrics.turnoverVsAverage`, `volumeRatioNow`, `metrics.rangeAveragePct`.
- После enrich v0 coverage вырастет → In Play начнёт заполняться на реальных shock-днях.

### Шаг 3 — Verify fixture

- Mock universe с `medianRangePct20d` + `dayRangePct` → range confirmed без cross-sectional rank.

---

## Риски MOEX ISS

| Риск | Влияние | Митигация |
|------|---------|-----------|
| Rate limits / latency | intraday baseline только для top-N | Budget + cache + приоритет ликвидов |
| Неполные trades в history | `medianTrades20d` недоступен | ISS `NUMTRADES` из marketdata, не history |
| Prisma не на prod | baseline skipped | ISS on-demand fallback |
| `rough-day-avg` baseline | Ложный Vol x | Engine: `baselineReliable` только `intraday-ok` = high confidence |
| Сессия вне торгов | stale ratios | `sessionProgress` + data status badge |

---

## Инварианты модели

1. In Play использует **confirmed ratio** только если baseline/ratio поле есть.
2. Нет baseline → `confidence: low`, не strong activity.
3. Cross-sectional rank **не заменяет** baseline — только `activity_fallback` weak.
4. Liquidity Rail **никогда** не использует baseline shock как сигнал.
5. Пустой In Play при отсутствии baseline на universe — **валидное** состояние.

---

## Следующая итерация (после подтверждения владельца)

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Median 20d из Prisma + ISS fallback | `moex-screener.ts`, новый `stock-daily-baseline.ts` |
| 2 | Optional metrics в shared contract | `shared/src/contracts/market.ts` |
| 3 | Ingest top-200 TQBR | `moex-ingest.ts` |
| 4 | Verify: ratio coverage mock | `verify-market-priority-engine.ts` |
| 5 | Pulse debug: `baseline ok N/496` | `market-pulse-strip.tsx` |

**Не трогать без ТЗ:** `/screener/stocks` situation-engine, API breaking changes.
