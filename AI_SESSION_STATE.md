# AI_SESSION_STATE — Лаборатория рынка

---

## Текущая задача

**Bitget Global Screener v1 — полный публичный UTA universe** (2026-08-11)

Цель: добавить в существующий ScreenerPRO отдельный рабочий decision terminal `/screener/bitget`, не ломая стабильные MOEX-маршруты.

Реализовано в ветке `feature/bitget-global-screener-v1`:

- `frontend/lib/bitget/types.ts` — контракт данных Bitget screener;
- `frontend/lib/server/services/bitget-market.ts` — адаптер публичного Bitget UTA v3;
- `frontend/app/api/bitget/screener/route.ts` — bulk API для UI;
- `frontend/components/bitget/bitget-global-screener.tsx` — рабочий экран;
- `frontend/app/(app)/screener/bitget/page.tsx` — маршрут;
- `docs/BITGET_GLOBAL_SCREENER.md` — логика и ограничения.

Экран v1:

- весь публичный universe из `SPOT`, `MARGIN`, `USDT-FUTURES`, `USDC-FUTURES`, `COIN-FUTURES`;
- автоматическая классификация crypto spot/futures, margin, rToken, stock perps, commodity perps;
- bulk realtime ticker data;
- 24ч move/range/turnover, spread, funding, OI;
- прозрачный `attentionScore` + причины;
- фильтры «В игре / Рост / Падение / Диапазон / Funding»;
- поиск, инспектор, session watchlist;
- компактный briefing view с копированием.

Важно: Stock+ equities/ETFs и options используют отдельный signed Stock+ API и не подмешиваются как будто входят в публичный UTA instruments endpoint. Для них нужен следующий adapter.

Секреты Bitget в код/браузер не передаются. Торговых POST-запросов в этом срезе нет.

---

## Что нельзя сломать

| Маршрут | Статус |
|---------|--------|
| `/screener` | стабилен, не менять без необходимости |
| `/screener/stocks` | стабилен |
| `/screener/futures` | стабилен, не трогать |
| `/screener/strategies` | Strategy Scanner v0 demo-ready |
| `/screener/bitget` | новый вертикальный срез v1 |

---

## Предыдущая завершённая задача

**Strategy Scanner v0 — round-levels small universe** (2026-07-08)

- `frontend/lib/strategies/strategy-runner-types.ts` ✅
- `frontend/lib/strategies/round-levels-strategy-runner.ts` ✅
- `frontend/scripts/scan-round-levels-strategy.ts` ✅
- JSON snapshot: `frontend/public/strategy-runs/round-levels-stocks-5m-10d.json` ✅
- verify script: `frontend/scripts/verify-strategy-scan-result.ts` ✅

Документация: `docs/STRATEGY_LAB_TARGET.md`, `docs/ROUND_LEVELS_STRATEGY.md`, `docs/ZIGZAG_LITE_STRATEGY_LAYER.md`, `docs/STRATEGY_SCANNER_ARCHITECTURE.md`.

---

## Следующий лучший срез Bitget

1. Прогнать `pnpm -C frontend build` на машине с репозиторием и обычным интернетом.
2. Добавить Bitget в основную навигацию после проверки UX.
3. Создать signed server-only Stock+ adapter:
   - securities static/quotes;
   - option underlyings;
   - expiries;
   - option chains;
   - quotes только при доступном entitlement/whitelist.
4. Добавить фоновые свечи + cache для RSI14, ATR, relative volume и multi-timeframe momentum без N×2000 запросов на каждый UI refresh.
5. Подключить private Classic v2 account read layer для истории пользователя как отдельную аналитическую поверхность; не смешивать его с public market adapter.

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend build
```

**Bitget URL:** `/screener/bitget`

**Strategy debug URL:** `/screener/strategies?screenerChartDebug=1`
