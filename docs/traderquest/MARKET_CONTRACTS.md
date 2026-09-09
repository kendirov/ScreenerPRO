# TraderQuest market contracts

TQ-003 вводит provider-neutral язык рынка. Он отделяет данные биржи от storage, replay, features, screener и execution. Все финансовые значения — `Decimal`, rate-поля — ratio, время — UTC epoch milliseconds.

## Compatibility map

| Existing Bitget field | Canonical contract |
|---|---|
| `category` | `InstrumentKey.market_type` |
| `symbol` | `InstrumentKey.symbol` |
| `lastPrice` | `TickerSnapshot.last_price` |
| `change24hPct` | `TickerSnapshot.change_24h_ratio` (existing UI is percent) |
| `fundingRatePct` | `FundingSnapshot.funding_rate` (canonical ratio) |
| `openInterest` | `OpenInterestSnapshot.open_interest` |
| `bid` / `ask` | ticker bid/ask fields or `BookLevel` |
| `updatedAt` | provider `event_time_ms` only when it is actually provider time |

`attentionScore`, `inPlay` и `attentionReasons` — не adapter data: это будущие derived/business layers.

Bitget normalization lives in `traderquest/adapters/bitget/normalizer.py` and produces `EventEnvelope` with `SourceRef`. Missing values remain `None`; REST does not invent sequence numbers. Liquidation `buy`/`sell` is preserved as provider-documented side and is not converted to long/short.

The existing Next.js Bitget terminal remains untouched. Migration is deferred to a later compatibility/API layer.
