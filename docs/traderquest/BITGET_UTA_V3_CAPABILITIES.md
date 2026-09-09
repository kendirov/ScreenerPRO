# Bitget UTA v3 — verified capabilities

Проверено: 2026-09-09. Источник API-фактов — только официальная документация Bitget. Машиночитаемый реестр: [`uta-v3-capabilities.json`](../../contracts/traderquest/bitget/uta-v3-capabilities.json).

## Решение по liquidation

`BITGET_CAPABILITY = VERIFIED_OFFICIAL`.

Подтверждены REST `GET /api/v3/market/liquidations` (история последних 3 дней, `5/sec/IP`) и public WebSocket `instType: usdt-futures`, `topic: liquidation` (агрегация раз в секунду). `TRADERQUEST_IMPLEMENTATION = NOT_IMPLEMENTED`: в текущем ScreenerPRO нет ingestion этого потока.

## Runtime и permissions

- Regular REST: `https://api.bitget.com`; public WS: `wss://ws.bitget.com/v3/ws/public`; private WS: `wss://ws.bitget.com/v3/ws/private`.
- Demo REST требует созданный Demo API key и заголовок `paptrading: 1`; demo public/private WS: `wss://wspap.bitget.com/v3/ws/public` и `/private`. В TQ-002 demo runtime не вызывается.
- Private REST требует `ACCESS-KEY`, `ACCESS-SIGN`, `ACCESS-TIMESTAMP`, `ACCESS-PASSPHRASE`, `Content-Type`; ключи и значения секретов не используются и не печатаются.
- Приватные разрешения разделены на UTA trade read/read-write и UTA management read/read-write. В TQ-002 приватный runtime smoke отложен.
- WS: не более 300 connection requests/IP/5 min, 100 активных соединений/IP, 240 subscription requests/hour/connection, 1000 channel subscriptions/connection, 10 сообщений/sec/connection. Рекомендуется ping каждые 30 секунд; без ping 2 минуты сервер отключает соединение.

## WebSocket order book

| Topic | Режим | Частота по официальной документации |
|---|---|---:|
| `books1` | snapshot-only, 1 уровень | 1 ms |
| `books5` | snapshot-only, 5 уровней | 10 ms |
| `books50` | snapshot-only, 50 уровней | 20 ms |
| `books` | первый snapshot, далее incremental update | 50 ms |

Для `books` `pseq` — sequence предыдущего push; в нормальном порядке `seq` должен быть больше `pseq`. Отсутствие изменения книги не обязано порождать новый snapshot. Проверка sequence-gap и persistent WS не входят в TQ-002.

## Mapping в ScreenerPRO

| Capability | Официальный факт | Существующий код | Действие TraderQuest |
|---|---|---|---|
| Instruments / tickers | UTA v3 public REST | `frontend/lib/server/services/bitget-market.ts` | KEEP, позднее wrap в `ExchangeAdapter` |
| Current funding | Поле ticker и отдельный current-fund-rate | `bitget-market.ts` читает funding из ticker | KEEP, затем нормализовать |
| Open interest | Public REST current snapshot | `bitget-market.ts` читает поле ticker | WRAP_LATER; history отсутствует |
| Order book REST | Public REST `a/b/ts` | нет | WRAP_LATER |
| Public fills | Public REST recent fills | нет | IMPLEMENT_LATER |
| Liquidation REST/WS | Официально VERIFIED | нет | IMPLEMENT_LATER в `tq-market` |
| Public WS ticker/trade/books | Официально VERIFIED | persistent WS нет | IMPLEMENT_LATER |
| Account/settings/assets/funding/positions/open orders | Signed UTA read endpoints | `frontend/lib/server/services/bitget-private.ts` | KEEP; private runtime later |
| Private WS order/account/position | Официально VERIFIED | нет | IMPLEMENT_LATER |
| Private WS fill | `instType: UTA`, `topic: fill`; real-time fill push, no first-subscription push | нет | IMPLEMENT_LATER |
| Place/modify/cancel/batch | Официально VERIFIED, read-write | нет; no-order boundary | FORBIDDEN в TQ-002 |

## Проверенные ограничения существующего market service

`bitget-market.ts` делает параллельные REST snapshot-запросы instruments и tickers, строит rows и 24h-derived score. В нём нет persistent WebSocket, raw public-trade stream, liquidation ingestion, replay-grade event envelope, sequence-gap handling или persistent OI/history storage. `briefing-engine.ts` явно оставляет `baseline: MISSING` и использует 24h proxy. Эти ограничения зафиксированы, но в TQ-002 не исправляются.

## Официальные источники

- [Quick Start](https://www.bitget.com/docs/uta/quick-start) — domains, demo header/WS, signing, global limits.
- [Market Data](https://www.bitget.com/docs/catalog/market/market-data) — instruments, tickers, orderbook, fills, current market fields.
- [Liquidations History](https://www.bitget.com/api-doc/uta/public/Get-Liquidations) — liquidation REST, 3-day window, rate limit.
- [Liquidation Channel](https://www.bitget.com/api-doc/uta/websocket/public/Liquidation-Channel) — liquidation WS semantics.
- [Private Fill Channel](https://www.bitget.com/api-doc/uta/websocket/private/Fill-Channel) — authenticated UTA real-time fill push.
- [Depth Channel](https://www.bitget.com/api-doc/uta/websocket/public/Order-Book-Channel) — books topics, snapshots, frequencies, `seq/pseq`.
- [Best Practices](https://www.bitget.com/docs/uta/best-practices-guide) — WS behavior, order confirmation semantics, private channels.
- [UTA upgrade guide](https://www.bitget.com/docs/classic/uta-api-upgrade-guide) — v2→v3 REST and public/private topic mapping.
- [Account Settings](https://www.bitget.com/docs/catalog/account/account-settings) — account info/settings/assets and permissions.
- [Order Management](https://www.bitget.com/docs/catalog/trading/order-management) — open orders and execution endpoint boundary.
- [Place Order](https://www.bitget.com/api-doc/uta/trade/Place-Order) and [Modify Order](https://www.bitget.com/api-doc/uta/trade/Modify-Order) — execution/clientOid facts; not invoked.
