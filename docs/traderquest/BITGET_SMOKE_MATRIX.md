# Bitget UTA v3 — smoke matrix

Дата проверки: 2026-09-09. `DOC_VERIFIED`, `CODE_VERIFIED` и `RUNTIME_VERIFIED` — независимые статусы. Public REST runtime: direct Node 22 execution, 9/9 PASS. Package wrapper и build требуют отсутствующий в checkout `node_modules` и отдельно отмечены в handoff.

| Capability | Official docs | Existing implementation | Static verification | Runtime probe | Result | Next action |
|---|---|---|---|---|---|---|
| Futures instruments | DOC_VERIFIED | `bitget-market.ts` | CODE_VERIFIED | `verify:tq-bitget-public` | RUNTIME_VERIFIED | Keep, wrap later |
| Futures ticker | DOC_VERIFIED | `bitget-market.ts` | CODE_VERIFIED | `verify:tq-bitget-public` | RUNTIME_VERIFIED | Keep, wrap later |
| Futures orderbook REST | DOC_VERIFIED | absent | CODE_VERIFIED: no current caller | `verify:tq-bitget-public` | RUNTIME_VERIFIED | tq-market later |
| Public fills | DOC_VERIFIED | absent | CODE_VERIFIED: no current caller | `verify:tq-bitget-public` | RUNTIME_VERIFIED | tq-market later |
| Open interest | DOC_VERIFIED | ticker snapshot only | CODE_VERIFIED: no history | `verify:tq-bitget-public` | RUNTIME_VERIFIED | persistent history later |
| Current funding | DOC_VERIFIED | ticker field only | CODE_VERIFIED: no dedicated endpoint | `verify:tq-bitget-public` | RUNTIME_VERIFIED | normalize later |
| Liquidation history | DOC_VERIFIED | absent | CODE_VERIFIED: not implemented | `verify:tq-bitget-public` | RUNTIME_VERIFIED or BLOCKED | tq-market later; zero rows is valid |
| Spot instruments/ticker | DOC_VERIFIED | shared market adapter | CODE_VERIFIED | `verify:tq-bitget-public` | RUNTIME_VERIFIED | Keep |
| WS ticker/publicTrade | DOC_VERIFIED | no persistent WS | CODE_VERIFIED: deferred | deferred in TQ-002 | DEFERRED | collector milestone |
| WS books1/5/50 | DOC_VERIFIED | no persistent WS | CODE_VERIFIED: deferred | deferred in TQ-002 | DEFERRED | collector milestone |
| WS books/full | DOC_VERIFIED | no persistent WS | CODE_VERIFIED: deferred | deferred in TQ-002 | DEFERRED | collector + sequence gap |
| WS liquidation | DOC_VERIFIED | absent | CODE_VERIFIED: not implemented | deferred in TQ-002 | DEFERRED | tq-market later |
| Private account/read | DOC_VERIFIED | `bitget-private.ts` | CODE_VERIFIED | DEFERRED by policy | DEFERRED | explicit private smoke task |
| Private WS order/account/position | DOC_VERIFIED | absent | CODE_VERIFIED: not implemented | DEFERRED by policy | DEFERRED | explicit private WS task |
| Private WS fill | UNVERIFIED | absent | CODE_VERIFIED: no topic | DEFERRED | UNVERIFIED | recheck official docs later |
| Place/modify/cancel/batch | DOC_VERIFIED | absent; no-order boundary | CODE_VERIFIED: absent | NEVER RUN | FORBIDDEN_TQ002 | execution stage only |

## Runtime classification

The script distinguishes `NETWORK_ERROR`, `TIMEOUT`, `HTTP_ERROR`, `BITGET_API_ERROR` and explicit `ENVIRONMENT_OR_GEO_BLOCKED` for HTTP 403/451. A 403/451 is not treated as unsupported API. The smoke never authenticates, reads an account, or sends an order.

## Public smoke contract

Technical probe symbol: `BTCUSDT`; it is not a production universe. Every REST result must be valid JSON, envelope `code: "00000"`, expected shape, matching symbol/category where returned, parseable timestamps and parseable numeric fields where present. No transient price, funding, OI, volume or liquidation count is committed as product truth. Empty liquidation history is valid.

Official sources: [Market Data](https://www.bitget.com/docs/catalog/market/market-data), [Liquidations History](https://www.bitget.com/api-doc/uta/public/Get-Liquidations), [Quick Start](https://www.bitget.com/docs/uta/quick-start), [Best Practices](https://www.bitget.com/docs/uta/best-practices-guide), [Depth Channel](https://www.bitget.com/api-doc/uta/websocket/public/Order-Book-Channel), [Liquidation Channel](https://www.bitget.com/api-doc/uta/websocket/public/Liquidation-Channel).
