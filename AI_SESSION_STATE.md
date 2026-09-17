# AI_SESSION_STATE — TQS PLATFORM

Status: ACTIVE RESUME STATE — 2026-09-17

> Do not treat a hardcoded SHA in a state file as fresher than Git itself. On every new session verify the current branch/PR/CI/runtime first.

## 1. Current product

TQS (Trading QS) is the umbrella platform. The GitHub repository is still named `kendirov/ScreenerPRO` for historical reasons and currently acts as the TQS monorepo.

Canonical module map: `TQS_PLATFORM.md`.
AI front door: `START_HERE_FOR_AI.md`.
Product vision: `PRODUCT_VISION.md`.

## 2. Active TQS development line

Branch: `codex/tqs-intelligence-engine-v0-1-2026-09-17`
PR: `#11 — TQS Intelligence Engine v0.1 — multi-market anomaly and research core`

The PR is intentionally stacked on the older TraderQuest TQ-004 branch rather than current `main`; integration to `main` must be deliberate. Do not assume a blind merge is safe.

Package/product version after the current normalization slice: **v0.8.4**.

## 3. What exists now

### TQS Intelligence / local machine
Under `tqs-intelligence/`:
- FastAPI local API and Russian cockpit;
- Windows TQS Launcher + supervisor;
- STOP / LIGHT / MAX control;
- version/Git/update/rollback path;
- process + supervisor heartbeat watchdog with hysteresis;
- Bitget, Binance, Bybit, OKX and MOEX public market sources;
- optional Twelve Data adapter;
- GDELT/RSS news layer;
- DuckDB operational store;
- Parquet Data Lake;
- live anomalies and anomaly episodes;
- history backfill (Binance + MOEX priority universe from 2021);
- Historical Replay;
- Research Runtime / auto-history planner;
- Strategy Machine and StrategySpec runs;
- Universal Instrument Lab;
- Hyperliquid public account discovery/intelligence;
- Briefing builder;
- relationships miner;
- portable TQS diagnostic/support snapshot.

### TQS Launcher
Operator/control surface, not the trading UI:
- start/stop/restart;
- MAX/LIGHT/STOP;
- product version + local/remote Git state;
- one-click update with rollback path;
- runtime log;
- resource telemetry;
- Windows keep-awake in MAX;
- watchdog that must not kill healthy heavy work after one HTTP timeout.

### TQS Screener / Cockpit
Existing web/frontend/ScreenerPRO surfaces are the future trader-facing TQS Screener/Cockpit module. They are not the canonical market compute engine. New integration should consume TQS Intelligence/Knowledge contracts rather than duplicate collection/research.

### TQS Knowledge / Drive
Google Drive `Trading QS` is human-readable canon for owner decisions, observations, cases, research/product knowledge and content. It is not a raw market database.

## 4. Current reliability lessons already converted to code/contracts

- One failed `/api/health` probe must not trigger destructive restart.
- Supervisor heartbeat + process evidence + hysteresis are separate from HTTP responsiveness.
- MAX should generate useful background work when explicit research queue is empty.
- Cached browser data/CPU/RAM do not prove the backend is alive.
- Every autonomous loop should expose action/progress/last success/next due/error.
- Repeated owner terminal intervention is a defect signal for the harness.

See:
- `tqs-intelligence/MACHINE_ACTIVITY_CONTRACT.md`
- `tqs-intelligence/OVERNIGHT_RUNBOOK.md`
- `tqs-intelligence/TQS_DIAGNOSTICS_CONTRACT.md`
- `tqs-intelligence/METRIC_CATALOG.md`

## 5. Diagnostic snapshot v3

Default `Сохранить TQS` / `POST /api/export/snapshot` with `full=false` is intended as **SUPPORT_REDACTED**:
- product/runtime/Git identity;
- market/research/source/Data Lake state;
- jobs/results/logs;
- deterministic `diagnosis.json`;
- redacted account profile summary;
- AI_READ_ME.

`full=true` is **FULL_PRIVATE** and may include raw account data/database copy. Never commit snapshot exports into public GitHub.

## 6. Version identity

`pyproject.toml`, package `__version__` and FastAPI `app.version` should be the same semantic version. API `/api/health`, `/api/overview` and `/api/system` expose runtime identity including module/version/runtime instance/PID/start time.

Launcher also shows local/remote Git state; runtime and Git identity are related but not interchangeable.

## 7. Current architecture decision

**Conceptual separation now, physical split later only if justified.**

TQS modules:
1. Platform/Core
2. Intelligence
3. Launcher
4. Screener/Cockpit
5. Knowledge
6. Research/Strategy Lab
7. Briefing/Publishing
8. Connectors/Data
9. optional future Cloud/Sync

Keep modular monorepo while contracts evolve rapidly. A separate repo/service requires a concrete deployment/security/toolchain/scale boundary.

## 8. Truth boundaries

- Drive = human/product/knowledge truth.
- GitHub = public-safe technical truth.
- Data Lake/DB = market/research operational truth.
- Runtime heartbeat/process/API/job state = liveness truth.
- Primary external provider = current external truth.

The repository is public: secrets/private Drive contents/private account payloads/raw private support snapshots must not be committed.

## 9. Next product focus

After local v0.8.4 is updated and overnight stability is proven, highest-value next work is:
1. owner-facing Activity Ledger + “что сделано за ночь” summary;
2. visual redesign of TQS Screener/Cockpit and Universal Instrument Lab;
3. richer historical feature layer (OI/funding/basis/liquidations/microstructure as source availability permits);
4. Research visualization: event studies/distributions/regimes/OOS/counterexamples;
5. explicit integration bridge from local TQS Intelligence API/snapshots to web TQS Screener;
6. structured Knowledge indexing only when retrieval/use cases justify it.

Do not add 20 sources before observability, semantics and research usefulness of existing sources are clear.

## 10. New-session algorithm

1. Read `START_HERE_FOR_AI.md`.
2. Read `TQS_PLATFORM.md`.
3. Read this file.
4. Fetch current branch/PR/CI and determine latest HEAD.
5. If local runtime evidence is needed, ask for/use TQS SUPPORT snapshot rather than generic terminal screenshots.
6. Read only affected module `AGENTS.md` + relevant files/contracts.
7. Continue existing product Chat-first.
8. Checkpoint after each stable logical slice.
9. Finish only with objective evidence or a precise real blocker.

Owner can simply say:

`Продолжай TQS: <цель>.`
