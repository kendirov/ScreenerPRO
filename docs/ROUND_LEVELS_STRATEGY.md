# Round Levels Strategy — логика Strategy Lab

**ScreenerPRO · Strategy Lab · `round-levels`**  
**Дата:** 2026-07-07  
**Код:** `frontend/lib/strategies/round-levels-engine.ts`

Связанные документы: `docs/STRATEGY_LAB_TARGET.md`, `AI_SESSION_STATE.md`

**Статус chart overlay (2026-07-07):** price lines **включены** (`showLevelLines`). Buffer SVG и reaction markers — по слоям `strategyLayers`.

---

## Зачем круглые уровни

Круглые цены (90, 95, 100…) и полу-уровни (94.5) часто концентрируют лимитные заявки и внимание участников. В Strategy Lab мы визуализируем эти зоны как **опорные линии** и **буферные коридоры** вокруг них — не как торговый сигнал, а как карту «где рынок может затормозить или отреагировать».

Цель v0: объяснить идею на графике (GAZP, 5m), без полноценного бэктеста.

---

## Как считается шаг (`roundStep`)

Если `roundStep` не задан, выбирается по референсной цене (`currentPrice` или середина диапазона):

| Цена | roundStep |
|------|-----------|
| &lt; 10 | 0.1 |
| 10 – 50 | 0.5 |
| 50 – 200 | 1 |
| 200 – 1000 | 5 |
| 1000 – 5000 | 50 |
| ≥ 5000 | 100 |

Производные:

- `halfStep = roundStep / 2` — полу-уровни (94.5 при шаге 1)
- `majorStep = roundStep × 5` (цена &lt; 1000) или `× 10` (цена ≥ 1000)

Пример **GAZP ~93**: `roundStep = 1`, `halfStep = 0.5`, `majorStep = 5`.

---

## Как считается buffer

Если `bufferSize` не задан:

```
bufferSize = max(3 × minStep, currentPrice × 0.0015)
```

Затем округление к `minStep`.

Для GAZP (93, `minStep = 0.01`):

- `93 × 0.0015 = 0.1395` → **0.14**
- Уровень 93: верхний буфер **93.00 → 93.14**, нижний **92.86 → 93.00**

Буфер — учебная «зона касания», не гарантия отскока.

---

## Importance (важность уровня)

| Значение | Правило |
|----------|---------|
| `psychological` | Кратен `majorStep × 2` или «круглому» уровню 100 / 1000… |
| `major` | Кратен `majorStep` |
| `minor` | Полу-уровень (`halfStep`), не на сетке `roundStep` |
| `normal` | Остальные уровни на сетке `roundStep` |

Пример GAZP 90–100: 100 — psychological, 95 — major, 94.5 — minor, 93 — normal.

---

## API

```ts
computeRoundLevels(config: RoundLevelConfig): RoundLevel[]
roundLevelsFromPriceRange(min, max, currentPrice?, overrides?)
```

Каждый `RoundLevel` содержит: `price`, `label`, `importance`, `step`, `upperBuffer`, `lowerBuffer`.

---

## Визуализация на графике (2026-07-07)

**Компоненты:** `strategy-candlestick-chart.tsx`, `strategy-round-level-overlay.tsx`, `strategy-levels-display.ts`

### Вычисление уровней

Из normalized candles (`strategy-candles-normalizer.ts`):

```
minPrice = min(low)
maxPrice = max(high)
currentPrice = last close
minStep = 0.01  // TQBR fallback
→ computeRoundLevels(...)
```

Фильтр видимости: `filterRoundLevelsForDisplay` — max **40** линий; half levels по toggle; major/psych по toggle.

### Линии уровней (`createPriceLine` на candlestick series)

| Importance | Стиль |
|------------|--------|
| `psychological` | самый заметный cyan/blue, width 3, label на шкале |
| `major` | заметная cyan line, width 2, label на шкале |
| `normal` | спокойная blue-gray line, width 1 |
| `minor` / half | dashed, low opacity |

**axisLabelVisible:** `psychological`, `major`, **выбранный** уровень и ближайшие к нему уровни в локальной зоне, чтобы для GAZP читались `93 / 93.5 / 94 / 94.5 / 95` без перегруза.

### Selected level

- По умолчанию выбран **ближайший круглый уровень** к `last close` (предпочтение round/major над half)
- Клик по уровню в правой панели выбирает level
- Selected level подсвечивается ярче, получает label на шкале и используется для локальной читаемой сетки вокруг текущей цены

### Правая панель: список уровней

Компактная строка уровня показывает:

- `price`
- `type` (`major` / `normal` / `half` / `псих.`)
- `touches`
- `bounce rate`, если аналитика уже есть
- выбранная строка подсвечивается

### v0 UX polish (2026-07-08)

- **Normal mode:** без debug panel, synthetic switch и runtime internals
- **Debug:** только `?screenerChartDebug=1` (runtime + parity + debug strip)
- **Header:** `Круглые числа · GAZP · 5м · TQBR`
- **Toolbar:** Тикер · Загрузить · 5м/10м/30м · **Сегодня/3д/10д/20д** · Буфер авто · Уровни · Буферы · Реакции · Полууровни · Экстремумы
- **Candles summary:** `Свечей: N · период 3д` (compact, normal mode)
- **Chart:** главный элемент, drag/zoom, fit/reset, selected level + directional zones
- **Right panel:** выбранный уровень, подход, зоны, касания/отбой/пробой/пила, список уровней
- **Defaults:** уровни+буферы on; реакции/полууровни/экстремумы off (меньше шума)

**Lifecycle:** `syncRoundLevelPriceLines` — `removePriceLine` всех предыдущих перед пересозданием; не дублировать на каждый render.

**Debug strip:** `levels · buffers · markers · zigzag` + candles fetch (raw/normalized/duplicates/days/fetch requests) — только при `screenerChartDebug=1`

### История свечей (2026-07-08)

Для анализа техничности нужен не один торговый день, а пресеты периода:

| Период | Дней (календарь МСК) | Пример GAZP 5м (live MOEX) |
|--------|----------------------|----------------------------|
| Сегодня | 1 | ~170 свечей (сессия) |
| 3д | 3 | ~511 свечей |
| 10д | 10 | ~1735 свечей |
| 20д | 20 | до cap 5000 |

**Загрузка:** `buildStrategyChartSeries` → MOEX ISS candles с `from`/`till`, пагинация `start` (500/стр), dedupe timestamp, sort asc, cap 5000.

**Нормализация:** `normalizeStrategyCandles` — numeric time (seconds), no NaN, duplicate time collapsed.

**Verify:** `pnpm -C frontend verify:strategy-candle-range`

### Буферные зоны (v0, 2026-07-07)

**Код:** `frontend/lib/strategies/strategy-buffer-zone-overlay.ts`, `strategy-round-level-overlay.tsx`, `round-buffer-direction-engine.ts`

#### Directional buffer (2026-07-08 / active approaches 2026-07-08)

Буферные зоны **не статичны «верх/низ»** — они зависят от **направления подхода** цены к круглому уровню.

| Роль | Цвет (v0) | Смысл |
|------|-----------|--------|
| **Зона реакции** (`reactionZone`) | мягкий cyan / green | где цена может замедлиться или отреагировать **перед** уровнем |
| **Зона слома** (`breakZone`) | мягкий red / amber | где ожидается пробой **за** уровнем |

#### Active approaches

Начиная с active-approaches слоя, буфер рисуется не как вечная горизонтальная полоса на всю ширину, а как **временной сегмент подхода к уровню**.

**Код:** `frontend/lib/strategies/round-level-approach-engine.ts`

`RoundLevelApproachSegment` описывает один конкретный подход цены к круглому уровню:

- `direction`: `up` / `down`
- `fromIndex → toIndex`
- `startTime → endTime`
- `reactionZone`
- `breakZone`
- `outcome` (`bounce` / `breakout` / `false_break` / `chop` / `pending`)

#### Источник направления

1. Если есть **ZigZag-lite segments**, они используются как главный источник движения:
   - `up` segment → ищем уровни выше цены на участке
   - `down` segment → ищем уровни ниже цены на участке
2. Если ZigZag segment нет, включается **fallback**:
   - direction runs по `close N bars`
   - сегменты строятся по серии целиком, а не только по последним барам

#### Target level selection

Для каждого directional movement segment:

- `up` → берутся все уровни, которые лежат выше `startPrice` и были достигнуты в диапазоне `high/low` движения;
- `down` → берутся все уровни ниже `startPrice`, которых достиг диапазон `high/low` движения;
- если на одном движении цена прошла несколько уровней, создаётся **несколько** `RoundLevelApproachSegment`, по одному на каждый уровень.

#### Правила зон

При `buffer = B`, `level = L`:

| Направление | Reaction zone | Break zone |
|-------------|---------------|------------|
| `up` | `[L-B, L]` | `[L, L+B]` |
| `down` | `[L, L+B]` | `[L-B, L]` |

#### Time span

Зона рисуется только на участке движения:

- `fromIndex` = старт подхода / pivot
- `toIndex` = первая свеча реакции или конец movement segment

Именно этот интервал переводится в `x startTime → endTime` на overlay.

#### Режим отображения буферов (toolbar)

Компактный selector **Буферы:** (default — **активные**)

| Режим | Что рисуется |
|-------|----------------|
| `активные` | все active approach zones текущей истории (max 120) |
| `выбранный` | directional zones только для selected level |
| `важные` | `major` / `psychological` |
| `все` | все active approaches по non-minor levels, очень низкая opacity |

**Код:** `strategy-buffer-zone-overlay.ts` → `filterLevelsForBufferDisplay`, `BufferDisplayMode`

**Opacity (active overlay):**

| Зона | Selected | Non-selected | All (muted) |
|------|----------|--------------|-------------|
| Reaction | 0.14 cyan/green | 0.06 | 0.06 |
| Break | 0.14 red/amber | 0.06 | 0.06 |

**Границы и подписи (selected/latest):**

- SVG dashed lines на границах reaction/break + level line
- Подписи около конца сегмента: `реакция`, `слом`
- `pointer-events: none`, clamp y/height, skip null coords

**Определение направления (v0):**

1. **ZigZag-lite** (toggle «Экстремумы» включён) — `movementDirection` из последнего pivot:
   - `up` → `up_to_level`
   - `down` → `down_to_level`
   - см. `docs/ZIGZAG_LITE_STRATEGY_LAYER.md`
2. **Fallback** — сравнение `last close` с `close` N свечей назад (по умолчанию N=6):

- `close` вырос → `up_to_level` (подход снизу вверх)
- `close` упал → `down_to_level` (подход сверху вниз)
- дельта меньше `minApproachDelta` (≈ max(0.01, price×0.0005)) или мало свечей → `unknown`

3. **Для соседних уровней** (режимы `ближайшие` / `важные` / `все`) — эвристика `currentPrice` vs `levelPrice`.

**Правила зон** (buffer = B, level = L):

| Направление | Зона реакции | Зона слома |
|-------------|--------------|------------|
| `up_to_level` | [L−B, L] | [L, L+B] |
| `down_to_level` | [L, L+B] | [L−B, L] |

**Примеры (buffer = 0.15):**

- Уровень **95**, подход **снизу вверх**: реакция **94.85–95.00**, слом **95.00–95.15**
- Уровень **93**, подход **сверху вниз**: реакция **93.00–93.15**, слом **92.85–93.00**

Active mode: directional zones для history-based approaches; selected level ярче + labels.

**Правая панель / context strip:** Активных подходов · Последний подход · Последний исход · Подход · Зона реакции · Зона слома · Буфер.

**Debug (`?screenerChartDebug=1`):** buffer display mode · selected level · approach direction · zones rendered/skipped · reaction/break values.

**Verify:** `pnpm -C frontend verify:round-buffer-direction`

#### Статичная заливка (legacy, replaced by directional)

Ранее использовалась статичная upper/lower заливка для major/psych. С active-approaches слоя overlay опирается на временные approach segments, а не на full-width bands.

#### Rendering details

1. **Заливка (SVG)** — directional rects на участке `x startTime → endTime`.
2. **Selected rendering** — повышенная opacity + dashed boundaries + labels.
3. **Important / all** — те же approach zones, но muted.
4. **Границы** — SVG dashed lines внутри временного интервала; selected level line ярче.
5. **Координаты** — `timeToCoordinate` + `priceToCoordinate`; null → skip; clamp x/y/width/height к pane.
6. **Пересчёт** — после setData, resize, zoom (visible range), selected level/mode change.
7. **Safety** — `pointer-events: none`, hard max **120** zones, skip NaN, transparent SVG, z-index 2 над canvas.

### ZigZag-lite structure layer

ZigZag внутри Round Levels теперь служит не “для красоты”, а как контекст swing-движения:

- откуда цена подошла к уровню;
- где был swing high / swing low;
- где начался импульс;
- какой segment вошёл в активную buffer zone.

UI mode:

- `Выкл`
- `Важные` (default)
- `Все`

В режиме `Важные` используются более строгие pivots и labels `H/L`, а в режиме `Все` показывается более плотная структура без перегруза подписями.

**Debug:** `buffer mode selected · zones rendered 1 · approach up_to_level · reaction 93.86–94.00 · break 94.00–94.14`

**Verify:** `pnpm -C frontend verify:buffer-zones`

### Плотность

- Максимум **40** видимых уровней (`filterRoundLevelsForDisplay`).
- При переполнении: скрыть minor → оставить ближайшие к `currentPrice` → отсортировать по importance.

### Controls (правая панель)

- Полу-уровни on/off
- Major / псих. on/off
- Буферные зоны on/off
- Buffer auto / custom input
- Список уровней (клик = select/highlight)
- Счётчик visible / total levels

---

## Ограничения (v1 engine + overlay)

- Чистая математика уровней — статистика касаний в `round-level-reaction-engine.ts`.
- Максимум **200** уровней на вызов (защита от широкого диапазона).
- Невалидный config → `[]`.
- `minStep` по умолчанию 0.01 для акций; для очень дешёвых бумаг может потребоваться явная передача.
- Психологические уровни заданы эвристикой (100, 1000…), не полным списком «круглых» чисел MOEX.
- SVG bands не привязаны к time range — на всю ширину chart area (v0).
- `lightweight-charts` не поддерживает native horizontal bands — только price lines + SVG overlay.

---

## Реакции и техничность (2026-07-08)

**Код:** `frontend/lib/strategies/round-level-reaction-engine.ts`  
**Verify:** `pnpm -C frontend verify:round-reactions`

### Touch cluster (касание)

Свеча касается уровня, если `[candle.low, candle.high]` пересекает симметричный буфер `[level − buffer, level + buffer]`.

- Несколько подряд идущих свечей внутри зоны = **один** touch cluster
- Новый touch — только после выхода из зоны и повторного входа

### Approach (подход)

| Значение | Условие |
|----------|---------|
| `from_above` | prev close выше верхней границы touch-зоны |
| `from_below` | prev close ниже нижней границы touch-зоны |
| `inside` | иначе |

### Reaction window (по таймфрейму)

| ТФ | Свечей |
|----|--------|
| 5м | 8 |
| 10м | 6 |
| 30м | 4 |

### Max dive (нырок)

Против идеи отбоя — насколько цена ушла **за уровень / зону слома**:

- **from_above:** `max(0, breakLine − low)` где `breakLine = lowerBuffer.from`
- **from_below:** `max(0, high − breakLine)` где `breakLine = upperBuffer.to`

Считаются `maxDiveAbs`, `maxDivePct`, `barsToMaxDive`.

### Max bounce (отскок)

В сторону ожидаемой реакции:

- **from_above:** `max(0, high − level)` — отскок вверх
- **from_below:** `max(0, level − low)` — отскок вниз

Считаются `maxBounceAbs`, `maxBouncePct`, `barsToMaxBounce`.

### Outcomes

Пороги от `bufferSize` (расстояние level → upperBuffer.to):

| Outcome | Условие |
|---------|---------|
| `bounce` | bounce ≥ buffer×1.5, dive ≤ buffer×1.2, нет закрепления за зоной слома |
| `breakout` | закрепление за зоной слома + continuation ≥ buffer×1.5 |
| `false_break` | dive > buffer×1.2, затем возврат и bounce ≥ buffer×1.2 |
| `chop` | нет чистого bounce/breakout/false_break, пила в зоне |
| `pending` | мало будущих свечей в окне |

### Cleanliness score (0–100)

На каждое касание: больше bounce / меньше dive / быстрее реакция / выше объём → выше score.

### Level technicality

`RoundLevelTechnicalityStats` на уровень: rates по outcomes, avg dive/bounce, `technicalityScore` (0–100).

### Instrument summary

`totalTouches`, rates, `avgBounce`/`avgDive`, `bestLevels`/`worstLevels`, `instrumentTechnicalityScore`, `sampleWarning`.

### Instrument technicality score (0–100)

Модель для `instrumentTechnicalityScore`:

- `0.30 * averageLevelScoreTopLevels`
- `0.20 * touchSampleQuality`
- `0.20 * bounceBreakClarity`
- `0.15 * lowChopPenaltyInverse`
- `0.15 * reactionSpeedQuality`

Где:

- **averageLevelScoreTopLevels** — среднее `technicalityScore` топ-5 уровней с `touches >= 3`
- **touchSampleQuality**:
  - `100`, если `totalTouches >= 50`
  - `70`, если `>= 25`
  - `40`, если `>= 10`
  - `15`, если `< 10`
- **bounceBreakClarity** — выше, когда исходы уходят из `chop`, а отбой и чистый пробой доминируют
- **lowChopPenaltyInverse** — `100 - chopRate*100`
- **reactionSpeedQuality** — 1–4 свечи отлично, 5–8 нормально, дальше score снижается

### UI score label

В summary:

- `80+` → **отлично**
- `65–79` → **хорошо**
- `45–64` → **средне**
- `<45` → **шумно**

Дополнительно:

- короткая расшифровка badge:
  - `хорошо: инструмент часто реагирует на уровни, но есть ложные пробои`
  - `средне: реакции есть, но часть касаний уходит в пилу`
- human explanation:
  - `Сильные стороны: много касаний, быстрые реакции, сильные уровни 94 / 95`
  - `Слабое место: ложные пробои 28%`
  - fallback: `Слабое место: выраженной шумной зоны пока не видно`

### Explainable score decomposition

В блоке **«Почему такая оценка»** показываются те же компоненты, из которых собирается `instrumentTechnicalityScore`:

- **Уровни** — `averageLevelScoreTopLevels`
- **Выборка** — `touchSampleQuality`
- **Чистота реакций** — `bounceBreakClarity`
- **Мало пилы** — `lowChopPenaltyInverse`
- **Скорость** — `reactionSpeedQuality`

Все 5 значений показываются как `N/100`, без торговых рекомендаций, только как аналитика поведения уровней.

### Отрисовка markers

Toggle «Реакции»; selected level; max **80**. Цвета: bounce=blue, breakout=red, false_break=amber, chop=gray. Метки: `B` / `X` / `F` / `·`.

### Нижний аналитический блок

Под графиком — три зоны:

1. **Сводка техничности инструмента**
   - оценка техничности 0–100
   - explainable decomposition: уровни / выборка / чистота / мало пилы / скорость
   - касания
   - отбой / пробой / ложный пробой / пила
   - ср. отскок / ср. нырок / среднее время реакции
2. **Таблица уровней**
   - уровень, тип, касания, rates по outcomes
   - ср. отскок / ср. нырок
   - `technicalityScore`
   - сортировка: selected level first → далее score desc
3. **Лента касаний выбранного уровня**
   - время
   - подход
   - outcome
   - нырок / отскок
   - свечей до решения
   - объём xN, если есть

Если истории мало, показывается warning: **«Статистика предварительная: мало истории»**.  
Если по выбранному уровню касаний нет: **«По уровню 94.5 касаний нет»**.

### Ограничения аналитики

- Не PnL — учебная эвристика
- Break / bounce / false_break по окну следующих свечей
- Markers только для selected level

---

## Verify

```bash
pnpm -C frontend verify:round-levels
pnpm -C frontend verify:round-reactions
```

Кейсы: GAZP-like 90–100, high price 3000, low price 2.5, no NaN, cap 200.
