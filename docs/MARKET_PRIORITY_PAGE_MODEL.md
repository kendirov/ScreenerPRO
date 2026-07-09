# Market Priority Page — модель верхней страницы `/screener`

**ScreenerPRO · Market Priority Page** — продуктовая и алгоритмическая спецификация верхней страницы скринера как **Market Priority Page**: ответ трейдеру за **10–30 секунд** на четыре вопроса.

| Вопрос | Зона страницы |
|--------|---------------|
| **Где деньги?** | Liquidity Rail |
| **Что реально в игре?** | In Play |
| **Где прострелы, но риск ликвидности?** | Volatility |
| **Что смотреть первым?** | In Play → Volatility (с risk badge) → Liquidity Rail (контекст) |

**Статус:** модель v1.0 + **engine и UI `/screener` реализованы** (2026-07-06). `/screener/stocks` и `/screener/futures` **не изменялись**.

**Связанные файлы:**

| Документ | Роль |
|----------|------|
| `docs/INTRADAY_SCREENER_TERMINAL_VISION.md` | North Star, сценарий 10–30 с |
| `docs/MARKET_RADAR_FORMULAS.md` | Текущие формулы Market Radar (legacy v1.0) |
| `docs/SITUATION_ENGINE.md` | Теги торговой ситуации (дополняет In Play) |
| `docs/SCREENER_TERMINAL_AUDIT.md` | Аудит фрагментации radar-стеков |
| `docs/UI_NUMBERS_MINIMALISM.md` | 2–3 числа на поверхности карточки |

**Код engine:** `frontend/lib/screener/market-priority-engine.ts`  
**UI страницы:** `frontend/components/screener/market-priority/market-priority-page.tsx`  
**Точка входа:** `screener-home-page.tsx` → `/screener`  
**Пороги In Play:** `frontend/lib/screener/market-priority-presets.ts` → `MARKET_PRIORITY_PRESETS`  
**Режим по умолчанию:** `strict` · localStorage: `screenerpro.marketPriority.mode`

---

## 1. Философия страницы

Верхняя страница `/screener` — **не** таблица котировок и **не** дубль `/screener/stocks`.

Это **приоритизация внимания**: короткие списки с явным разделением ролей.

### Главное правило

| Зона | Роль | Это сигнал на сделку? |
|------|------|------------------------|
| **Liquidity Rail** | Где сейчас концентрирован оборот рынка | **Нет** — контекст исполнения |
| **In Play** | Аномально активные инструменты **относительно себя или рынка** | **Да** — главный фокус |
| **Volatility** | Движение без достаточной ликвидности | **Осторожно** — watchlist с risk badge |

### Что заменяет эта модель

Сводит в **один ranking engine** три разрозненных слоя:

- «топ оборота» на `MarketNowPage`
- `selectHardInPlayInstruments` (Market Radar v4)
- `buildStocksRadarModel` / `in-game-logic` (Stocks Radar)

Цель — **одинаковый ответ** на `/screener` и в leader strip `/screener/stocks`.

---

## 2. Входные данные

### Источник

```
GET /api/screener?assetClass=stock
  → ScreenerRow[] + benchmarks[] + status
```

Движок — **pure function** на клиенте или сервере; не требует нового API endpoint на v1.

### Поля на инструмент (`ScreenerRow` + `metrics`)

| Поле | Использование |
|------|---------------|
| `lastPrice` | eligibility, directionalPressure |
| `percentChange` | absChangePct, directionalPressure |
| `turnover` | value / turnoverParticipation |
| `tradesCount` | trades, tradability, penalties |
| `volume` | volumeRank (штуки) |
| `high`, `low`, `open`, `previousClose` | rangePct, proximityToExtreme, structure |
| `metrics.dayRangePct` | rangeExpansion |
| `metrics.volumeRatioNow` | activityShock (при reliable baseline) |
| `metrics.tradesRatioNow` | activityShock (при reliable baseline) |
| `metrics.turnoverVsAverage` | **не** подменяет Vol x в activityShock |
| `metrics.intradayBaselineKind` | confidence activityShock |
| `metrics.turnoverPercentile`, `tradesPercentile`, `rangePercentile` | cross-sectional fallback |
| `board`, `secid`, `assetClass` | hard exclude |
| `tradingStatus` | eligibility |
| `spreadPct` *(опционально, enrich)* | tradability, soft risk, spreadQuality |

### Universe

Только **акции TQBR** в торговом статусе, прошедшие `filterValidStockUniverse`. Фьючерсы — отдельный проход (v2); на v1 страница может показывать компактный блок фьючерсов из существующего `selectTopFutures` без смешивания в ranking акций.

---

## 3. Общие примитивы

### 3.1 Rank → Score

Как в `docs/MARKET_RADAR_FORMULAS.md`:

```
rankScore(rank, total) = 100 × (1 - (rank - 1) / max(total - 1, 1))
```

`rank = 1` → 100; последний → ≈ 0.

### 3.2 Percentile

```
percentile(rank, total) = rankScore(rank, total)   // 0–100, выше = сильнее
```

`inPlayPercentile` для инструмента = percentile его `inPlayScore` среди всех eligible кандидатов (не среди всего universe).

### 3.3 Компонент «активен»

Компонент считается **активной причиной**, если его нормализованное значение ≥ `COMPONENT_ACTIVE_THRESHOLD` (default **65**).

Используется в gate In Play: минимум **2** активные причины из четырёх.

### 3.4 Confidence

| Уровень | Условие | UI |
|---------|---------|-----|
| `high` | `intradayBaselineKind = intraday-ok` | полные бейджи vol x / trades x |
| `medium` | partial / previous-day | бейдж + пометка «оценка» |
| `low` | нет baseline | cross-sectional rank, пониженный вес activityShock |

При `low` в activityShock применяется множитель **0.6** к компоненту.

---

## 4. Hard Exclude — скрыть мусор

Инструмент **не попадает** ни в один из трёх блоков (попадает в `excluded[]`).

| # | Условие | Порог (`MARKET_PRIORITY_THRESHOLDS.hardExclude`) |
|---|---------|--------------------------------------------------|
| H1 | Мало сделок | `tradesCount < 10` |
| H2 | Микрооборот | `turnover < 500_000` ₽ |
| H3 | Широкий спред | `spreadPct > 2.5` *(если spread известен)* |
| H4 | Нет цены | `lastPrice` отсутствует или ≤ 0 |
| H5 | Тонкий прострел | `dayRangePct > 4` **и** `tradesCount < 30` |
| H6 | Нечестные данные | `status.source ∈ {demo, fallback}` без `DataStatusBadge` / явной маркировки в UI контексте |
| H7 | Не тот рынок | `assetClass ≠ stock` или `board` не в allowlist текущего режима (TQBR) |

**Коды причин:** `low_trades`, `low_value`, `wide_spread`, `no_price`, `thin_spike`, `unmarked_fallback`, `wrong_board`.

---

## 5. Soft Risk — показать только с risk badge

Инструмент **может** попасть в Volatility (или крайне редко в In Play с пониженным приоритетом), но **обязан** иметь `riskLevel: "soft"` и amber badge.

| # | Условие | Порог (`softRisk`) |
|---|---------|-------------------|
| S1 | Мало сделок | `tradesCount < 50` |
| S2 | Низкий оборот | `turnover < 5_000_000` ₽ |
| S3 | Спред | `spreadPct > 0.8` |
| S4 | Движение без участников | `dayRangePct ≥ 2.5` и `tradesCount < 100` |
| S5 | Далеко от ликвидного ядра | `turnoverPercentile < 25` и `tradesPercentile < 25` |

`softRisk = true`, если выполнено **≥ 1** условие.  
In Play gate: при `softRisk` требуется `inPlayScore ≥ 80` (на 10 пунктов выше базового порога).

---

## 6. Зона 1 — Liquidity Rail / «Где деньги»

### Смысл для трейдера

Тихий список **8–12** инструментов с наибольшим оборотом и сделками.  
Сбер, Газпром, ВТБ, Т-Банк **могут быть здесь всегда** — это нормально.  
**Не считать** попадание в Liquidity Rail признаком «в игре».

### Формула

```
liquidityScore =
  0.55 × valueRankScore +
  0.25 × tradesRankScore +
  0.15 × volumeRankScore +
  0.05 × spreadQualityScore
```

| Компонент | Расчёт |
|-----------|--------|
| `valueRankScore` | `rankScore(turnoverRank, total)` |
| `tradesRankScore` | `rankScore(tradesRank, total)` |
| `volumeRankScore` | `rankScore(volumeRank, total)` по полю `volume` (шт.) |
| `spreadQualityScore` | 100 если `spreadPct ≤ 0.3`; линейно до 0 при `spreadPct ≥ 1.5`; **50** если spread неизвестен |

### Отбор

```
liquidityLeaders = top N по liquidityScore среди eligible
N = clamp(8, 12, liquidityListSize)   // default target = 10
```

**Tie-breaker:** выше `turnover` → выше `tradesCount` → алфавит тикера.

### Reasons (поверхность)

Максимум **1** бейдж: `оборот` | `сделки` | `ликвид`.  
Полный breakdown — в tooltip.

### UI-роль

Компактная полоса или боковая колонка; **без** крупных карточек и без cyan-glow. Muted typography.

---

## 7. Зона 2 — In Play / «В игре»

### Смысл для трейдера

**Главный блок страницы.** Инструмент должен быть не просто ликвидным, а **аномально активным** относительно **собственной нормы** или **текущего рынка**.

Абсолютный топ оборота **сам по себе** не даёт In Play.

### Формула score

```
inPlayScore =
  0.35 × activityShock +
  0.25 × rangeExpansion +
  0.15 × turnoverParticipation +
  0.10 × directionalPressure +
  0.10 × tradability +
  0.05 × freshness
  − penalties
```

Результат: clamp 0–100.

### 7.1 activityShock — confirmed vs fallback

**Confirmed** (только при наличии ratio-полей: `activityRatio`, `volumeRatioNow`, `tradesRatioNow`, `turnoverVsAverage`):

| ratio | strength | reason code |
|-------|----------|-------------|
| ≥ 2.5 | **strong** | `activity_shock_confirmed` |
| ≥ 1.8 | medium (не strong) | — |
| < 1.8 | none | — |

**Fallback** (нет ratio): cross-sectional rank × 0.45 → `activity_fallback` (`family: fallback`, `strength: weak`).  
**Не** использовать `metrics.inPlayScore` backend. Fallback **не** считается strong reason и **не** протаскивает бумагу в In Play один.

**Активная причина (gate):** только `strength === "strong"` + `family === "abnormality"`.

### 7.2 rangeExpansion — confirmed

**Confirmed** только при наличии `dayRangePct`:

| Условие | strength |
|---------|----------|
| `rangePct ≥ 2.5` | **strong** → `range_expansion_confirmed` |
| `rangePct ≥ 1.5` **и** `rangeRankScore ≥ 75` | medium |
| нет `rangePct` | none — percentile alone **не** даёт confirmed |

**Бейдж:** `range 3.1%` | `широкий день`.

### 7.3 turnoverParticipation — confirmed

**Не** «где деньги». Confirmed (`turnover_participation_confirmed`) только если:

- `valueRankScore ≥ 75` **и** `tradesRankScore ≥ 75`
- **нет** softRisk
- есть хотя бы один confirmed: activity / range / direction

Иначе — `family: liquidity`, `strength: weak`, не In Play reason.

### 7.4 directionalPressure — confirmed

**Confirmed** только если `|changePct| ≥ 1.2%` **и** (у high/low **или** confirmed range).

| Условие | strength |
|---------|----------|
| confirmed + `|changePct| ≥ 2%` + у экстремума | **strong** → `directional_pressure_confirmed` |
| confirmed иначе | medium |

Просто +2% без структуры **не** даёт полноценный In Play.

### 7.5 tradability

**Смысл:** можно исполниться — узкий спред, достаточно сделок, нет мусорной ликвидности.

```
tradability =
  0.4 × rankScore(tradesRank, total) +
  0.35 × rankScore(turnoverRank, total) +
  0.25 × spreadQualityScore
```

Gate: `tradability ≥ 50` (мягкий пол); не активная причина для confluence.

**Бейдж (tooltip):** `spread ok` | `сделки ок`.

### 7.6 freshness

**Смысл:** движение **активно сейчас**, а не «широкий диапазон с утра и тишина».

```
если есть session snapshots (v2) или proxy:
  freshness = f(Δturnover_5m, Δtrades_5m)

v1 без snapshots:
  freshness = 50 × sessionProgress + 50 × min(activityShock, rangeExpansion) / 100
  confidence = low если нет snapshots → UI не показывает отдельный бейдж
```

При отсутствии snapshots: компонент участвует в score с весом 0.05, но **не** как активная причина.

### 7.7 penalties

Вычитаются из суммы (до clamp):

| Штраф | Условие | Баллы |
|-------|---------|-------|
| `wideSpread` | `spreadPct > 0.8` | −15 |
| `lowTrades` | `tradesCount < 500` | −20 |
| `lowValue` | `turnover < 10_000_000` | −25 |
| `staleFallback` | unreliable baseline + только rank fallback | −10 |
| `thinSpike` | `dayRangePct ≥ 3` и `tradesCount < 80` | −30 |
| `demoData` | `source = demo` | −100 (фактически exclude) |

### 7.8 Gate — confirmed elite selection (v1.5)

**Порядок (факт в engine):**

```
raw rows
→ hard exclude
→ tradable universe (tradability ≥ 50)
→ soft risk mark (riskReasons)
→ confirmed signals (boolean per instrument)
→ inPlay candidate (mode policy)
→ inPlayScore (sort only)
→ display cap (5 / 8 / 12)
```

**`inPlayScore` не участвует в gate** — только сортировка кандидатов после confirmed selection.

**Confirmed booleans на `PriorityInstrument.confirmed`:**

| Поле | Условие |
|------|---------|
| `confirmedActivityShock` | ratio/baseline ≥ 1.8 (strong ≥ 2.5) |
| `confirmedRangeExpansion` | range ≥ 2.5% или (range ≥ 1.5% + rank ≥ 75) или range/median20d ≥ 1.5 |
| `confirmedDirectionalPressure` | near high/low + range confirmed + \|change\| ≥ 0.8% |
| `confirmedParticipation` | value+trades rank high + no softRisk + другой confirmed signal |
| `confirmedInPlay` | прошёл mode gate |

**Strong reasons** — только `strength: strong` + family ∈ {abnormality, range, direction, participation}.  
Participation strong — только при strong core (activity/range/direction).  
Liquidity / fallback / cross-sectional rank — **never** strong.

| Режим | max | min confirmed | activity или range | softRisk |
|-------|-----|---------------|-------------------|----------|
| **Strict** | 5 | 2 | **обязателен** | запрещён |
| **Balanced** | 8 | 2 | желателен; иначе direction+participation | запрещён |
| **Wide** | 12 | 1 | — | допускается + risk badge |

Пустой In Play — **норма** без baseline/ratio на universe. См. `docs/INTRADAY_BASELINE_LAYER.md`.

**Stats:** `total`, `eligible`, `hardExcluded`, `softRisk`, `confirmedActivityCount`, `confirmedRangeCount`, `confirmedDirectionCount`, `confirmedParticipationCount`, `inPlayCandidates`, `finalInPlayCount`, `mode`, `fallbackOnlyRejected`.

### 7.8 (legacy score gate — deprecated)

~~score → percentile → minScore~~ — **удалено в v1.5**. Score только для сортировки.

### 7.10 Reasons

Поверхность карточки: **до 2–3 чисел** + **до 2 бейджей** из:

`vol x` · `range` · `у high` · `у low` · `пробой` · `оборот` · `spread ok` · `сделки`

Полный список компонент score + penalties — inspector / tooltip.

### 7.11 Режимы строгости In Play (UI + engine)

Переключатель в заголовке блока **«В игре»**: `InPlayModeSwitch` (`strict` / `balanced` / `wide`).

| Режим | minScore | percentile | причины | max | softRisk |
|-------|----------|------------|---------|-----|----------|
| **Strict** (default) | 75 | 92 | ≥ 2 strong + ≥ 1 abnormality | 8 | **запрещён** |
| **Balanced** | 70 | 90 | ≥ 2 strong + ≥ 1 abnormality | 10 | **запрещён** |
| **Wide** | 62 | 85 | ≥ 1 strong | 14 | допускается + risk badge |

```typescript
computeMarketPriority(rows, { mode: "strict" | "balanced" | "wide" });
```

Пороги — только в `MARKET_PRIORITY_PRESETS`. Выбор режима сохраняется в `localStorage` (`screenerpro.marketPriority.mode`); при ошибке — fallback `strict`.

Tooltips:
- **Strict** — только верхняя планка
- **Balanced** — рабочий обзор
- **Wide** — широкий мониторинг

### 7.12 Антипример (обязательная проверка)

| Тикер | turnoverRank | Vol x | In Play? |
|-------|--------------|-------|----------|
| SBER | 1 | 1.0 | **Нет** — только liquidity rail |
| SBER | 1 | 2.8 + range 2.5% + у high | **Да** — ≥2 активные причины |

---

## 8. Зона 3 — Volatility / «Прострелы»

### Смысл для трейдера

Вторичный блок. Инструменты с большим range/move, но **недостаточным оборотом** или **повышенным риском ликвидности**.  
Это не «В игре», а **«двигается, но осторожно»**.

### Формула

```
volatilityScore =
  0.45 × rangeRankScore +
  0.20 × absChangeRankScore +
  0.15 × activityShock +
  0.10 × proximityToExtreme +
  0.10 × freshness
  − liquidityRiskPenalty
```

| Компонент | Расчёт |
|-----------|--------|
| `rangeRankScore` | `rankScore(rangeRank, total)` |
| `absChangeRankScore` | `rankScore(absChangeRank, total)` |
| `activityShock` | тот же, что в In Play |
| `proximityToExtreme` | 100 если position ≥ 0.85 или ≤ 0.15; иначе 0 |
| `freshness` | тот же, что в In Play |
| `liquidityRiskPenalty` | см. ниже |

### liquidityRiskPenalty

| Условие | Штраф |
|---------|-------|
| `softRisk` | −15 |
| `tradesCount < 30` | −25 |
| `turnover < 1_000_000` | −30 |
| `spreadPct > 1.2` | −20 |
| Уже в `inPlayLeaders` | **исключить** из Volatility |

### Gate

```
passesVolatility =
  NOT hardExcluded
  AND NOT in inPlayLeaders
  AND (
    dayRangePct ≥ 2.0 OR |percentChange| ≥ 1.5
  )
  AND volatilityScore ≥ 55
  AND (softRisk OR activityShock ≥ 50 OR rangeRank ≤ 20)
```

```
volatilityLeaders = top 8 по volatilityScore среди passesVolatility
```

Все строки с `softRisk` — **обязательный** amber risk badge.

### Reasons

`range` · `импульс` · `у high/low` · `тонко` · `мало сделок`

---

## 9. Почему naked turnover/value нельзя использовать для «В игре»

### 9.1 Вечные ликвиды всегда наверху

Сбер, Газпром, Лукойл, ВТБ стабильно лидируют по **абсолютному** обороту независимо от того, происходит ли в них **событие**.  
Если сортировать «В игре» по `turnover` или `valueRank`, эти тикеры **заблокируют** список в 80% сессий — трейдер перестанет видеть реальные аномалии второго эшелона.

### 9.2 Нужно сравнение относительно собственной нормы

**Vol x / Trades x** (same-time baseline) отвечают на вопрос: *«эта бумага сейчас торгуется сильнее, чем обычно в это время?»*  
Оборот 500 млн у mid-cap может быть **событие**; 15 млрд у Сбера — **обычный вторник**.

Без `activityShock` относительно baseline In Play деградирует в «топ ликвидов».

### 9.3 Нужны участники и диапазон

Тонкий прострел: `rangePct = 5%` на 8 сделках — **движение без рынка**.  
`turnoverParticipation` + `tradability` + штраф `thinSpike` отсекают пустые импульсы.

Деньги без диапазона (консолидация в узком коридоре на большом обороте) — **ликвидность**, не торговая ситуация.

### 9.4 Ликвидность ≠ торговая ситуация

| Понятие | Вопрос | Зона |
|---------|--------|------|
| Ликвидность | Где можно исполнить крупный объём? | Liquidity Rail |
| Торговая ситуация | Где **сейчас** концентрируется внимание и движение? | In Play |
| Рискованное движение | Где цена ходит, но вход опасен? | Volatility |

Разделение — **продуктовое ядро** ScreenerPRO; см. также `docs/MARKET_RADAR_FORMULAS.md` §1.

---

## 10. UI Direction (будущая компоновка)

Страница `/screener` → **Market Priority Page** (замена или эволюция `MarketNowPage`).

### 10.1 Layout (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│ Market Pulse strip (фаза сессии · 2–3 KPI · статус данных)  │
├──────────────────────────────┬──────────────────────────────┤
│ IN PLAY (главный блок)       │ Liquidity Rail (компакт)     │
│ cyan accent · 8 карточек max │ muted · 8–12 тикеров списком │
│ 2–3 числа + 2 бейджа         │ оборот + % change            │
├──────────────────────────────┴──────────────────────────────┤
│ VOLATILITY (amber) · до 8 · risk badges                     │
├─────────────────────────────────────────────────────────────┤
│ CTA → /screener/stocks · /screener/futures                  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Визуальная иерархия

| Зона | Акцент | Плотность |
|------|--------|-----------|
| In Play | Cyan / electric blue, самый яркий | Карточки среднего размера |
| Volatility | Amber, иконка risk | Компактные строки |
| Liquidity Rail | Muted blue-gray | Минимальная высота строки |
| Pulse | Нейтральный | 2–3 числа (`docs/UI_NUMBERS_MINIMALISM.md`) |

### 10.3 Карточка инструмента (поверхность)

**Максимум на карточке:**

- Тикер + `changePct`
- **Одно** ключевое число контекста (vol x **или** range **или** оборот)
- **До 2** reason badges

Остальное — tooltip / клик → inspector → `/stocks/[ticker]`.

### 10.4 Статус данных

При `source ≠ moex` — `DataStatusBadge` на уровне страницы; In Play пустой или с degraded copy; **не** показывать vol x без пометки.

---

## 11. Implementation Notes

### 11.1 Модули (реализовано)

```
frontend/lib/screener/market-priority-engine.ts        ✓
frontend/lib/screener/market-priority-display.ts       ✓ (форматирование UI, без формул)
frontend/scripts/verify-market-priority-engine.ts        ✓
frontend/components/screener/market-priority/
  market-priority-page.tsx    — оркестрация /screener
  market-pulse-strip.tsx      — пульт: статус, eligible, in-play count
  liquidity-rail.tsx          — «Где деньги»
  in-play-panel.tsx           — главный блок «В игре»
  volatility-panel.tsx        — прострелы / risk
  in-play-mode-switch.tsx   — Strict / Balanced / Wide
  priority-instrument-row.tsx — строка тикера (3 варианта)
frontend/lib/screener/market-priority-presets.ts — пороги режимов
frontend/lib/hooks/use-market-priority-mode.ts   — localStorage
```

**Точка входа:** `screener-home-page.tsx` → `MarketPriorityPage`. Legacy `MarketNowPage` сохранён в репозитории, не подключён.

### 11.1.1 Пользовательская логика блоков (UI)

| Блок | Поведение |
|------|-----------|
| **Market Pulse** | Одна строка: источник данных, время, всего / eligible / в игре. Без KPI-карточек. |
| **В игре** | Центр (desktop) или первый блок (mobile). Cyan. До 8 строк. Пусто → честный copy. |
| **Где деньги** | Muted список 10 тикеров. Подпись «ликвидность ≠ сигнал». Не hot-цвета. |
| **Волатильность** | Amber. Risk badges из `riskReasons`. Не дублирует In Play. |
| **Фьючерсы** | Компактный хвост (до 6), ссылка на `/screener/futures`. |
| **Клик по акции** | `/stocks/[ticker]` — как раньше. |

### 11.1.2 Debug diagnostics (In Play gate)

Компактная строка под заголовком блока **«В игре»** — воронка отбора engine.

**Пример:** `Strict · eligible 142 · score 19 · pct 12 · reasons 5 · final 5`

| Сегмент | `stats` поле | Смысл |
|---------|--------------|-------|
| Strict / Balanced / Wide | `mode` | активный режим |
| eligible | `eligible` | universe после hardExclude |
| score | `candidatesAfterScore` | прошли min score + tradability |
| pct | `candidatesAfterPercentile` | прошли percentile режима |
| reasons | `candidatesAfterReasons` | прошли strong + abnormality reasons |
| final | `finalInPlayCount` | после hard cap |

**Зачем:** быстро понять, на каком этапе gate список «раздулся» (много на score, мало на reasons) или «сузился» (0 на score при высоком eligible).

**Включение:**

| Условие | Видимость |
|---------|-----------|
| `NODE_ENV !== "production"` | всегда (dev) |
| `?debugPriority=1` на `/screener` | и в production |

Tooltip на строке — расшифровка сегментов. Muted `text-[9px]`, не карточка.

Код: `market-priority-debug.ts`, `in-play-gate-diagnostics.tsx`, `InPlayPanel` prop `gateDebugStats`.

### 11.2 Публичный API (факт)

```typescript
function computeMarketPriority<T>(
  rows: T[],
  options?: { maxLiquidity?: number; maxInPlay?: number; maxVolatility?: number; mode?: "strict" | "balanced" | "wide" },
): MarketPriorityResult<T>;
```

`PriorityReason`: `code`, `label`, `severity`, optional `family` (`abnormality` | `range` | `direction` | `participation` | `liquidity` | `risk` | `fallback`), optional `strength` (`weak` | `strong`).

`stats` (отладка gate):

| Поле | Смысл |
|------|-------|
| `mode` | strict / balanced / wide |
| `candidatesBeforeGate` | eligible после hardExclude |
| `candidatesAfterScore` | прошли minScore + tradability |
| `candidatesAfterReasons` | прошли strong + abnormality |
| `candidatesAfterPercentile` | прошли percentile |
| `finalInPlayCount` | после hardCap |
| `softRiskRejected` | отсечено softRisk gate |
| `fallbackActivityCount` | строк с weak fallback activity |

### 11.3 Порядок вычисления

```
1. filterValidStockUniverse
2. hardExclude → excluded[]
3. compute ranks (turnover, trades, volume, range, absChange)
4. compute component scores для каждого eligible
5. liquidityLeaders
6. inPlayLeaders (gate + adaptive threshold)
7. volatilityLeaders (exclude inPlay, apply softRisk badges)
8. attach situation tags (делегировать situation-engine.ts, не дублировать)
```

### 11.4 Миграция с текущего кода

| Сейчас | Целевое |
|--------|---------|
| `buildStocksRadarModel` | делегирует в `buildMarketPriorityPage` |
| `selectHardInPlayInstruments` | deprecated → In Play gate этой модели |
| `MarketNowPage` lists | читают `MarketPriorityResult` |
| `RADAR_THRESHOLDS` + `IN_GAME_CONFIG` | сводятся в `market-priority-config.ts` |

**Не ломать:** `/api/screener` контракт; новые поля только optional в UI types.

### 11.5 Spread enrich (опционально v1.1)

Для top-35 по обороту — bid/offer из ISS (как в technical characteristics) → `spreadPct` в context. Без spread tradability работает на trades/turnover only.

### 11.6 Verify script (реализовано)

`pnpm -C frontend verify:market-priority`

| Сценарий | Ожидание | Статус |
|----------|----------|--------|
| **SBER / VTBR** | ликвид, vol x ≈ 1 → liquidity, не strict in_play | ✓ |
| **TRUEIN** | ratio ≥ 2.5, range ≥ 2.5 → strict in_play | ✓ |
| **RANGEO** | range без participation → volatility, не strict | ✓ |
| **NORATIO** | percentile/inPlayScore без ratio → не strict | ✓ |
| **SOFTRISK** | не strict/balanced; может wide + badge | ✓ |
| **Saturated** | count ≤ 8/10/14; options.maxInPlay игнорируется выше cap | ✓ |
| **THIN / IGST / QUIET** | как раньше | ✓ |

---

## 12. Централизованные пороги

Все значения — в `MARKET_PRIORITY_THRESHOLDS` (`market-priority-engine.ts`). Таблица ниже — **стартовая калибровка v1**.

### hardExclude

| Ключ | Значение |
|------|----------|
| `minTrades` | 10 |
| `minTurnoverRub` | 500_000 |
| `maxSpreadPct` | 2.5 |
| `thinSpikeRangePct` | 4.0 |
| `thinSpikeMaxTrades` | 30 |

### softRisk

| Ключ | Значение |
|------|----------|
| `minTrades` | 50 |
| `minTurnoverRub` | 5_000_000 |
| `maxSpreadPct` | 0.8 |
| `moveMinRangePct` | 2.5 |
| `moveMaxTrades` | 100 |

### inPlay (режимы — см. `MARKET_PRIORITY_PRESETS`)

| Режим | minScore | minPercentile | minStrong | minAbnormality | maxInPlay | allowSoftRisk |
|-------|----------|---------------|-----------|----------------|-----------|---------------|
| strict | 75 | 92 | 2 | 1 | 8 | false |
| balanced | 70 | 90 | 2 | 1 | 10 | false |
| wide | 62 | 85 | 1 | 0 | 14 | true (≥62) |

### liquidity

| Ключ | Значение |
|------|----------|
| `targetMin` | 8 |
| `targetMax` | 12 |

### volatility

| Ключ | Значение |
|------|----------|
| `scoreMin` | 55 |
| `maxLeaders` | 8 |
| `minRangePct` | 2.0 |
| `minAbsChangePct` | 1.5 |

### regime

| Ключ | Значение |
|------|----------|
| `activeIndexRangePct` | 3.0 |
| `broadBreadthRatio` | 0.75 |

---

## 13. Definition of Done

### Engine (v1 — готово)

- [x] **Логика отделяет «где деньги» от «в игре»** — разные score и gates
- [x] **Сбер не попадает в «В игре» только из-за оборота** — verify green
- [x] **Неликвиды с 3 сделками — hard exclude**
- [x] **Тонкие прострелы — не in_play**; risk reasons при soft risk
- [x] **У каждого тикера есть `reasons[]`** — code + label + severity
- [x] **Пороги в `MARKET_PRIORITY_THRESHOLDS`**
- [x] **`verify:market-priority` проходит**
- [x] **Build green**

### UI-интеграция (v1 — готово)

- [x] **`MarketPriorityPage` на `/screener`**
- [x] **Три зоны + Market Pulse**
- [x] **`DataStatusBadge` при fallback/demo/degraded**
- [ ] **Leader strip `/screener/stocks` сведён с engine** (следующий шаг)
- [ ] **Ручная проверка 3 тикеров в браузере**

---

---

## 14. Stock Screener — Live In Play v0 (`variant: stock-live-v0`)

**Маршрут:** `/screener/stocks` только. Market Lab (`/screener`) остаётся на `baseline-confirmed`.

### Принцип

| Правило | Смысл |
|---------|--------|
| Liquidity alone ≠ In Play | Сбер с огромным оборотом без движения — только Liquidity Rail |
| Participation + movement/range = candidate | Нужны деньги/сделки **и** диапазон или ход цены |
| Score = sort only | Не протаскивает бумагу без live signals |

### Focus vs Candidates

| Слой | UI | Cap (Strict / Balanced / Wide) |
|------|-----|--------------------------------|
| **Focus In Play** | Command Bar верхний блок | 8 / 12 / 20 |
| **In Play Candidates** | Quick filter «В игре» в таблице | все `inPlayCandidate` |

Focus — подмножество candidates после softRisk gate режима. **Не добивается** до cap.

### Live signals (`PriorityInstrument.live`)

| Boolean | Условие (кратко) |
|---------|------------------|
| `rangeSignal` | range ≥2.5%; или ≥1.5% + rank≥70; или liquid + range≥1.2% + \|Δ\|≥0.6% |
| `moveSignal` | \|Δ\|≥1.2%; или ≥0.8% у high/low; или change rank≥80 + range≥1.2% |
| `participationSignal` | value≥300M + trades≥1k; или ranks; или 100M+500+range |
| `activitySignal` | baseline ratio≥1.8; или rank fallback + (range\|move) |
| `inPlayCandidate` | tradable + participation + (range\|move) + ≥2 signals |
| `confirmedLiveInPlay` | в Focus после mode gate |

### Score (sort)

```
0.30·range + 0.25·move + 0.25·participation + 0.15·activity + 0.05·tradability − riskPenalty
```

### Debug funnel (`?debugPriority=1`)

```
stocks 262 · tradable 188 · range 42 · move 35 · participation 28 · candidates 17 · focus 8
```

Код: `market-priority-stock-live.ts`, `computeMarketPriority(..., { variant: "stock-live-v0" })`.

---

## 15. Связь с Situation Engine

`market-priority-engine` отвечает на **«куда смотреть первым»** (ранжирование списков).  
`situation-engine` отвечает на **«какой тип сетапа»** (теги на строке таблицы).

На карточке In Play: primary badge из **In Play reasons**; situation tag — вторично в tooltip или inspector. Не смешивать score ситуации с `inPlayScore`.

---

## 16. Версия

| | |
|---|---|
| **Model version** | **1.0** |
| **Дата** | 2026-07-06 |
| **Авторство** | Продуктовая постановка + выравнивание с `INTRADAY_SCREENER_TERMINAL_VISION` |

### Changelog

**v1.6 — 2026-07-06 (stock screener live v0)**

- `variant: stock-live-v0` для `/screener/stocks` — без historical baseline
- Live signals: range / move / participation / activity
- Focus (8/12/20) vs Candidates (table filter)
- `inPlayCandidateLeaders` + `PriorityInstrument.live` diagnostics
- Verify scenario I (VTBR, TRNFP, IRAO, SIBN, SBER, THIN)

**v1.5 — 2026-07-06 (confirmed elite selection)**

- Gate: confirmed signals only; score = sort, not gate
- `PriorityInstrument.confirmed` booleans
- Presets: strict 5 / balanced 8 / wide 12; min confirmed signals
- Stats: `inPlayCandidates`, `fallbackOnlyRejected`, confirmed counts
- Verify scenarios A–H
- Baseline design: `docs/INTRADAY_BASELINE_LAYER.md`

**v1.0 — 2026-07-06**

- Зафиксированы три зоны: Liquidity Rail, In Play, Volatility
- Формулы score и gates с адаптацией по режиму рынка
- Hard exclude и soft risk
- UI direction и контракт `market-priority-engine.ts`
- Definition of Done для реализации

**v1.4.1 — 2026-07-06 (debug diagnostics UI)**

- Строка funnel под «В игре»: dev или `?debugPriority=1`
- Tooltip: score / pct / reasons / final

**v1.4 — 2026-07-06 (elite In Play gate)**

- Confirmed vs fallback activity; убран fallback на `metrics.inPlayScore`
- `PriorityReason.family` + `PriorityReason.strength`; strong reason whitelist
- Gate funnel + stats для отладки
- Balanced: softRisk forbidden
- Hard cap: preset max всегда верхняя граница
- Расширен `verify-market-priority-engine.ts`

**v1.3 — 2026-07-06 (режимы In Play)**

- `MARKET_PRIORITY_PRESETS`: strict / balanced / wide
- UI: `InPlayModeSwitch` + localStorage `screenerpro.marketPriority.mode`
- Default: **Strict**

**v1.2 — 2026-07-06 (UI `/screener`)**

- `MarketPriorityPage` + компоненты `market-priority/*`
- Композиция: Pulse → In Play → Liquidity → Volatility (mobile); desktop grid 3 колонки
- `market-priority-display.ts` — только отображение, без дубля формул

- Реализован `computeMarketPriority<T>()` в `market-priority-engine.ts`
- QA: `verify-market-priority-engine.ts` + script в `package.json`
- Пороги: `MARKET_PRIORITY_THRESHOLDS`

---

*При изменении порогов обновлять этот файл, `MARKET_PRIORITY_THRESHOLDS` и `verify-market-priority-engine.ts`; затем `AI_SESSION_STATE.md`.*
