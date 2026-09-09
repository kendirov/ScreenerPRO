# Bitget public REST adapter

TQ-004 реализует `BitgetPublicRestAdapter`: read-only public UTA v3 REST, stdlib `urllib` transport, existing pure normalizers и one-shot `MarketSnapshot`.

Поддержаны instruments (SPOT/MARGIN/USDT-FUTURES/USDC-FUTURES/COIN-FUTURES), tickers/orderbook (кроме MARGIN ticker), public fills, а также futures-only open interest, funding и liquidations. Неподдерживаемая комбинация отклоняется до network call; MARGIN никогда не проксируется через SPOT.

`Trade.quantity_unit`: COIN-FUTURES — `quote_asset`, остальные fills — `base_asset`. Для liquidation и order book unit остаётся `unknown`, если контракт его не гарантирует. `requestTime` — transport metadata, не `event_time_ms`; provider `ts` используется только там, где он дан. `observed_at_ms` — время получения ответа.

Ошибки разделены на network, timeout, HTTP, environment/geo (403/451), Bitget API, protocol и unsupported capability. Snapshot сохраняет успешные canonical events и структурированные ошибки; request failure не маскируется пустым payload. Empty liquidation list после успешного запроса валиден.

Runtime одноразовый: без auth, orders, retries, cache, rate limiter, WebSocket, persistence или scheduler.
