# Strategy Chart Browser Parity Audit

**ScreenerPRO · `/screener/strategies` · Strategy Lab chart**  
**Дата:** 2026-07-07  
**Статус:** browser parity diagnostics panel (`?screenerChartDebug=1`)

Связанные документы: `docs/STRATEGY_CHART_RUNTIME_DIAGNOSTICS.md`, `docs/STRATEGY_LAB_CHART_AUDIT.md`

---

## Как открыть browser parity diagnostics

```
/screener/strategies?secid=GAZP&interval=5&screenerChartDebug=1
```

Над графиком появляются две панели:

1. **Browser parity diagnostics** — среда браузера, bundle marker, lifecycle, localStorage
2. **Chart runtime diagnostics** — TradingView series / setData / canvas / coordinates

Файлы:

| Файл | Роль |
|------|------|
| `frontend/lib/strategies/strategy-chart-browser-parity.ts` | runtime marker, localStorage audit, stale bundle detection |
| `frontend/components/strategies/strategy-chart-browser-parity-debug-panel.tsx` | UI browser parity panel |
| `frontend/lib/strategies/strategy-chart-runtime-diagnostics.ts` | chart runtime values |
| `frontend/components/strategies/strategy-chart-runtime-debug-panel.tsx` | UI chart runtime panel |
| `frontend/components/screener/strategies/strategy-lab-page.tsx` | query param, сбор parity + runtime |

---

## A. Почему Cursor browser и обычный browser могут отличаться

| Фактор | Cursor embedded browser | Обычный browser (Chrome/Safari/Firefox) |
|--------|-------------------------|-------------------------------------------|
| **JS bundle cache** | Часто свежий dev/HMR, отдельный cache profile | Может держать старый `_next/static` chunk после deploy |
| **Service worker / HTTP cache** | Реже | `Cache-Control`, bfcache, aggressive disk cache |
| **localStorage / sessionStorage** | Отдельный storage partition | Свои ключи; chart-risk overrides только здесь |
| **devicePixelRatio / canvas** | Может отличаться от основного браузера | Влияет на bitmap vs CSS size |
| **React Strict Mode** | Одинаково в dev | double mount → mount count > 1 в dev |
| **Viewport / split panel** | Узкая встроенная панель | Полноэкранный layout → другой resize timing |
| **Extensions** | Минимум | Ad blockers, privacy extensions |

**Типичный сценарий blank chart в обычном браузере при рабочем Cursor:**

1. **Stale bundle** — старый `strategy-candlestick-chart` chunk без fix setData/lifecycle
2. **Lifecycle race** — chart created, но `setDataCallCount = 0` или `seriesDataLength = 0`
3. **Layout** — `canvas bitmap` сильно меньше `canvas CSS` до resize
4. **localStorage override** — chart-risk key форсирует synthetic/offline/overlay state (редко, но панель подсвечивает)

---

## B. Runtime поля в browser parity panel

### Browser / bundle

| Поле | Назначение |
|------|------------|
| `userAgent` | Идентификация браузера |
| `current URL` | Полный URL с query params |
| `devicePixelRatio` | DPR для canvas bitmap |
| `runtimeSessionId` | Короткий id сессии вкладки |
| `runtime version` | Актуальный runtime marker для Strategy Lab chart |
| `expected version` | Версия, которую ожидает текущий bundle |
| `bundle mountedAt` | ISO timestamp первой загрузки Strategy Lab bundle |
| `bundle version` | `STRATEGY_LAB_PAGE_VERSION` из текущего JS |
| `chart component version` | `STRATEGY_CHART_COMPONENT_VERSION` |
| `chart version registered` | Chart mount вызвал register — yes/no |
| `registered chart version` | Версия, записанная при mount chart |

### React lifecycle

| Поле | Назначение |
|------|------------|
| `route mountedAt` | Timestamp mount StrategyLabPage |
| `page mount count` | Сколько раз смонтировалась страница (Strict Mode → 2 в dev) |
| `chart mount count` | Сколько раз смонтировался chart component |
| `chartReadyRevision` | Инкремент после createChart / resize init |
| `dataRevision` | Инкремент при смене `chartCandles` |
| `candles version/hash` | `length:firstTime:lastTime:lastClose` |
| `overlays enabled` | Prod overlays on/off (в debug mode всегда no) |

### setData / series

| Поле | Назначение |
|------|------------|
| `chart created` | createChart выполнен |
| `series created` | candlestick series добавлена |
| `setDataCallCount` | Сколько раз вызывался setData path |
| `lastSetDataAt` | ISO timestamp последнего setData |
| `lastSetDataReason` | Причина: `candles:N`, `empty-candles`, `invalid-candles`, `setData-error` |
| `seriesDataLength` | `series.data().length` |
| `visibleLogicalRange` | Logical range time scale |
| `lastValueData.noData` | Series пуста после setData |

### Layout / canvas

| Поле | Назначение |
|------|------------|
| `container CSS size` | clientWidth × clientHeight |
| `canvas bitmap size` | canvas.width × canvas.height |
| `canvas CSS size` | getBoundingClientRect canvas |

### localStorage (strategy)

Аудит известных ключей + scan всех keys с `strategy` / `screener.strategy`.  
**Chart-risk keys** подсвечиваются amber, если present.

---

## C. Как отличить: stale bundle vs lifecycle race vs layout issue

| Симптом в panel | Диагноз | Действие |
|-----------------|---------|----------|
| Warning **"Client bundle may be stale"** | Stale bundle | Hard refresh (Cmd+Shift+R), clear site data, сравнить `bundle version` / `chart component version` между браузерами |
| `bundle version` или `chart component version` **различаются** между Cursor и Chrome | Stale bundle | То же + проверить Network → JS chunks not `(disk cache)` |
| `runtimeSessionId` новый, но `chart component version` старый vs docs | Stale bundle | Rebuild `pnpm -C frontend build`, restart dev server |
| `setDataCallCount = 0` при candles > 0 | Lifecycle race | Смотреть chart runtime panel; chart created но setData не дошёл |
| `seriesDataLength = 0` при `setDataCallCount > 0` | setData / data issue | invalid candles, setData error |
| `lastValueData.noData = yes` | Series empty | Проверить normalization / empty setData |
| `canvas bitmap` << `canvas CSS` (×1.5+) | Layout / resize | Resize окно, сравнить после полного layout |
| `visibleLogicalRange` null, coords `—` | Time scale | fitContent / timing |
| Всё yes, coords finite, свечей нет только в prod | Overlays / z-index | `?screenerChartDebug=1` изолирует overlays |
| Chart-risk localStorage key present | Storage override | Удалить ключ в DevTools → Application → Local Storage |

---

## D. Что делать при blank chart

### 1. Включить diagnostics

```
/screener/strategies?secid=GAZP&interval=5&screenerChartDebug=1
```

### 2. Сравнить Cursor vs обычный browser

Скопировать из **Browser parity diagnostics**:

- `runtime version`, `expected version`
- `runtimeSessionId`, `bundle mountedAt`, `bundle version`
- `chart component version`, `chart version registered`
- `page mount count`, `chart mount count`
- `setDataCallCount`, `lastSetDataReason`
- `candles version/hash`
- `localStorage` chart-risk keys

### 3. Stale bundle checklist

1. Hard refresh: **Cmd+Shift+R** (Mac) / **Ctrl+Shift+R** (Win)
2. DevTools → Application → Clear site data (localhost)
3. DevTools → Network → Disable cache (while open)
4. Сравнить `STRATEGY_CHART_COMPONENT_VERSION` в panel с актуальным в репозитории
5. Перезапустить `pnpm -C frontend dev:live`
6. Если сомневаетесь, нажать **Reload chart fresh** — panel добавит `chartBust=<timestamp>` и перезагрузит страницу
7. Если есть старые strategy keys, нажать **Reset Strategy Lab state**

### 4. Lifecycle checklist

- `setDataCallCount` должен быть ≥ 1 после загрузки GAZP 5m
- `seriesDataLength` должен совпадать с candle count
- `chartReadyRevision` должен инкрементироваться после resize

### 5. Layout checklist

- `container CSS size` > 100×200
- `canvas bitmap` ≈ `canvas CSS` (с учётом DPR)

---

## localStorage keys (audit list)

| Key | Chart risk | Note |
|-----|------------|------|
| `screener.strategyLab.secid` | no | selected instrument |
| `screener.strategyLab.timeframe` | no | timeframe minutes |
| `screener.strategyLab.dataSource` | **yes** | can force synthetic/offline |
| `screener.strategyLab.chartDebugSource` | **yes** | moex vs synthetic override |
| `screener.strategyLab.overlays` | **yes** | overlay toggles |
| `screener.strategyLab.layers` | **yes** | strategy layer toggles |
| `screener.strategyChart.componentVersion` | no | sessionStorage — last registered chart bundle |
| `screener.strategyLab.runtimeMarker` | no | sessionStorage — runtime session marker |

Любой другой key с `strategy` в имени также показывается и помечается chart-risk.

---

## Быстрый reset / cache-bust

### Reset Strategy Lab state

Кнопка в `?screenerChartDebug=1`:

- удаляет только strategy-related `localStorage` / `sessionStorage` keys
- не трогает глобальные app settings
- открывает страницу заново с `chartBust=<timestamp>`

Типично очищаются:

- `screener.strategyLab.secid`
- `screener.strategyLab.timeframe`
- `screener.strategyLab.dataSource`
- `screener.strategyLab.chartDebugSource`
- `screener.strategyLab.overlays`
- `screener.strategyLab.layers`
- `screener.strategyChart.componentVersion`
- `screener.strategyLab.runtimeMarker`
- `screener.strategyLab.runtimeVersion`
- любые другие keys с `strategy` / `strategylab`

### Reload chart fresh

Кнопка:

- обновляет query param `chartBust=Date.now()`
- делает `location.reload()`

Использовать, когда хотите отличить stale browser state от реального chart bug без полного reset storage.

### Что смотреть в debug panel

1. `runtime version` vs `expected version`
2. `chart component version` / `registered chart version`
3. `current URL` и `chartBust`
4. `setDataCallCount`, `lastSetDataReason`
5. `base visible`, `seriesDataLength`, `lastValueData.noData`
6. chart-risk localStorage keys

---

## Version markers (2026-07-07)

| Marker | Value |
|--------|-------|
| `STRATEGY_LAB_PAGE_VERSION` | `2026-07-07-browser-parity-1` |
| `STRATEGY_CHART_COMPONENT_VERSION` | `2026-07-07-browser-parity-1` |
| `STRATEGY_LAB_RUNTIME_VERSION` | `strategy-lab-chart-v3-self-healing` |

Bump при изменении chart/lab bundle для stale detection.
