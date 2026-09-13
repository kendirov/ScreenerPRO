# AI_SESSION_STATE — Лаборатория рынка

---

## Текущая задача

**Trading Preparation v1 — Global Market Cockpit** (2026-09-13)

- Branch: `codex/trading-preparation-v1-2026-09-13`
- Route: `/trading/preparation`
- Реальные источники: MOEX ISS и существующий Yahoo Finance chart adapter
- Реализовано: fixed anchors, explainable anomalies, fullscreen, Freeze Snapshot, session ribbon, Full Market Map, search/show-all, futures current/next/roll/DTE, source/timestamp/quality states
- Честные ограничения: macro/rates и calendar пока не подключены; weekend proxy отключён до отдельного instrument discovery
- Документация: `docs/PREPARATION_GLOBAL_COCKPIT.md`
- Production: не изменён

---

## Предыдущая задача

**Strategy Scanner v0 — round-levels small universe** (2026-07-08)

- Цель: первый batch scan `round-levels` по small universe 5–10 тикеров
- `frontend/lib/strategies/strategy-runner-types.ts` ✅
- `frontend/lib/strategies/round-levels-strategy-runner.ts` ✅
- `frontend/scripts/scan-round-levels-strategy.ts` ✅
- JSON snapshot: `frontend/public/strategy-runs/round-levels-stocks-5m-10d.json` ✅
- verify script: `frontend/scripts/verify-strategy-scan-result.ts` ✅
- docs updated: `docs/STRATEGY_SCANNER_ARCHITECTURE.md`, `AI_SESSION_STATE.md` ✅

**Фокус:** `/screener/strategies` only

**Изменённые файлы:**
- `frontend/lib/screener/strategies/strategy-candle-range.ts` (new)
- `frontend/lib/server/services/strategy-candles.ts` (new)
- `frontend/lib/hooks/use-strategy-candles.ts`
- `frontend/lib/screener/strategies/strategy-candles.ts`
- `frontend/app/api/screener/stocks/candles/route.ts`
- `frontend/components/screener/strategies/strategy-lab-page.tsx`
- `frontend/components/strategies/strategy-candlestick-chart.tsx`
- `frontend/scripts/verify-strategy-candle-range.ts` (new)
- `frontend/package.json`
- `docs/STRATEGY_LAB_TARGET.md`
- `docs/ROUND_LEVELS_STRATEGY.md`
- `docs/STRATEGY_SCANNER_ARCHITECTURE.md`
- `frontend/lib/strategies/strategy-runner-types.ts`
- `frontend/lib/strategies/round-levels-strategy-runner.ts`
- `frontend/scripts/scan-round-levels-strategy.ts`
- `frontend/scripts/verify-strategy-scan-result.ts`
- `AI_SESSION_STATE.md`

---

## Фокус продукта

| Маршрут | Роль | Статус |
|---------|------|--------|
| `/screener/strategies` | **Strategy Lab** | v0 demo-ready |
| `/screener/stocks` | Главный рабочий скринер | стабилен |
| `/screener/futures` | Фьючерсы | не трогать |

Документация: `docs/STRATEGY_LAB_TARGET.md`, `docs/ROUND_LEVELS_STRATEGY.md`, `docs/ZIGZAG_LITE_STRATEGY_LAYER.md`, `docs/STRATEGY_SCANNER_ARCHITECTURE.md`

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend verify:round-levels
pnpm -C frontend verify:round-buffer-direction
pnpm -C frontend verify:zigzag-lite
pnpm -C frontend strategy:scan:round-levels:v0
pnpm -C frontend verify:strategy-scan-result
pnpm -C frontend build
```

**Debug URL:** `/screener/strategies?screenerChartDebug=1`
