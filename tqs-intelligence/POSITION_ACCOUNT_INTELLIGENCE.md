# TQS Position & Account Intelligence

## Product purpose

TQS should treat positions as another first-class event stream beside prices, OI, volume, news and anomalies.

Two different observation levels must never be mixed:

1. **Public/authorized individual accounts** — e.g. public Hyperliquid addresses. We can persist open positions and fills, then compare them with market state.
2. **Aggregated participant data** — e.g. MOEX individuals/legal entities long/short, participant counts and OI. This describes cohorts, not named individual accounts.

No UI or research result may imply that aggregate MOEX participant data identifies a particular trader.

## Public account pipeline

`public address -> fills/open positions -> durable history -> behavior profile -> market synchronization -> hypotheses -> deterministic testing`

For every tracked account retain:
- source + account id + owner label;
- exact observation/fill timestamp;
- symbol, side, size, price, notional;
- entry price where supplied by source;
- leverage/liquidation where supplied;
- realized/unrealized PnL where supplied;
- taker/maker evidence where supplied;
- raw provider payload for provenance.

## What TQS may infer as a hypothesis

After enough history, generate descriptive candidates such as:
- long/short bias;
- instrument concentration;
- average/median position size;
- scaling in/out behavior;
- aggressive/taker execution share;
- typical holding duration after reconstruction;
- reaction to momentum, pullbacks, volatility expansion, round levels, OI/funding extremes, news and anomaly episodes;
- approximate adverse/favorable excursion after entries;
- clustering around recurring times/sessions.

These are **observed patterns**, not claims about the trader's intent.

## Stops and trading logic

A stop is not observable merely because a position disappears. TQS should distinguish:
- explicit source-provided liquidation/stop data;
- reconstructed exit price/time;
- inferred behavioral stop hypothesis.

The latter must be labelled `HYPOTHESIS` and tested across many trades.

## Market synchronization

Each fill should later be enriched with a compact MarketContext:
- returns 1m/5m/15m/1h/4h;
- volatility/ATR/range state;
- volume/turnover anomaly;
- OI/funding/basis where available;
- anomaly episode ids active at fill time;
- distance to round/buffer levels;
- related market/sector state;
- news/event proximity.

This enables questions such as:
- does the account buy strength or weakness?
- does it add after adverse movement?
- does it enter before/after OI expansion?
- does it fade anomaly spikes or follow them?
- which contexts produce its best/worst outcomes?

## Visual UI target

`Счета / позиции` should evolve into:
- live open-position table;
- account cards;
- LONG/SHORT exposure timeline;
- position changes over time;
- fills overlaid on candlestick charts;
- PnL/equity curve when reconstructable;
- instrument allocation;
- behavior signatures;
- comparable accounts/cohorts;
- links from an account trade directly to the corresponding TQS anomaly/case.

## MOEX participant layer

When licensed/current data is connected, store separately:
- contract total OI;
- individuals long/short;
- legal entities long/short;
- number of participants;
- deltas and acceleration;
- source timestamp and delay/entitlement.

Derived features:
- individual net;
- legal net;
- individual/legal divergence;
- participant acceleration;
- price x OI divergence;
- price x participant divergence;
- participant crowding/extremes versus history.

These become inputs to Anomaly Engine, Historical Replay and Strategy Machine.

## Evidence boundary

TQS should say `account often buys after 5m weakness in the observed sample` only after measuring it. It should not say `this trader predicts reversals` or `this is the trader's stop` without evidence.
