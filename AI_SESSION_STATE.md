# AI_SESSION_STATE — Лаборатория рынка

---

## Текущая задача

**Bitget private read-only bridge v1** (2026-08-18)

Цель: добавить к существующему Bitget public terminal безопасный server-only доступ к личному UTA аккаунту без торговых POST-запросов.

Ветка: `codex/bitget-private-readonly-v1-2026-08-18`.

Сделано:

- `frontend/lib/server/services/bitget-private.ts` — HMAC-SHA256/Base64 signing по UTA v3;
- `GET /api/bitget/private/account` — preview-only read snapshot;
- читаются account info, account assets, funding assets, open orders и текущие позиции USDT/USDC/COIN futures;
- секреты берутся только из server env: `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE`;
- значения секретов не записываются в GitHub;
- production route намеренно возвращает 403 до отдельного auth/security слоя;
- никаких place/cancel/modify order endpoints в этом срезе нет.

Ограничение текущего инструментария ChatGPT/Vercel: доступный Vercel connector умеет читать проекты/деплои/логи, но не умеет создавать или изменять Environment Variables. Поэтому код и preview можно собрать автоматически, а server env нужно добавить через Vercel Settings либо другим secret-capable deployment channel.

---

## Bitget Global Screener + Interactive Market Map

Реализовано в ветке `feature/bitget-global-screener-v1`:

- `/screener/bitget` — Terminal v3;
- `/screener/bitget/map` — интерактивная карта рынков;
- public UTA v3 adapter;
- cached 7d enrichment;
- TradingView inline workspace;
- docs/BITGET_GLOBAL_SCREENER.md.

### Terminal v3

- весь подключённый public universe;
- crypto spot/futures, margin, rToken, stock perps, commodity perps;
- единый page scroll;
- briefing strip;
- 24h + cached 7d;
- turnover, spread, funding;
- ticker copy;
- inline TradingView chart;
- favorite + notes;
- local persistence.

### Следующие adapters

1. Stock+ securities/quotes.
2. U.S. options: underlyings → expiries → option chains.
3. TradFi / CFD.
4. Historical feature cache: RSI/ATR/relative volume/momentum.
5. Private account UI поверх read-only bridge.
6. Cloud user workspace.

---

## Что нельзя сломать

| Маршрут | Статус |
|---------|--------|
| `/screener` | стабилен |
| `/screener/stocks` | стабилен |
| `/screener/futures` | стабилен |
| `/screener/strategies` | Strategy Scanner v0 demo-ready |
| `/screener/bitget` | Bitget Terminal v3 |
| `/screener/bitget/map` | Interactive Bitget Market Map |

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend build
```

**Bitget terminal:** `/screener/bitget`

**Bitget map:** `/screener/bitget/map`

**Bitget private preview API:** `/api/bitget/private/account`
