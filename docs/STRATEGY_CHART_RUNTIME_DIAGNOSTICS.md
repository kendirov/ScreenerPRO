# Strategy Chart Runtime Diagnostics

**ScreenerPRO · `/screener/strategies` · Strategy Lab chart**  
**Дата:** 2026-07-07  
**Статус:** runtime diagnostics panel добавлена (`?screenerChartDebug=1`)

Связанные документы: `docs/STRATEGY_LAB_CHART_AUDIT.md`, `docs/STRATEGY_LAB_TARGET.md`

---

## Как включить

```
/screener/strategies?secid=GAZP&interval=5&screenerChartDebug=1
```

Панель **Chart runtime diagnostics** появляется над графиком. В debug mode overlays принудительно отключены:

- round levels / price lines
- buffer zones / SVG
- reactions / markers
- volume histogram

Только чистый candlestick chart + runtime values в UI.

Файлы:

| Файл | Роль |
|------|------|
| `frontend/lib/strategies/strategy-chart-runtime-diagnostics.ts` | сбор diagnostics + `inferStrategyChartBlankCause()` |
| `frontend/components/strategies/strategy-chart-runtime-debug-panel.tsx` | UI панель |
| `frontend/components/strategies/strategy-candlestick-chart.tsx` | `chartDebug` prop, сбор после setData |
| `frontend/components/screener/strategies/strategy-lab-page.tsx` | query param `screenerChartDebug=1` |

---

## A. Что видно / не видно (runtime 2026-07-07 ~10:38 МСК)

### С `?screenerChartDebug=1` (изолированный chart)

| Элемент | Статус |
|---------|--------|
| Price scale (правая ось) | ✅ видна |
| TradingView watermark | ✅ видна |
| Time scale | ✅ видна |
| **Candlestick bodies / wicks** | ✅ **видны** (Playwright screenshot + diagnostics) |
| Price lines / buffers / markers / volume | ⏸ принудительно off |

### Без debug param (production overlays on)

| Элемент | Статус |
|---------|--------|
| Price scale | ✅ |
| Price lines + labels уровней | ✅ |
| Touch/reaction markers | ✅ |
| Buffer zones | ✅ |
| Volume pane | ✅ |
| **Candles** | ✅ **видны** (Playwright screenshot) |

### Исходный симптом пользователя

> Chart instance есть, scale/watermark/price lines есть, «Свечей N» в панели есть, **свечей не видно**.

Это указывает на рассинхрон **data pipeline (hook → stats)** и **chart series (setData)** — не на отсутствие MOEX данных.

---

## B. Runtime diagnostics (GAZP 5m, `screenerChartDebug=1`)

Захват: Playwright headless, viewport 1400×900, dev server `:3000`, 2026-07-07 10:38:42.

### Summary

| Метрика | Значение |
|---------|----------|
| **chart created** | **yes** |
| **candlestick series created** | **yes** |
| **setData called** | **yes** |
| **setData candles length** | **41** |
| **series.data().length** | **41** |
| **lastValueData noData** | **no** |
| **lastValue price** | 94.06 |
| **fitContent called** | **yes** |

### Container

| Метрика | Значение |
|---------|----------|
| container width×height | 958×698 |
| canvas count | 7 |
| canvas bitmap (primary) | 904×670 |
| canvas CSS (primary) | 904×670 |
| pane size | 904×670 |

### Time scale

| Метрика | Значение |
|---------|----------|
| timeScale width×height | 904×28 |
| **visibleLogicalRange** | **from 0.00 to 44.00** |
| visibleRange | 1783396740 → 1783408740 |
| **timeToCoordinate(first)** | **9.0** |
| **timeToCoordinate(last)** | **812.6** |

### Price scale

| Метрика | Значение |
|---------|----------|
| **priceToCoordinate(first open)** | **94.1** |
| **priceToCoordinate(last close)** | **262.8** |
| **priceToCoordinate(min low)** | **521.6** |
| **priceToCoordinate(max high)** | **53.6** |

### Candles

| | time (unix) | MSK | O | H | L | C |
|---|-------------|-----|---|---|---|---|
| first | 1783396740 | 06:59 | 94.81 | 94.99 | 94.8 | 94.88 |
| last | 1783408740 | 10:19 | 94.21 | 94.21 | 94.0 | 94.06 |

### Errors

| Метрика | Значение |
|---------|----------|
| createSeries error | — |
| setData error | — |
| invalid time/OHLC count | 0 |

---

## C. Где причина

### Диагностика текущего runtime (2026-07-07)

При `?screenerChartDebug=1` **все слои data/series/time/price в норме**:

- series создана, `setData` прошёл, `series.data().length === 41`
- `lastValueData.noData === false`
- `timeToCoordinate` / `priceToCoordinate` возвращают finite координаты
- canvas bitmap совпадает с CSS (904×670)

**Вывод:** в текущей сборке свечи рендерятся. Исходный симптом «stats есть, свечей нет» — **не data fetch** и **не normalization**.

### Наиболее вероятная причина исходного симптома

| Слой | Вероятность | Обоснование |
|------|-------------|-------------|
| **series / setData timing** | **высокая** | Stats читают `candles[]` из hook напрямую; chart — отдельный effect. Если `setData` не вызван, price lines всё равно рисуются на пустой series (scale + watermark + линии уровней). |
| **visible range / time** | низкая (сейчас) | `fitContent` + valid `timeToCoordinate` — бары в viewport. |
| **CSS / canvas bitmap** | средняя (edge) | Ранний захват показал bitmap **300×150** при CSS **958×670** до HMR/resize — потенциальный first-paint glitch. После resize: 904×670. |
| **overlay** | средняя (prod only) | SVG buffers `z-[2]` не блокируют canvas, но в prod mode много слоёв; debug mode изолирует. |
| **data / normalizer** | исключена | `invalid time/OHLC = 0`, 41 normalized candles. |

### Как отличить по debug panel

| Панель показывает | Причина |
|-------------------|---------|
| `setData called: no` или `series.data().length: 0` | **series/setData timing** — главный подозреваемый |
| `lastValueData noData: yes` при `setData called: yes` | setData с пустым/невалидным массивом |
| `timeToCoordinate first/last: —` | time scale / visible range |
| `priceToCoordinate *: —` | price scale margins |
| `canvas bitmap` << `canvas CSS` | CSS/layout resize не дошёл до bitmap |
| Всё yes, coords finite, свечей нет | overlay / z-index / candle style |

---

## D. Что менять следующим шагом

### P0 — если `setData called: no` в UI

**Файл:** `frontend/components/strategies/strategy-candlestick-chart.tsx`

1. Добавить `candleSeriesApi` в deps effect setData — пересылка данных при пересоздании series после cleanup/remount.
2. Объединить create + setData + fitContent в один effect (паттерн `stock-expanded-chart.tsx`) — убрать race между init и setData.
3. Убрать hard guard `if (!volumeSeries) return` — volume optional; candle `setData` не должен зависеть от histogram series.

### P1 — canvas resize

1. После `createChart` вызвать `chart.applyOptions({ width, height })` в `requestAnimationFrame` когда layout стабилен.
2. В debug panel следить за `canvas bitmap` vs `canvas CSS`.

### P2 — overlays (после стабильных свечей)

1. Включать слои поэтапно: levels → buffers → markers.
2. Сравнивать prod vs `?screenerChartDebug=1`.

### Не трогать

`/screener/stocks`, `/screener/futures`, market priority, round level formulas, reaction formulas.

---

## Verify / build (2026-07-07)

| Команда | Результат |
|---------|----------|
| `pnpm -C frontend verify:strategy-candles` | ✅ pass |
| `pnpm -C frontend build` | ✅ pass |

---

## E. MOEX normalization proof (2026-07-07 10:43 МСК)

### Raw payload (live GAZP 5m)

API:

`GET /api/screener/stocks/candles?view=chart&secid=GAZP&interval=5`

Фактические raw rows:

- `begin/time`: `2026-07-07T06:59:00+03:00` ... `2026-07-07T10:24:00+03:00`
- `open/high/low/close`: finite numbers
- `volume`: finite number
- `value`: есть на уровне серверного MOEX mapper как turnover, но в chart payload не нужен

Live summary:

| Метрика | Значение |
|---------|----------|
| raw count | **42** |
| first begin | **2026-07-07T06:59:00+03:00** |
| last begin | **2026-07-07T10:24:00+03:00** |
| first timestamp | **1783396740** |
| last timestamp | **1783409040** |
| interval diffs | **300 sec only** |

### Exact MOEX fix / conclusion

Дополнительного фикса в `strategy-candles-normalizer.ts` не потребовалось. Проверка показала, что текущая цепочка уже корректна:

1. серверный MOEX mapper превращает `begin` в deterministic ISO `T...+03:00`
2. `parseStrategyCandleBegin()` переводит intraday time в **UNIX seconds**
3. OHLC проходят finite/consistency validation
4. sort + dedupe дают asc series и `duplicateTimeCount`

### Before / after diagnostics

| Срез | Result |
|------|--------|
| before | symptom: candles count есть, свечей не видно |
| after synthetic proof | synthetic candles видны |
| after MOEX proof | **MOEX candles тоже видны** |

MOEX runtime after proof:

| Метрика | Значение |
|---------|----------|
| normalized count | **42** |
| series.data().length | **42** |
| lastValueData.noData | **false** |
| visibleLogicalRange | **from -63.00 to 49.00** |
| first x / last x | **507.0 / 835.0** |
| duration minutes | **205** |
| interval guess | **300 sec** |

Вывод: для GAZP 5m проблема не в MOEX normalization. Runtime values подтверждают, что normalized candles валидны и chart их отображает.

---

## Финальный отчёт (чеклист)

| Вопрос | Ответ |
|--------|-------|
| chart created? | **yes** |
| candlestick series created? | **yes** |
| setData called? | **yes** |
| series.data length? | **41** |
| lastValueData noData? | **no** |
| visibleLogicalRange? | **from 0.00 to 44.00** |
| first/last timeToCoordinate? | **9.0 / 812.6** |
| priceToCoordinate values? | first open **94.1**, last close **262.8**, min low **521.6**, max high **53.6** |
| **точная причина отсутствия свечей** | В текущем runtime свечи **есть**. Для симптома «stats есть, свечей нет» — **`setData` не синхронизирован с lifecycle series** (отдельный effect без `candleSeriesApi` dep + optional volume guard). Подтверждение: `?screenerChartDebug=1` → смотреть `setData called` и `series.data().length`. |
