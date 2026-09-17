# TQS PRODUCT CHANGE PROTOCOL

Goal: make TQS one continuously improving product where Artem can describe an idea in ordinary Russian, ordinary ChatGPT performs the maximum feasible implementation directly through GitHub/CI/plugins, and the local terminal receives it through the Update button.

## Owner workflow

`идея Артёма -> resolve true outcome -> latest repo/runtime state -> implement/research in same product -> deterministic checks -> commit/checkpoint -> runtime/UI proof -> Update -> healthcheck -> available in same TQS`

Artem should not need to decide repository paths, worker topology, model routing, terminal commands or which plugin to use.

Default execution route = ordinary ChatGPT. Work/Codex/Cursor are escalation only for a concrete capability gap that cannot be closed by GitHub Actions, connected plugins, deployment/runtime APIs or a small observable bridge.

## Idea classes

Every idea must be classified internally into one or more of:

- `anomaly` — new abnormal-state detector/feature;
- `research` — hypothesis/event study/relationship;
- `strategy` — setup/entry/exit/management/cost rule;
- `source` — new market/news/provider data;
- `ui` — screen/chart/filter/drill-down improvement;
- `briefing` — briefing/presentation/course transformation;
- `system` — reliability/storage/performance/update/control.

The owner does not need to fill a form to classify an idea. Preserve the original wording only when it creates durable value and link derived tasks/results to it.

## Automatic AI design pass

Before implementation AI should answer internally:

1. What is the actual owner outcome?
2. What current product/repo/runtime state is freshest?
3. Is it live intelligence, research, strategy, source, UI or several layers?
4. What data is required and do we have it?
5. What can be deterministic and what, if anything, needs an LLM?
6. What can create lookahead/data-mining bias?
7. How is success verified objectively end-to-end?
8. How does it appear in the existing Russian UI?
9. What must be persisted for future AI/research?
10. What is the cheapest robust implementation?
11. Can existing components/data be reused?
12. What small runtime/CI bridge would avoid a Work/Codex escalation?

## Checkpoint-first execution

A long Chat turn is not persistence. GitHub is the recovery point.

For substantial work:

`logical slice -> commit/push -> FAST -> repair -> checkpoint -> next slice -> FULL -> runtime/UI proof`

Prefer one observable product slice or 1–5 tightly related files before checkpointing. Avoid both extremes: one commit per trivial edit and dozens of unverified files held until the end.

If the Chat/tool run stops, the next turn starts from latest branch/PR/HEAD/checks and affected files, not from a full rediscovery.

## Product pass, not scaffold

A primary feature is incomplete until the critical path exists:

`source/input -> processing -> persisted state -> owner-facing result -> observable action/insight`

The following are PARTIAL/scaffold, even with green CI:
- empty owner screen with only a manual form when data can be auto-discovered;
- API endpoint without visible useful result;
- strategy definition that has never run;
- Update button without a proven update/restart/health path;
- dashboard counters without clear semantic stage/owner value;
- background process without observable heartbeat/progress/output.

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
- loading/empty/error/stale/offline states;
- source/quality visibility where relevant;
- `ПОЧЕМУ ПОКАЗАНО` for promoted market items;
- useful chart/drill-down when time series matter;
- no new standalone product unless architecture explicitly requires it;
- 5–20 second clarity: `что происходит / почему / что машина делает дальше`.

Runtime/activity UI must obey `MACHINE_ACTIVITY_CONTRACT.md`. CPU/RAM, open browser page, cached data or old logs are never enough to claim that autonomous work is currently running.

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
- docs/AI context updated if product behavior changed;
- for local/Windows behavior, CI evidence is supplemented by Launcher/runtime evidence when applicable;
- version + local commit + remote commit are observable.

## Update button contract

The Launcher/Update control is the normal owner deployment mechanism. The Web product may expose update status but should not be the only process capable of replacing/restarting itself.

Supervisor behavior:

1. check Git upstream;
2. show local/remote commit and dirty-state reason;
3. refuse/descope update if worktree has meaningful local changes;
4. defer while heavy research is running unless explicitly forced;
5. fast-forward only;
6. reinstall dependencies when required;
7. restart TQS;
8. healthcheck the new runtime instance;
9. rollback to old commit on failed healthcheck;
10. never delete `data/`, configured Data Lake or exported snapshots.

Windows-specific update/runtime behavior should be tested for CRLF/LF, quoting, locked files/process ownership, updater self-replacement and sleep/hibernation where relevant.

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
- runtime identity/activity summary and latest meaningful activity ledger;
- current Market Snapshot;
- anomaly episodes and selected chart series;
- research findings;
- ideas/jobs;
- StrategySpecs and run summaries;
- relationships;
- account intelligence summary;
- briefing snapshot;
- logs/errors;
- Data Lake manifest/checksums/coverage;
- AI_READ_ME pointing to `AI_OPERATING_CONTEXT.md`, `MACHINE_ACTIVITY_CONTRACT.md`, `MOEX_DATA_MATRIX.md` and this protocol.

This package may be copied to a configured Google Drive Desktop folder automatically.

## Definition of success

The owner can say something like:

`проверь, что происходит, когда акция подходит к круглому уровню после сильного роста объёма`

and the product evolves without creating a separate workflow:

`idea -> formal StrategySpec/research -> historical data -> event/control study -> results/charts -> saved knowledge -> optional detector/screener -> Update -> runtime proof -> same TQS terminal`.
