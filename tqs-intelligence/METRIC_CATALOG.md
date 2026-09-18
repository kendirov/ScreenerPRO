# TQS METRIC CATALOG

Goal: one extensible catalog for everything TQS can observe, derive, research and visualize. New providers add fields into this catalog; they do not create separate mini-products.

Status legend:
- `LIVE` — collected now in current live snapshots for at least one provider;
- `HIST` — historical storage/backfill exists for at least one provider;
- `DERIVED` — deterministically calculated from stored/raw data;
- `PARTIAL` — provider-dependent or not normalized across all venues;
- `NEXT` — intended next adapter/research layer;
- `PAID` — likely requires licensed/premium market data.

## A. Price / volatility / structure

| Metric family | Status | Notes |
|---|---|---|
| last / bid / ask | LIVE | multi-source, provider semantics preserved |
| OHLC candles | LIVE + HIST | Binance/MOEX historical; other adapters can follow same contract |
| volume / turnover | LIVE + HIST | units differ by venue; normalize before cross-provider ranking |
| spread bps | DERIVED | from bid/ask where present |
| returns 1m/5m/15m/1h/4h/24h | NEXT/DERIVED | versioned feature engine |
| ATR / realized volatility | NEXT/DERIVED | rolling baselines + percentiles |
| VWAP distance | NEXT/DERIVED | session/rolling variants |
| breakout / reclaim | NEXT/DERIVED | parameterized horizon/level definitions |
| acceleration | NEXT/DERIVED | price/return acceleration |
| compression / expansion | NEXT/DERIVED | volatility/true-range regimes |
| relative strength | NEXT/DERIVED | peer/index/market-relative |
| round/buffer zones | RESEARCH | Strategy Machine / event-study object |

## B. Volume / activity

| Metric family | Status | Notes |
|---|---|---|
| raw volume / turnover | LIVE + HIST | basic layer present |
| rolling volume baseline | NEXT/DERIVED | by time-of-day/regime |
| volume z-score / percentile | NEXT/DERIVED | anomaly input |
| volume persistence | NEXT/DERIVED | multi-window |
| trade count / intensity | NEXT | requires trade stream/provider support |
| aggressive buy/sell volume | NEXT | public trades / aggressor classification |
| delta / cumulative delta | NEXT/DERIVED | from trades |

## C. Derivatives

| Metric family | Status | Notes |
|---|---|---|
| open interest | LIVE/PARTIAL | current snapshots where venue returns it |
| delta OI / OI acceleration | NEXT/DERIVED | requires historical OI series |
| funding rate | LIVE/PARTIAL | current where venue returns it |
| funding history / percentile | NEXT | dedicated history adapters |
| basis | NEXT/DERIVED | spot vs perp/future |
| spot-perp divergence | NEXT/DERIVED | price/volume/OI/funding context |
| liquidations | NEXT | venue/feed specific |
| expiry / term structure | NEXT | futures calendar + basis curve |
| options IV / Greeks / skew | FUTURE | when options provider is added |

## D. Microstructure / order flow

| Metric family | Status | Notes |
|---|---|---|
| best bid/ask / spread | LIVE/PARTIAL | L1 |
| L2 depth | NEXT | tier A instruments first |
| depth imbalance | NEXT/DERIVED | multi-level |
| microprice | NEXT/DERIVED | L1/L2 |
| liquidity gaps | NEXT/DERIVED | depth discontinuities |
| replenish/depletion | NEXT/DERIVED | sequence-aware L2 |
| queue/order-flow intensity | NEXT | exchange-specific |
| slippage estimate | NEXT/DERIVED | depth + trade impact |

## E. Participants / accounts

| Metric family | Status | Notes |
|---|---|---|
| Hyperliquid public account universe | LIVE | automatic discovery |
| hot-set positions | LIVE | long/short/notional/leverage/liquidation where public |
| fills / realized samples | LIVE + HIST(local) | local accumulation |
| behavioral signatures | DERIVED/PARTIAL | descriptive, not motive inference |
| account-market synchronization | NEXT | entry/fill vs MarketContext |
| account cohorts | NEXT | style/holding period/instrument/regime clusters |
| MOEX aggregate OI | LIVE/PARTIAL | current FORTS snapshots; source/time semantics required |
| MOEX FUTOI physical/legal long/short | HIST/PARTIAL + LICENSED-REALTIME | public/delayed or visual access may exist; realtime/licensed entitlement kept explicit |
| LCHI public participant positions/trades | NEXT/PUBLIC | public contest profiles expose participant-level positions/trade evidence; automate discovery with rate limits and provenance |
| T-Bank Pulse public profiles/trades | NEXT/PUBLIC/PARTIAL | public composition + recent trade timing/price; exact operation quantity hidden to other users |
| individual broker/client accounts | CONDITIONAL | only user-authorized/public/legal sources |

## F. Events / news / external context

| Metric family | Status | Notes |
|---|---|---|
| GDELT/RSS news | LIVE/PARTIAL | basic event stream |
| official exchange announcements | NEXT | Bitget/Binance/Bybit/OKX/MOEX |
| listings / delistings | NEXT | event objects |
| token unlocks | NEXT | provider/calendar |
| corporate actions / filings | NEXT | equities |
| macro calendar | NEXT | rates/CPI/jobs/etc |
| Telegram channels | NEXT | authorized/public collection only |
| news reaction | NEXT/DERIVED | event → price/volume/OI response windows |

## G. Cross-market intelligence

| Metric family | Status | Notes |
|---|---|---|
| same instrument across venues | NEXT | EconomicInstrumentId separate from venue ID |
| peer-relative anomaly | NEXT/DERIVED | sector/basket/market group |
| lead/lag correlation | PARTIAL | relationship miner exists; needs stronger significance/FDR |
| regime-conditioned relationship | NEXT | avoid unconditional correlation traps |
| cross-exchange stability | NEXT | promotion gate for crypto signals |
| index/sector/future linkage | NEXT | especially MOEX |

## H. Research outcome metrics

Every anomaly/hypothesis/strategy should ultimately support:
- forward return: 5m / 15m / 1h / 4h / 24h;
- median / mean / distribution;
- continuation/reversal probability;
- MFE / MAE;
- time-to-target / time-to-stop;
- sample count and coverage;
- regime breakdown;
- IS/OOS split;
- walk-forward;
- bootstrap confidence intervals;
- fee/slippage/funding stress;
- multiple-testing/FDR control;
- cross-market/cross-exchange replication;
- counterexamples and failure regimes;
- status: `REJECTED / INTERESTING / CANDIDATE / ROBUST` only after explicit gates.

## I. Storage/provenance contract

Every stored metric should eventually carry:
- provider/venue;
- economic instrument + venue instrument identity;
- event/exchange time;
- receive time;
- sequence where available;
- unit/currency/contract semantics;
- raw/derived flag;
- feature version;
- source/provenance;
- quality flags/gaps.

Never mix incomparable provider units merely because column names match.

## J. Data tiers

To keep MAX useful instead of wasteful:
- **Tier A** — important/in-play instruments: trades + L2 + derivatives + events, high frequency;
- **Tier B** — broader liquid universe: trades/1s or compact high-frequency features;
- **Tier C** — full universe: bars + lightweight features + event metadata.

Promotion/demotion between tiers should be automatic from liquidity, anomaly state, owner watchlist, active research and strategy needs.

## K. Development rule

When a new idea needs a metric:
1. check this catalog;
2. identify raw source and access/cost;
3. add canonical semantics + unit/provenance;
4. collect/store deterministically;
5. backfill if available;
6. add feature/version tests;
7. expose coverage in Instrument Lab;
8. only then use it in anomaly/research/strategy logic.

This prevents TQS from becoming a collection of untraceable indicators.
