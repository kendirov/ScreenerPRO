# TQS INTELLIGENCE & STRATEGY MACHINE — AI OPERATING CONTEXT v0.5

Status: active product/engineering contract for the local TQS engine.

## 1. Product goal

Build one continuously improving local/server market machine that:

1. Collects crypto, MOEX stocks/futures/FX/indices/bonds, global market context, public/authorized positions and news.
2. Stores durable market/account history and source provenance.
3. Detects unusual states and turns them into persistent anomaly episodes.
4. Treats an anomaly primarily as a **candidate place/time where a meaningful move may start or accelerate**.
5. Replays the same logic historically to estimate whether movement after an anomaly is materially different from normal background.
6. Converts Artem's ideas into reproducible StrategySpec/research tasks.
7. Tests actual entry/exit logic with parameter grids, controls, OOS/holdout, walk-forward, regime/stability and cost layers.
8. Diagnoses where profit/loss concentrates, then treats discovered conditions as new hypotheses requiring fresh OOS tests.
9. Tracks public/authorized individual accounts where the venue exposes them and separately tracks aggregate participant cohorts where only aggregate data exists.
10. Accumulates negative as well as positive results.
11. Produces a trader terminal, interactive briefing/presentation and reusable knowledge for courses/content.
12. Runs 24/7 with low owner attention and can be updated safely from the UI.

Primary owner UX:

`I observe/say an idea → TQS stores/formalizes/tests it → verified code is committed → I press Update → the same product gains a better detector/research/strategy/source/UI.`

## 2. Truth and evidence hierarchy

- Runtime + actual market/account DB/data lake = operational truth.
- GitHub/repository = code/technical truth.
- Trading QS Google Drive = human-readable product/research canon.
- Primary/current provider documentation = external-source truth.
- AI narrative is never evidence by itself.

Always separate:
- FACT
- ARTEM OBSERVATION
- ARTEM HYPOTHESIS
- AI HYPOTHESIS
- PATTERN
- RULE
- UNKNOWN

For accounts additionally separate:
- SOURCE-PROVIDED POSITION/FILL
- RECONSTRUCTED OUTCOME
- BEHAVIORAL PATTERN
- MOTIVE/STOP HYPOTHESIS

Never state a hidden motive or stop level as a fact from public fills alone.

## 3. Core architecture

```text
Providers / News / Public-or-authorized accounts / Owner ideas
        ↓
Canonical instruments + snapshots + provenance
        ↓
Live Feature / State / Anomaly Engine
        ↓
Persistent Anomaly Episodes
        ↓
Historical Parquet Data Lake
        ↓
Historical Replay / Event Studies
        ↓
Movement candidates
        ↓
Strategy Machine / StrategySpec
        ↓
Parameter grids + Controls + OOS + Walk-forward + Costs + Diagnostics
        ↓
REJECTED / INCONCLUSIVE / CANDIDATE / VALIDATED
        ↓
In Play / Screener / Briefing / Course / Product features
```

In parallel:

```text
Public/authorized account positions + fills
        ↓
Durable account history
        ↓
Behavior profile
        ↓
MarketContext synchronization
        ↓
Testable account-behavior hypotheses
```

Two strict computation layers:

### Deterministic Research Core
Raw data, features, event definitions, controls, outcomes, costs, tests and promotion gates. LLMs do not silently change formulas or outcomes.

### AI Research Brain
Reads compact results/snapshots, proposes hypotheses, missing controls, new anomalies, strategy variants, account-behavior tests, UI/data-source improvements and research priorities. Every proposed market edge returns to deterministic testing.

## 4. Runtime modes

### STOP
- Background market/account loop stopped.
- Heavy research stopped.
- Manual refresh remains possible.
- Data is preserved.

### LIGHT
For normal PC work.
- Live market/news/anomaly/account collection runs.
- New live anomaly episodes and account-position snapshots are preserved.
- Bulk 2021+ backfills, replays and Strategy Machine wait.

### MAX
For night/server/heavy research.
- Faster live loop.
- Persistent historical jobs execute.
- Backfill → Historical Replay → matching StrategySpec chain runs automatically.
- Data-lake verification and future discovery jobs may use available CPU/storage.

The UI must always show mode, queue, CPU/RAM, data-disk free space and current machine action.

## 5. Storage contract

### Small operational state
- DuckDB: market snapshots, anomaly episodes, news/candle cache.
- SQLite lab DB: ideas, jobs, StrategySpecs/runs.
- SQLite account DB: tracked public/authorized accounts, fills, position snapshots and sync log.

### Heavy history
Partitioned Parquet with Zstandard:
`provider / instrument / interval / year / month`.

Data lake is configurable to another drive. Do not store massive historical market streams in Google Drive or Postgres.

### Portable TQS snapshot
One button exports a ZIP containing current Market Snapshot, anomaly episodes, findings, ideas, jobs, StrategySpecs/runs, relationships, logs, data-lake manifest, tracked account profiles/open positions/recent fills and `AI_READ_ME.json`. If Google Drive Desktop path is configured, copy the ZIP there automatically.

## 6. Anomaly semantics

Anomaly detectors should answer:

> What is materially different from this instrument's normal state, market/sector peers or related venues — and could this be a place where movement starts/accelerates?

Candidate inputs include:
- returns across horizons;
- realized volatility / ATR;
- range expansion/compression;
- turnover/volume/trades vs history and same-time baseline;
- OI / delta OI / acceleration;
- funding / basis;
- spot-perp divergence;
- spread/depth/imbalance/aggressive flow when available;
- liquidations;
- relative strength vs index/sector/underlying;
- cross-exchange divergence;
- session/auction/clearing/expiry/roll context;
- news/event timing;
- participant-position features where licensed;
- meaningful tracked-account position/fill changes where public/authorized.

A high anomaly score alone is not a direction. Historical Replay should primarily compare subsequent **absolute movement** versus background control. Direction is a separate research question.

UI must show 2–4 concrete `WHY SHOWN` reasons, not only one opaque scalar.

## 7. Historical Replay

Target: reconstruct large libraries of historical anomaly episodes from 2021 onward where source coverage permits.

Flow:
`Parquet candles/features → no-lookahead baselines → anomaly episodes → outcomes → controls → chronological splits → movement-candidate status`.

Primary endpoints:
- absolute return after 15m/1h/4h/24h;
- MFE/MAE;
- time-to-move;
- volatility/range expansion after event;
- direction continuation/reversal as secondary metrics;
- effect by session/regime/liquidity/sector/instrument.

`movement_candidate` means only that post-anomaly movement is elevated on validation/holdout relative to background. It is not a BUY/SELL strategy.

## 8. Strategy Machine v2

Any author idea should be representable as a versioned StrategySpec:
- universe;
- data/features;
- setup/event;
- filters;
- trigger;
- entry;
- cancellation/invalidation;
- management;
- exit;
- sizing (future live layer);
- execution/cost model;
- controls;
- validation contract.

Minimum strategy gate:
1. Formal event definition with no lookahead.
2. Appropriate controls/placebo.
3. Parameter selection only in exploration/training.
4. Chronological validation and untouched holdout.
5. Walk-forward/stability.
6. Minimum effective N and double-counting controls.
7. Fees/spread/slippage assumptions.
8. Negative/failure cells remain visible.

Built-in research families:
- round/buffer bounce;
- buy-the-dip percentage/bps grid;
- buy-the-dip absolute-point grid.

Profit/loss diagnostics retain MFE/MAE, best/worst trades and regime cells. A diagnostic observation such as `works mainly after high volatility` becomes a **new hypothesis** and must be tested on fresh OOS data; do not rewrite the original holdout.

Do not automatically promote `candidate` to live trading. `validated` requires stronger replication/data-quality/execution evidence.

## 9. Position / account intelligence

See `POSITION_ACCOUNT_INTELLIGENCE.md`.

### Public/authorized individual account layer
Where a venue exposes an account/address lawfully, TQS may collect:
- current open positions;
- fill history;
- position size/notional;
- entry/leverage/liquidation/PnL where source supplies them;
- maker/taker evidence where supplied.

Derived behavioral descriptions may include:
- long/short bias;
- instrument concentration;
- scaling behavior;
- execution aggressiveness;
- recurring timing/context patterns.

These are observations/hypotheses, not claims about intent.

### Aggregate participant layer
MOEX individuals/legal entities long/short and participant counts are cohort-level features. Never present them as named-account data.

Future research should synchronize account fills/position changes with the same MarketContext used by anomaly/strategy research.

## 10. MOEX Market Lab

MOEX is not a simple quote table. Target model:

### Cash stocks
- price/change;
- turnover/volume/NUMTRADES;
- spread;
- day range + position in range;
- time-of-day activity baseline;
- acceleration;
- relative strength vs IMOEX/sector;
- linked stock futures;
- news/corporate events;
- technical/anomaly episodes.

### Futures families
- current/next/perpetual where relevant;
- volume/turnover/trades;
- OI + delta/acceleration;
- days/hours to expiry;
- basis;
- roll share/progress;
- liquidity/spread;
- underlying/index/FX linkage;
- clearing/expiry state.

### Premium participant layer
Architecture must accept licensed fields without UI redesign:
- individuals long/short;
- legal entities long/short;
- number of participants;
- intraday deltas;
- total OI;
- individual net / legal net / participant divergence / acceleration;
- price × OI × participant-position divergences.

Never silently mix delayed/free and realtime/premium series. Preserve source, timestamp, delay/quality and entitlement state.

## 11. News / Telegram / events

News is a first-class event stream, not text decoration.

Target adapters:
- GDELT;
- RSS/Atom;
- official issuer/exchange/regulator sources;
- Telegram after credentials/configuration;
- future premium providers.

Store original source/url/channel, exact times, entities/themes, source class, market state before event and reaction checkpoints. Temporal coincidence is not automatic causality.

## 12. Idea Lab

There must always be low-friction space for ideas from Artem or the machine.

Idea types:
- research;
- anomaly detector;
- strategy;
- data source;
- interface/chart;
- account/participant research;
- briefing/course/content;
- system/reliability.

Raw idea text is preserved. AI may convert it into one or several ResearchSpecs/StrategySpecs/product tasks, linked back to the original idea.

## 13. Selection / In Play

Full universe remains searchable. Top screen is a priority system, not a dump.

Conceptual priority:
`abnormality × liquidity/relevance × freshness`, extended by evidence quality and cross-market/account context.

Selection should support fixed anchors, promoted anomalies, stocks/sectors/futures in play, expiry/roll week promotion, cross-market stories and technicality profiles.

## 14. Charts and drill-down

Instrument/anomaly/account charts should support:
- candlesticks;
- crosshair/zoom/pan;
- anomaly start/active window;
- trigger/entry/levels/zones;
- score/feature panel;
- volume/OI/funding/participant overlays;
- tracked-account fills/position changes where relevant;
- before/after context;
- comparable episodes;
- strategy trades/controls.

Desktop-first, broadcast-readable, matte graphite/black, warm white, thin separators; green/red for direction, amber for anomaly/warning.

## 15. Briefing / presentation

Briefing is another view of the same intelligence core, not a second research process.

Top scene:
- fixed anchors;
- 3–6 promoted stories;
- each story answers `WHY SHOWN`;
- relevant news/account/participant evidence where material;
- research updates;
- session/expiry context.

Presenter mode: fullscreen, LIVE/FROZEN, snapshot archive/export. Future PPTX/PDF/HTML/video outputs derive from the same versioned BriefingSnapshot.

## 16. AI improvement protocol

When AI receives the repo or a TQS snapshot, inspect in this order:
1. Data/source/account health and stale/missing fields.
2. What anomalies/movement candidates actually exist.
3. Which results survive controls/OOS and which fail.
4. Position/account changes that coincide with market states, without over-claiming causality.
5. Missing variables or alternative explanations.
6. High-value next research/strategy/data-source tasks.
7. UI changes that improve 5–20 second understanding.
8. Cost/reliability/storage implications.

Return proposed changes as testable units. Do not dump dozens of speculative features into production simultaneously.

## 17. Self-update contract

Windows uses a supervisor process.
- UI can request update.
- Supervisor fetches current upstream.
- Dirty worktree blocks automatic update.
- Running heavy research blocks non-forced update.
- Fast-forward pull only.
- Reinstall dependencies.
- Restart API and run healthcheck.
- If health fails, reset to prior commit and restart previous version.

Local market/research/account data must never be deleted by code updates.

## 18. Future expansion map

High-value next layers, all inside the same product:
- full-universe scheduled historical backfill orchestrator;
- feature store and versioned derived metrics;
- MOEX premium/realtime participants + options;
- order flow/L1/L2/microstructure collectors;
- liquidations/on-chain/DEX/wallet flow;
- account-fill → MarketContext synchronization and behavioral event studies;
- Telegram + official-news event ingestion and reaction studies;
- sector/futures-family/underlying instrument graph;
- automated regime clustering and conditional discovery;
- cross-instrument lead/lag and sequence mining with multiple-testing controls;
- generic strategy DSL plugins;
- paper/demo execution + hard risk engine later;
- BriefingSnapshot → fullscreen/web/PPTX/PDF/video;
- knowledge/course builder from verified cases.

The success metric is not number of features. It is **verified useful market/research output per unit of Artem's attention**.
