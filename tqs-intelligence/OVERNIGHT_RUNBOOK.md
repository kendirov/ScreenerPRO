# TQS OVERNIGHT RUNBOOK — v0.8.3

Purpose: owner opens one Launcher, selects MAX and can leave the workstation. TQS must enrich its local market/research state without manual queue management.

## 1. Runtime topology

`TQS Launcher -> Supervisor -> FastAPI/uvicorn -> autonomous loops`

Launcher responsibilities:
- version/update truth;
- START/STOP/MAX/LIGHT;
- Windows keep-awake in MAX;
- runtime log;
- non-destructive watchdog.

Supervisor responsibilities:
- own the uvicorn child;
- write `data/supervisor-heartbeat.json` every loop;
- restart a child that really exits;
- survive malformed control/update requests.

Important reliability rule:
**one missed HTTP health probe is not proof of a dead backend.** Heavy history/research can temporarily delay API responses. Launcher waits for process/heartbeat evidence and uses a 180s hard-recovery window before killing live processes.

## 2. What MAX does autonomously

### Live market loop
- Bitget;
- Binance;
- Bybit;
- OKX;
- MOEX ISS;
- normalize snapshot;
- persist quotes/news/anomalies;
- update anomaly episode lifecycle;
- lightweight case/research refreshes.

### History Autopilot
When the explicit research queue becomes empty, MAX does **not** idle. It discovers a priority universe and fills missing history from 2021 onward in small batches.

Current priority tiers:
- Binance USDT futures: up to 60;
- MOEX FORTS: up to 60;
- MOEX shares: up to 60;
- Binance spot: up to 30;
- MOEX indices: up to 20;
- MOEX FX/SELT: up to 20.

Round-robin is intentional: one night improves crypto and MOEX together instead of consuming the entire session on one venue.

### Research chain
`historical backfill -> historical replay -> movement candidate -> matching StrategySpec runs`

A backfill with usable rows automatically queues replay. Replay with enough events can automatically queue relevant strategies. Failed history jobs are remembered and are not retried in a tight infinite loop.

### Account Intelligence
- public Hyperliquid discovery;
- research-priority ranking;
- hot-set tracking;
- open positions;
- fills;
- behavioral profiles.

## 3. Current meaning of success overnight

At least one of the following should increase while MAX is left running:
- completed live market cycles;
- Data Lake candle rows/partitions;
- completed historical backfills;
- replay jobs;
- strategy runs;
- account sync cycles/fills;
- anomaly episodes/case outcomes.

A high CPU/RAM number by itself is **not** evidence of useful work.

## 4. Morning acceptance

Tomorrow's UI should make this readable without terminal access. Until Activity Ledger is implemented, verify:
- Launcher product version/local/remote agree;
- backend stayed alive or recovered without restart thrash;
- runtime log does not show repeated `Останавливаю TQS` every few seconds/minutes;
- `market cycles` increased;
- History Autopilot `done/known/target` advanced;
- research jobs have `done/failed` outcomes rather than staying permanently `running`;
- Data Lake size/coverage increased;
- account sync count/fills increased.

## 5. Not yet equivalent to "all possible data"

v0.8.3 has a strong autonomous foundation but does not yet bulk-store every available market field historically.

Still to add progressively:
- historical OI and OI acceleration;
- historical funding + percentiles;
- basis and spot/perp divergence history;
- liquidations;
- trades/aggressor delta;
- L2/depth/imbalance/microprice/replenishment/depletion;
- listings/delistings/unlocks/macro calendar;
- Telegram/event sources;
- MOEX paid realtime and participant aggregates (physical/legal persons);
- account fills synchronized to full MarketContext;
- global equities/options data provider where required.

Those belong to one expandable Metric Catalog, not separate products.

## 6. Tomorrow's priority

1. Activity Ledger + night/session summary.
2. Unified runtime identity/version in Launcher and Web.
3. Instrument Lab visualization: candles + anomaly overlays + episodes + OI/funding/news/accounts/strategies.
4. Research result UX: what was tested, sample, outcome, OOS/walk-forward/costs, rejected/candidate.
5. Metric coverage dashboard and adapters for derivatives/microstructure/event data.

## 7. Owner interaction contract

Primary interaction remains GPT-first:
- owner describes an idea in normal Russian;
- Chat formalizes it;
- changes GitHub/product;
- CI verifies;
- TQS automatically executes/collects/researches;
- Web shows useful results.

Manual forms are secondary diagnostics, never the main workflow when discovery/action can be automated.
