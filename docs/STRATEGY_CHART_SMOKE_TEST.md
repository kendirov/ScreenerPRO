# Strategy Chart Smoke Test

**ScreenerPRO · `/screener/strategies` · cross-browser smoke**  
**Дата:** 2026-07-07  
**Статус:** plan only, tooling not installed

---

## Current state

At the moment `frontend` does **not** have browser e2e tooling:

- no `@playwright/test` dependency
- no `playwright.config.*`
- no existing `e2e` / `smoke` browser scripts

Because of that, a real browser-level smoke test for candlestick visibility cannot be added safely without introducing a new heavy dependency.

---

## Goal

Stop relying on manual claims like "I can see the chart" and add an automated smoke test that opens Strategy Lab and verifies that the candlestick chart is actually visible.

Target routes:

1. `/screener/strategies?screenerChartDebug=1&chartDebugSource=synthetic`
2. `/screener/strategies?screenerChartDebug=1&chartDebugSource=moex`

Synthetic is the baseline.  
MOEX is the live/runtime proof when dev server can fetch live data.

---

## Recommended implementation

### Tooling

Use **Playwright** with existing app dev server.

Minimum browser:

- `chromium`

Optional if available in environment:

- `firefox`
- `webkit`

### Assertions from debug panel

Smoke must assert:

- `chart created = yes`
- `series created = yes`
- `setData called = yes`
- `series.data().length > 0`
- `base visible = yes`
- `visibleLogicalRange != null`
- chart width `>= 800`
- chart height `>= 500`

### Pixel sanity

If possible, capture chart area screenshot and verify:

- not a single flat background color
- canvas has non-background colored pixels
- chart area is not visually blank

Suggested output paths:

- `frontend/test-results/strategy-chart/chromium.png`
- `frontend/test-results/strategy-chart/synthetic.png`

---

## Proposed file layout

If Playwright is approved:

- `frontend/playwright.config.ts`
- `frontend/tests/strategy-chart.smoke.spec.ts`
- `frontend/test-results/strategy-chart/`

Script:

- `pnpm -C frontend smoke:strategy-chart`

---

## Suggested smoke flow

### 1. Synthetic baseline

Open:

```text
/screener/strategies?screenerChartDebug=1&chartBust=<timestamp>
```

Switch debug source to synthetic or open with explicit source param if implemented.

Assert:

- chart diagnostics panel rendered
- browser parity panel rendered
- chart runtime values indicate visible base candles

Save screenshot:

- `frontend/test-results/strategy-chart/synthetic.png`

### 2. MOEX runtime route

Open:

```text
/screener/strategies?screenerChartDebug=1&chartBust=<timestamp>
```

Use live MOEX route when dev server can fetch it.

Assert same runtime fields.

Save screenshot:

- `frontend/test-results/strategy-chart/chromium.png`

---

## Pass / fail criteria

### Pass

- synthetic smoke passes in Chromium
- MOEX smoke passes in Chromium when live data available
- screenshots show non-blank chart area

### Fail

- chart panel renders but `base visible = no`
- `series.data().length = 0`
- screenshot is blank / monochrome chart body
- debug panel indicates stale runtime or no visible logical range

---

## Minimal next step

To implement this for real, approve adding:

- `@playwright/test` as a dev dependency

Then wire:

1. `playwright.config.ts`
2. one smoke spec for Strategy Lab
3. `smoke:strategy-chart` script
4. screenshot artifacts under `frontend/test-results/strategy-chart`

---

## Why no implementation yet

Without a browser automation dependency, the project currently has no reliable way to:

- launch Chromium/WebKit/Firefox programmatically
- inspect the real rendered chart canvas
- take deterministic screenshots
- distinguish DOM-ok-but-canvas-blank regressions from valid renders

So the correct low-risk step right now is documenting the exact smoke design before introducing tooling.
