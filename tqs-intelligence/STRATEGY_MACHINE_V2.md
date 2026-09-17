# TQS Strategy Machine v2

## Goal

Turn a plain-language trading idea into a reproducible experiment rather than one hand-picked backtest.

Example owner request:

> Buy every fall. Try taking 0.5%, 10, 20 or 100 points. Try different stops. Show where it makes money, where it loses money and what changes between those cases.

TQS should translate this into a versioned StrategySpec and an experiment matrix.

## Experiment sequence

`idea -> event definition -> parameter grid -> exploration -> choose candidate parameters -> validation -> untouched holdout -> walk-forward -> costs -> diagnostics -> next hypothesis`

Parameter selection is allowed only on exploration data. Validation and holdout must not be searched repeatedly until they look good.

## Built-in v0.5 dip experiments

### Percentage/bps version
Event: price falls X% from a prior rolling high and first touches the trigger.

Grid includes:
- drop: 0.25 / 0.5 / 1 / 2 / 3%;
- profit targets: 10 / 20 / 50 / 100 / 200 bps;
- stops: 20 / 50 / 100 / 200 / 400 bps;
- max holding: 3 / 6 / 12 / 24 bars.

### Absolute-point version
For instruments where price points have economic meaning, targets include 10 / 20 / 50 / 100 points and multiple point stops.

Do not compare point settings mechanically across instruments with radically different price scales.

## Controls

Each selected configuration must be compared to a background control with the same target/stop/holding rules. Later controls should expand to:
- random time-matched entries;
- same-session controls;
- same-volatility controls;
- shifted event thresholds;
- direction placebo;
- sector/index matched controls.

## Costs

At minimum include round-trip bps. Later add:
- spread;
- slippage by liquidity/size;
- exchange/broker fees;
- funding;
- partial fills;
- latency;
- adverse selection.

## Profit / loss diagnostics

Do not stop at net PnL. For every experiment retain:
- MFE/MAE;
- best/worst trades;
- exit reason;
- pre-event trend;
- pre-event volatility;
- time/session;
- liquidity/volume/OI/news/anomaly context when available.

The first v0.5 diagnostic cells are pre-trend, pre-volatility and exit reason.

Important: if diagnostics reveal `works mainly in high volatility`, that is a **new hypothesis**. Add that filter and rerun with a new untouched OOS slice; do not silently retrofit it to the original holdout.

## Future generic StrategySpec

Strategy Machine should support reusable modules:
- universe;
- data/features;
- setup/event;
- filters;
- trigger;
- entry;
- cancellation;
- management;
- exits;
- sizing;
- execution/costs;
- controls;
- validation;
- benchmark.

## Promotion states

- `exploratory`: under active search.
- `inconclusive`: insufficient or unstable evidence.
- `rejected`: failed key validation/holdout gate.
- `candidate`: survived current validation gates but is not ready for live trading.
- `validated`: reserved for stronger replication, data quality, execution and stability evidence.

No parameter sweep result should automatically place live orders.
