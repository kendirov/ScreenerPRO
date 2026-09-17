# TQS PRODUCT CHANGE PROTOCOL

Goal: make TQS one continuously improving product where Artem can describe an idea in ordinary Russian, AI implements/researches it, and the local terminal receives it through the Update button.

## Owner workflow

`идея Артёма -> Idea Inbox -> classify -> design -> implement/research -> tests -> commit -> Update -> healthcheck -> available in same TQS`

Artem should not need to decide repository paths, worker topology or model routing.

## Idea classes

Every idea must be classified into one or more of:

- `anomaly` — new abnormal-state detector/feature;
- `research` — hypothesis/event study/relationship;
- `strategy` — setup/entry/exit/management/cost rule;
- `source` — new market/news/provider data;
- `ui` — screen/chart/filter/drill-down improvement;
- `briefing` — briefing/presentation/course transformation;
- `system` — reliability/storage/performance/update/control.

Preserve the original raw wording forever and link all derived tasks/results to it.

## Automatic AI design pass

Before implementation AI should answer internally:

1. What is the actual user outcome?
2. Is it live intelligence, research, strategy, source, UI or several layers?
3. What data is required and do we have it?
4. What can be deterministic and what, if anything, needs an LLM?
5. What can create lookahead/data-mining bias?
6. How is success verified objectively?
7. How does it appear in the existing Russian UI?
8. What must be persisted for future AI/research?
9. What is the cheapest robust implementation?
10. Can existing components/data be reused?

## Market-research gate

For market-edge ideas, implementation is incomplete until the system can store:

- exact versioned definition;
- universe/timeframe;
- source provenance;
- event samples;
- control/placebo;
- chronological exploration/validation/holdout;
- walk-forward/stability where applicable;
- costs/slippage assumptions;
- negative results;
- reproducible run ID.

AI may suggest an edge but deterministic code decides statistics.

## UI gate

Any owner-facing change must have:

- Russian labels/explanations;
- loading/empty/error/stale states;
- source/quality visibility where relevant;
- `ПОЧЕМУ ПОКАЗАНО` for promoted market items;
- useful chart/drill-down when time series matter;
- no new standalone product unless architecture explicitly requires it.

## Data-source gate

New adapters must record:

- provider and provider symbol;
- event/exchange/source time when available;
- fetched/received time;
- delay/quality class;
- entitlement/license state;
- fallback/proxy flag;
- errors/health;
- mapping to canonical instrument/event.

Never silently merge different methodologies or delayed/free data with premium/realtime data.

## Delivery gate

Before a commit is considered update-ready:

- targeted tests pass;
- syntax/build checks pass for affected layers;
- no local data migration deletes existing data unless explicitly approved;
- update path remains fast-forward safe;
- health endpoint remains healthy;
- rollback path remains possible;
- docs/AI context updated if product behavior changed.

## Update button contract

The local UI Update button is the normal owner deployment mechanism.

Supervisor behavior:

1. check Git upstream;
2. refuse update if worktree is dirty;
3. defer while heavy research is running unless explicitly forced;
4. fast-forward only;
5. reinstall dependencies;
6. restart TQS;
7. healthcheck;
8. rollback to old commit on failed healthcheck;
9. never delete `data/`, configured Data Lake or exported snapshots.

## Machine-origin ideas

TQS itself may add Idea Inbox entries when it finds:

- validated movement candidates;
- strategy candidates;
- unexplained recurring anomalies;
- source/data-quality gaps;
- strong news/reaction patterns;
- interface overload or monitoring blind spots;
- recurring runtime errors/performance bottlenecks.

Each machine idea should include:

- why it was generated;
- evidence/sample count;
- confidence/limitations;
- recommended falsification/next test;
- affected instruments/data.

## Snapshot for external AI

`Сохранить TQS` should produce one portable package containing enough evidence for a fresh AI session to understand current state without reading the entire raw Data Lake:

- system/version/config summary without secrets;
- source health;
- current Market Snapshot;
- anomaly episodes and selected chart series;
- research findings;
- ideas/jobs;
- StrategySpecs and run summaries;
- relationships;
- briefing snapshot;
- logs/errors;
- Data Lake manifest/checksums/coverage;
- AI_READ_ME pointing to `AI_OPERATING_CONTEXT.md`, `MOEX_DATA_MATRIX.md` and this protocol.

This package may be copied to a configured Google Drive Desktop folder automatically.

## Definition of success

The owner can say something like:

`проверь, что происходит, когда акция подходит к круглому уровню после сильного роста объёма`

and the product evolves without creating a separate workflow:

`idea -> formal StrategySpec/research -> historical data -> event/control study -> results/charts -> saved knowledge -> optional detector/screener -> Update button -> same TQS terminal`.
