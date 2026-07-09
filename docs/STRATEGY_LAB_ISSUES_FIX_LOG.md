# Strategy Lab Issues Fix Log

**Дата:** 2026-07-07  
**Фокус:** только `/screener/strategies`, Strategy Lab chart, текущие TypeScript / ESLint / build issues

---

## Исходное состояние

Проверки перед фиксом:

- `pnpm -C frontend build` -> **pass**
- `pnpm -C frontend lint .` -> в репозитории есть много посторонних lint-ошибок вне Strategy Lab
- По зоне Strategy Lab были актуальны **4 IDE/lint issues** + 2 warnings в связанных chart-файлах

---

## Ошибки и фиксы

### 1. `strategy-lab-page.tsx` -> `react-hooks/set-state-in-effect`

**Файл:** `frontend/components/screener/strategies/strategy-lab-page.tsx`

Проблемы:

1. `setHasMounted(true)` внутри `useEffect`
2. `setDataRevision(...)` внутри `useEffect`
3. `setSelectedLevelPrice(...)` внутри `useEffect`
4. `setChartDebugSource("moex")` внутри `useEffect`

Почему появились:

- debug/runtime state был собран через локальный `useState` + синхронные `setState` в эффектах;
- часть значений на самом деле производные и не требовали отдельного effect-driven state.

Минимальный фикс:

- `hasMounted` переведён на `React.useSyncExternalStore(...)` для client-only render gate без `setState` в effect;
- `routeMountCount` инициализируется один раз через lazy `useState`;
- `dataRevision` переведён в `ref`;
- выбранный уровень сделан производным значением от `manualSelectedLevelPrice + levels + priceRange`;
- debug source теперь читается через `effectiveChartDebugSource`, без принудительного reset в effect.

---

### 2. `strategy-candlestick-chart.tsx` -> `react-hooks/refs`

**Файл:** `frontend/components/strategies/strategy-candlestick-chart.tsx`

Проблемы:

- обновление callback refs во время render:
  - `onChartDiagnosticsRef.current = ...`
  - `onOverlayDiagnosticsRef.current = ...`
  - `onRuntimeDiagnosticsRef.current = ...`
  - `onChartDebugStateRef.current = ...`
- обновление runtime refs во время render:
  - `latestCandlesRef.current = candles`
  - `latestOptionsRef.current = ...`

Почему появились:

- refs использовались как контейнер актуальных значений для async callbacks, но синхронизировались прямо в render phase.

Минимальный фикс:

- перенос синхронизации всех этих refs в `useEffect`;
- сохранено текущее поведение chart lifecycle и runtime diagnostics, без переписывания архитектуры компонента.

---

### 3. `strategy-round-level-overlay.tsx` -> `react-hooks/refs`

**Файл:** `frontend/components/strategies/strategy-round-level-overlay.tsx`

Проблема:

- `onBufferDiagnosticsRef.current = onBufferDiagnostics` выполнялся во время render.

Почему появилась:

- callback ref синхронизировался напрямую в render phase.

Минимальный фикс:

- перенос обновления `onBufferDiagnosticsRef` в `useEffect`.

---

### 4. `use-strategy-candles.ts` и связанная очистка warning-шума

**Файл:** `frontend/lib/hooks/use-strategy-candles.ts`

Проблема:

- неиспользуемый импорт `StrategyCandlesDiagnostics`.

Почему появилась:

- после упрощения hook тип остался в import list, но больше не использовался.

Минимальный фикс:

- удалён неиспользуемый import.

---

## Изменённые файлы

- `frontend/components/screener/strategies/strategy-lab-page.tsx`
- `frontend/components/strategies/strategy-candlestick-chart.tsx`
- `frontend/components/strategies/strategy-round-level-overlay.tsx`
- `frontend/lib/hooks/use-strategy-candles.ts`
- `docs/STRATEGY_LAB_ISSUES_FIX_LOG.md`
- `AI_SESSION_STATE.md`

---

## Что не трогали

- `/screener/stocks`
- `/screener/futures`
- market priority
- stock screener
- новые фичи Strategy Lab
- математику round levels / reactions
- визуал графика, кроме внутренних технических исправлений состояния и refs

---

## Финальный статус

- `pnpm -C frontend build` -> **pass**
- Точечный lint по Strategy Lab chart-файлам -> **pass**
- Strategy Lab chart остаётся в фокусе как стабилизация build/issues, без функционального расширения
