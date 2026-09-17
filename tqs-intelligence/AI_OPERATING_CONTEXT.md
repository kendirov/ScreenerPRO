# TQS INTELLIGENCE & STRATEGY MACHINE — AI OPERATING CONTEXT v0.4

Status: active product/engineering contract for the local TQS engine.

## 1. Product goal

Build one continuously improving local/server market machine that:

1. Collects crypto, MOEX stocks/futures/FX/indices/bonds, global market context and news.
2. Stores durable market history and source provenance.
3. Detects unusual states and turns them into persistent anomaly episodes.
4. Treats an anomaly primarily as a **candidate place/time where a meaningful move may start or accelerate**.
5. Replays the same logic historically to estimate whether movement after an anomaly is materially different from normal background.
6. Converts Artem's ideas into reproducible StrategySpec/research tasks.
7. Tests actual entry/exit logic with controls, OOS/holdout, walk-forward, regime/stability and cost layers.
8. Accumulates negative as well as positive results.
9. Produces a trader terminal, interactive briefing/presentation and reusable knowledge for courses/content.
10. Runs 24/7 with low owner attention and can be updated safely from the UI.

Primary owner UX:

`I observe/say an idea → TQS stores/formalizes/tests it → I press Update → the same product gains a better detector/research/strategy/UI.`

## 2. Truth and evidence hierarchy

- Runtime + actual market DB/data lake = operational truth.
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

## 3. Core architecture

```text
Providers / News / Owner ideas
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
Controls + OOS + Walk-forward + Costs + Stability
        ↓
REJECTED / INCONCLUSIVE / CANDIDATE / VALIDATED (promotion requires stronger evidence)
        ↓
In Play / Screener / Briefing / Course / Product features
```

Two strict layers:

### Deterministic Research Core
Raw data, features, event definitions, controls, outcomes, costs, tests and promotion gates. LLMs do not silently change formulas or outcomes.

### AI Research Brain
Reads compact results/snapshots, proposes hypotheses, missing controls, new anomalies, strategy variants, UI/data-source improvements and research priorities. Every proposed market edge returns to deterministic testing.

## 4. Runtime modes

### STOP
- Background market loop stopped.
- Heavy research stopped.
- Manual refresh remains possible.
- Data is preserved.

### LIGHT
For normal PC work.
- Live market/news/anomaly collection runs.
- New live anomaly episodes are preserved.
- Only minimal context/history is loaded for new episodes.
- Bulk 2021+ backfills, replays and Strategy Machine wait.

### MAX
For night/server/heavy research.
- Faster live loop.
- Persistent historical jobs execute.
- Backfill → Historical Replay → matching StrategySpec chain runs automatically.
- Data-lake verification and future discovery jobs may use available CPU/storage.

The UI must always show current mode, queue, CPU/RAM, data-disk free space and current machine action.

## 5. Storage contract

### Small operational state
DuckDB + local SQLite control/lab DB.

### Heavy history
Partitioned Parquet with Zstandard:
`provider / instrument / interval / year / month`.

Data lake is intentionally configurable to another drive (Windows installer prefers `D:\TQS_DATA` when available).

Do not store massive historical market streams in Google Drive or Postgres.

### Portable TQS snapshot
One button exports a ZIP containing the current Market Snapshot, anomaly episodes, findings, ideas, jobs, StrategySpecs/runs, relationships, logs, data-lake manifest and `AI_READ_ME.json`. If Google Drive Desktop path is configured, copy the ZIP there automatically.

This snapshot is the preferred artifact when an AI needs to inspect what the local TQS machine actually found.

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
- participant-position features where licensed.

A high anomaly score alone is not a direction. Historical Replay must primarily compare subsequent **absolute movement** versus a normal/background control. Direction is a separate research question.

UI must show 2–4 concrete `WHY SHOWN` reasons, not only one opaque scalar.

## 7. Historical Replay

Target: reconstruct large libraries of historical anomaly episodes from 2021 onward where source coverage permits.

Flow:
`Parquet candles/features → no-lookahead baselines → anomaly episodes → outcomes → controls → chronological splits → movement-candidate status`.

Primary endpoints can include:
- absolute return after 15m/1h/4h/24h;
- MFE/MAE;
- time-to-move;
- volatility/range expansion after event;
- direction continuation/reversal as secondary metrics;
- effect by session/regime/liquidity/sector/instrument.

`movement_candidate` means only that post-anomaly movement is elevated on validation/holdout relative to background. It is not a BUY/SELL strategy.

## 8. Strategy Machine

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
- validation contract.

Minimum strategy gate:
1. Formal event definition with no lookahead.
2. Appropriate controls/placebo.
3. Exploration/training separated chronologically from validation and untouched holdout.
4. Walk-forward/stability.
5. Minimum effective N and double-counting controls.
6. Fees/spread/slippage assumptions.
7. Negative/failure cells remain visible.

Do not automatically promote `candidate` to live trading. `validated` requires stronger replication/data-quality/execution evidence.

### First built-in example: round/buffer bounce
Test rejection/bounce around round levels versus shifted controls. Parameter selection occurs only in exploration; validation/holdout stay untouched. Store MFE/MAE and robustness across spacing/buffer values rather than announcing one magical optimal number.

## 9. MOEX Market Lab

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

### Premium participant layer (when credentials are supplied)
Architecture must accept licensed MOEX fields without UI redesign:
- individuals long/short;
- legal entities long/short;
- number of participants;
- intraday deltas;
- total OI;
- derived individual net / legal net / participant divergence / acceleration;
- price × OI × participant-position divergences.

Never silently mix delayed/free and realtime/premium series. Preserve source, timestamp, delay/quality and entitlement state.

## 10. News / Telegram / events

News is a first-class event stream, not text decoration.

Target adapters:
- GDELT;
- RSS/Atom;
- official issuer/exchange/regulator sources;
- Telegram channels after credentials/configuration;
- future premium news providers.

Store:
- original source/url/channel;
- exact observed/published time;
- entities/instruments/themes;
- confidence/source class;
- market state before event;
- reaction checkpoints 1m/5m/15m/1h/4h/day where data exists;
- historical analogues.

Temporal coincidence is not automatic causality. If cause is unknown, label it unknown.

## 11. Idea Lab

There must always be low-friction space for ideas from Artem or the machine.

Idea types:
- research;
- anomaly detector;
- strategy;
- data source;
- interface/chart;
- briefing/course/content;
- system/reliability.

Raw idea text is preserved. AI may convert an idea into one or several ResearchSpecs/StrategySpecs/product tasks, but must link them back to the original idea.

Machine discoveries may create Idea Inbox items with `origin=machine`, but they must explain the evidence and next falsification step.

## 12. Selection / In Play

Full universe remains searchable. Top screen is a priority system, not a dump.

Conceptual priority:
`abnormality × liquidity/relevance × freshness`, extended by evidence quality and cross-market context.

Selection should support:
- fixed anchors;
- promoted anomalies;
- stocks/sectors/futures in play;
- expiry/roll week promotion;
- cross-market stories;
- technicality profile rather than one unexplained technicality score.

Technicality profile can include:
- repeatability/OOS stability;
- false-break/path noise;
- spread/liquidity;
- regime stability;
- effective N/data confidence;
- cross-market/venue replication.

## 13. Charts and drill-down

Desktop-first, broadcast-readable, matte graphite/black, warm white, thin separators. Green/red only for direction, amber for anomaly/warning. No neon/cyberpunk/generic-card wall.

Instrument/anomaly chart should support:
- candlesticks;
- crosshair/zoom/pan;
- anomaly start/active window;
- trigger/entry/levels/zones;
- score/feature panel;
- volume/OI/funding/participant overlays when available;
- before/after context;
- exact historical comparable episodes;
- strategy trades/controls when research result is opened.

Prefer TradingView Lightweight Charts or existing reusable chart renderer; renderer is not a market-data source.

## 14. Briefing / presentation

Briefing is another view of the same intelligence core, not a second research process.

Top scene:
- fixed anchors;
- 3–6 promoted stories;
- each story answers `WHY SHOWN`;
- relevant news/event evidence;
- research updates;
- session/expiry context.

Presenter mode:
- fullscreen;
- LIVE/FROZEN state;
- freeze snapshot so items do not jump during broadcast;
- keyboard navigation later;
- snapshot archive/export.

Future PPTX/PDF/HTML/video outputs should derive from the same versioned BriefingSnapshot, not recreate facts independently.

## 15. AI improvement protocol

When AI receives the repo or a TQS snapshot, it should inspect in this order:
1. Data/source health and missing/stale fields.
2. What anomalies/movement candidates actually exist.
3. Which results survive controls/OOS and which fail.
4. Missing variables or alternative explanations.
5. High-value next research/strategy/data-source tasks.
6. UI changes that improve a trader's 5–20 second understanding.
7. Cost/reliability/storage implications.

Return proposed changes as testable units. Do not dump dozens of speculative features into production simultaneously.

## 16. Self-update contract

Windows uses a supervisor process.
- UI can request update.
- Supervisor fetches the current Git upstream.
- Dirty worktree blocks automatic update.
- Running heavy research blocks non-forced update.
- Fast-forward pull only.
- Reinstall dependencies.
- Restart API and run healthcheck.
- If health fails, reset to prior commit and restart previous version.

Auto-update may check periodically; local market/research data must never be deleted by code updates.

## 17. Future expansion map

High-value next layers, all inside the same product:
- full-universe scheduled historical backfill orchestrator;
- feature store and versioned derived metrics;
- MOEX premium/realtime participants + options;
- order flow/L1/L2/microstructure collectors;
- liquidations/on-chain/DEX/wallet flow;
- Telegram + official-news event ingestion and reaction studies;
- sector/futures-family/underlying instrument graph;
- automated regime clustering and conditional discovery;
- cross-instrument lead/lag and sequence mining with multiple-testing controls;
- strategy DSL plugins beyond round levels;
- paper/demo execution + hard risk engine later;
- BriefingSnapshot → fullscreen/web/PPTX/PDF/video;
- knowledge/course builder from verified cases.

The success metric is not number of features. It is **verified useful market/research output per unit of Artem's attention**.
