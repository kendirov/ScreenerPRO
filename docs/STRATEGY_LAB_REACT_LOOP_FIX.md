# Strategy Lab — React render loop fix

**ScreenerPRO · `/screener/strategies`**  
**Дата:** 2026-07-08  
**Фокус:** `StrategyCandlestickChart`, `StrategyRoundLevelOverlay`, `StrategyLabPage`

---

## Симптомы

На `/screener/strategies` в консоли React:

1. `Maximum update depth exceeded` — `strategy-candlestick-chart.tsx` → `setBaseCandlesVisible(false)`
2. `Maximum update depth exceeded` — `strategy-candlestick-chart.tsx` → `onOverlayDiagnosticsRef.current?.(...)`
3. `Maximum update depth exceeded` — `strategy-round-level-overlay.tsx` → `setBands(rects)`

---

## Корневые причины

### 1. `setBaseCandlesVisible` без guard

`scheduleApplyDiagnostics` и `applyCandleData` вызывали `setBaseCandlesVisible(value)` напрямую, а также **на каждый** diagnostics pass увеличивали `layoutRevision`. Даже при неизменном `baseVisible` это давало лишние re-render → повторный self-heal / overlay sync → снова diagnostics.

### 2. `publishOverlayDiagnostics` синхронно на каждый patch

Каждый вызов создавал новый объект и сразу дергал parent `setOverlayDiagnostics`, даже если числа не менялись. Parent re-render → chart re-render → price lines / buffer overlay effects → снова publish.

### 3. `setBands` + diagnostics callback в overlay

`StrategyRoundLevelOverlay` хранил bands в `useState` и вызывал `onBufferDiagnostics` синхронно внутри `subscribeVisibleLogicalRangeChange`. Координаты `priceToCoordinate` менялись при zoom/pan; даже с signature-check `setBands([])` с новым `[]` reference и немедленный parent setState могли каскадировать обновления.

### 4. Parent callbacks без стабилизации

`StrategyLabPage` передавал `setChartSize`, `setOverlayDiagnostics`, `setRuntimeDiagnostics` напрямую — без `useCallback` и без сравнения `prev`/`next`.

---

## Исправления

### `strategy-candlestick-chart.tsx`

| Guard | Описание |
|-------|----------|
| `setBaseCandlesVisibleSafe` | `setState(prev => prev === next ? prev : next)` |
| `setDebugWarningSafe` | то же для debug banner |
| `layoutRevision` | инкремент **только** когда `baseVisible` реально изменился |
| `stableOverlayDiagnosticsSignature` | JSON-signature overlay diagnostics |
| `publishOverlayDiagnostics` | merge → signature check → `requestAnimationFrame` → callback |
| `overlayPublishRafRef` | cancel on unmount |
| `stableRuntimeDiagnosticsSignature` | runtime diagnostics без `collectedAt` |
| `publishRuntimeDiagnostics` | signature guard перед parent callback |

### `strategy-round-level-overlay.tsx`

| Guard | Описание |
|-------|----------|
| `bands` | вычисляются через `useMemo` (`overlaySnapshot.bands`), не отдельный `setBands` loop |
| `visibleRangeRevision` | bump только при изменении `stableBufferRectsSignature` |
| `stableBufferRectsSignature` | rounded `top`/`height` для стабильности |
| `publishDiagnosticsSafe` | signature + `requestAnimationFrame` |
| `levelsSignature` | stable primitive dep вместо object ref churn |
| Убран `bufferDiagnostics` state | diagnostics из `useMemo` snapshot |

### `strategy-lab-page.tsx`

| Callback | Guard |
|----------|-------|
| `handleChartDiagnostics` | `useCallback` + `chartDiagnosticsEqual` |
| `handleOverlayDiagnostics` | `useCallback` + `overlayDiagnosticsEqual` |
| `handleRuntimeDiagnostics` | `useCallback` + `runtimeDiagnosticsEqual` |
| `handleChartDebugState` | `useCallback` + `chartDebugStateEqual` |

---

## Проверки

```bash
pnpm -C frontend build                      # pass
pnpm -C frontend verify:strategy-candles    # pass
pnpm -C frontend verify:round-levels        # pass
pnpm -C frontend verify:round-reactions     # pass
```

### Ручная проверка

- `/screener/strategies` — график виден, нет `Maximum update depth exceeded`
- `/screener/strategies?screenerChartDebug=1` — debug panels не вызывают loop
- toggles Уровни / Буферы / Реакции — без зависания
- zoom/pan buffer zones — bands обновляются, без loop

---

## Изменённые файлы

- `frontend/components/strategies/strategy-candlestick-chart.tsx`
- `frontend/components/strategies/strategy-round-level-overlay.tsx`
- `frontend/components/screener/strategies/strategy-lab-page.tsx`
- `docs/STRATEGY_LAB_REACT_LOOP_FIX.md` (этот документ)
