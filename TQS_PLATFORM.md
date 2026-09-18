# TQS PLATFORM — CANONICAL SYSTEM MAP

Status: ACTIVE PLATFORM CONTRACT — 2026-09-17

> GitHub repository name `ScreenerPRO` is historical. Until a repository split is objectively useful, treat this repository as the **TQS monorepo**. Product/module names below are canonical.

## 1. North Star

**TQS (Trading QS)** is one AI-first market operating system. It should continuously turn heterogeneous market data, events, public participant/account evidence, Artem's observations and research ideas into reproducible market context, tested knowledge and trader-facing products.

The owner workflow is intentionally simple:

`Артём говорит цель/идею → TQS/AI resolves context → implementation/research runs → objective evidence → result appears in the same system → durable knowledge/state is preserved.`

We optimize for **verified useful outcome per unit of owner attention**, not number of screens, agents, files, indicators or tokens.

## 2. Product modules

### TQS Platform / Core
Umbrella and contracts shared by every module: stable IDs, instrument identity, provenance, time semantics, evidence classes, schemas, routing and capability registry. It is not a second UI.

### TQS Intelligence
Local/compute engine under `tqs-intelligence/`.
Responsibilities: source adapters, normalization, live collection, Data Lake, features, anomaly/episode lifecycle, historical replay, relationships, account/position intelligence, research jobs, Strategy Machine, briefings and machine-readable APIs.

### TQS Launcher
Owner-facing local control plane for TQS Intelligence on Windows.
Responsibilities: start/stop/restart, STOP/LIGHT/MAX, version and Git state, update/rollback, process/supervisor/API health, logs, diagnostic/support snapshot and one-click Remote Node setup/status. Launcher controls and configures the machine; it is not the trading cockpit and is not required to remain open after Remote Node setup.

### TQS Remote Node
The office Windows workstation can operate as the always-on private TQS server.
Responsibilities: Windows boot autostart, Supervisor-owned backend recovery, server-mode keep-awake, safe Git auto-update/rollback and private browser access through Tailscale Serve.
The TQS API remains bound to `127.0.0.1`; Remote Node must not make port 8787 public.
Canonical technical contract: `tqs-intelligence/REMOTE_NODE.md`.

### TQS Runtime Audit / AI Bridge
The running node publishes deterministic evidence through `GET /api/audit`. A hidden user-session bridge writes the sanitized audit to Google Drive every two minutes when Drive for desktop is mounted.
Purpose: give the owner and future ChatGPT sessions a verifiable view of source health, snapshot freshness, MOEX coverage, participant layers, update state, missing data layers and recent errors without exposing the private Tailscale server.
A ChatGPT session must not claim live-node visibility until it has actually read a fresh Drive audit.

### TQS Screener / Cockpit
Trader-facing visual/action layer. The existing ScreenerPRO frontend evolves into this module.
Responsibilities: market pulse, In Play, universal instrument drill-down, anomalies/episodes, accounts/positions, research/strategy results, briefings and operator actions. It should consume canonical TQS APIs/objects rather than re-implementing collection or research logic.

### TQS Knowledge
Human-readable and structured memory layer.
- Google Drive `Trading QS` = canonical human-readable product/market knowledge, owner decisions, observations, cases, course/briefing material.
- Structured knowledge/index/graph may later use Postgres/Supabase/pgvector when this creates real value.
- Knowledge objects preserve stable TQS IDs, provenance, evidence status and links to data/research artifacts.

### TQS Research / Strategy Lab
Product-level research module, currently implemented largely inside TQS Intelligence.
Responsibilities: hypotheses, event studies, controls, OOS/holdout, walk-forward, stability/regimes, bootstrap, costs/slippage, negative-result memory and StrategySpec runs. A finding is not promoted to edge because it looks interesting.

### TQS Briefing / Publishing
Views over the same canonical intelligence and knowledge: daily briefing, live stream support, course, Telegram/materials, web briefing, slides/PDF when needed. It must not build an independent parallel data collection stack.

### TQS Connectors
Replaceable source adapters for Bitget, Binance, Bybit, OKX, MOEX, global market data, news/events, macro, on-chain and permitted public/authorized account data. New source work starts with semantics/unit/provenance, not UI.

### TQS Data / Data Lake
Operational market-data memory: Parquet for bulk history, DuckDB/local stores for analytics/control today; ClickHouse or another scale layer only when measured workload justifies it. Raw/high-frequency data does not belong in Google Drive.

### Current private remote access + Future TQS Cloud / Sync
Current multi-device access is provided by Remote Node: loopback-only local TQS -> private Tailscale Serve -> owner Mac/phone browser. This is an access bridge, not a second market-data store.

A future Cloud / Sync control/metadata plane may be added only when it creates value beyond the private node. It must not become a second source of market truth.

## 3. Canonical flow

`external sources → canonical instruments/events → raw/live/history storage → features → states/anomalies/episodes → research/strategy → knowledge/cases → Screener/Briefing/Course/AI`

Rules:
1. Downstream modules consume upstream canonical objects; they do not silently redefine the same metric.
2. Every derived result records source/provenance, version/definition and time semantics.
3. Same economic instrument may have multiple venue instruments; keep venue identity separate from cross-venue/economic identity.
4. Negative research outcomes are durable knowledge.
5. AI never receives raw tick/order-book firehoses by default; deterministic code compresses them into relevant state/events first.

## 4. Sources of truth

| Truth | Canonical location | Examples |
| --- | --- | --- |
| Product intent / owner decisions | Google Drive | goals, rules, lessons, knowledge/cases |
| Code / schemas / executable technical contracts | GitHub | source, tests, AGENTS, CI, PRs |
| Market/history/research data | Local Data Lake + DB | candles, snapshots, episodes, jobs, fills |
| Current liveness | Runtime | heartbeat, process/PID, API health, job heartbeat |
| Current external fact | Primary provider/source | exchange/MOEX/news documentation/API |

A chat message or AI final answer is never a source of operational truth by itself.

## 5. Drive ↔ GitHub ↔ Runtime synchronization

Do **not** mirror everything both ways.

Use explicit bridges:
- Drive → AI/product work: goals, owner decisions, knowledge and reusable product rules.
- GitHub → local machine: versioned code, update path, contracts and CI-verified changes.
- Runtime → AI/support: diagnostic snapshot/export containing current machine state and reproducible evidence.
- Runtime/research → Drive: only durable human-useful findings/cases/briefings, not raw market data or noisy logs.
- Knowledge objects link to technical/research artifacts using stable IDs and provenance instead of duplicating full payloads.

The synchronization unit is an **object/contract/reference**, not an uncontrolled folder copy.

## 6. Privacy and repository boundary

This GitHub repository is public. Therefore:
- never commit API keys, secrets, private account credentials, personal notes, private Drive content or raw private diagnostic exports;
- do not publish private Drive IDs/URLs merely to make cross-links convenient;
- public account/position research may exist in code/data workflows, but owner/private account payloads stay local/private;
- support snapshots are redacted by default; an explicit full snapshot may contain sensitive local data and must be treated accordingly.

Drive and local runtime may contain material that must never be synchronized into public GitHub.

## 7. New capability rule

When Artem says "добавь источник / сервис / идею / исследование / экран":
1. locate the correct existing TQS module;
2. define the owner-facing outcome and canonical object/contract;
3. reuse existing upstream data if it already exists;
4. add adapter/feature/research/view rather than a parallel application;
5. persist the result in the correct truth layer;
6. expose observability and failure state;
7. verify end-to-end;
8. update only durable docs/state.

A separate repository/service is justified only by a concrete boundary such as independent deployment, security/isolation, incompatible runtime/toolchain or proven scaling need.

## 8. AI role

AI is the orchestration/reasoning layer, not a replacement for deterministic market computation.

Use AI for:
- interpreting Artem's natural-language goals and observations;
- source/research discovery;
- hypothesis generation and criticism;
- code/product development through Chat-first workflow;
- compact interpretation of anomaly/research/knowledge packages;
- linking cases and proposing next tests;
- briefing/course/material generation from canonical evidence.

Use deterministic code for:
- collection, normalization and timestamps;
- indicators/features and anomaly calculations;
- history/replay/backtests/statistics;
- risk/execution rules;
- health/version/update/diagnostics;
- reproducible exports.

## 9. Operational contract

Every autonomous module/loop must make these answerable without terminal work:
- Is it alive now?
- What is it doing now?
- What useful output did the last cycle produce?
- What is the current progress/coverage?
- When is the next action?
- What failed/retried?
- Where is the result stored/shown?

For the local machine, `tqs-intelligence/MACHINE_ACTIVITY_CONTRACT.md`, `OVERNIGHT_RUNBOOK.md` and `TQS_DIAGNOSTICS_CONTRACT.md` are mandatory.

## 10. Physical architecture for now

Keep the current monorepo while contracts are evolving rapidly:
- `frontend/` and existing web surfaces → TQS Screener/Cockpit evolution;
- `tqs-intelligence/` → local Intelligence + Launcher + Data/Research engine;
- shared/root docs → platform front door and current state;
- `.github/workflows/` → deterministic verification.

Do not spend owner attention on repo renaming/splitting until it creates measurable operational value.

## 11. AI bootstrap

A new AI session starts with:
1. `START_HERE_FOR_AI.md`;
2. this file;
3. `AI_SESSION_STATE.md`;
4. module `AGENTS.md` only for the affected module;
5. current branch/PR/CI/runtime evidence.

Then it works only on the affected surface and expands context on demand.

Owner command can remain short:

`Нам нужен продукт/изменение: <цель>.`

The AI must infer the TQS module, continue the existing system, work Chat-first where tools allow, verify the result and leave a resumable checkpoint.

## 12. Runtime topology — who runs what

TQS is a distributed system even while most compute is local. The nodes have different roles and must not be treated as interchangeable copies.

### Windows TQS Runtime Node — current primary compute/data node
The current office Windows workstation is the primary always-on TQS compute/data node once Remote Node setup is enabled.
It runs:
- Windows scheduled task `TQS Intelligence Server` at boot;
- TQS Supervisor and Intelligence backend without requiring Launcher to stay open;
- TQS Launcher only when the owner wants local control/setup/diagnostics;
- TQS Intelligence backend;
- market/news/account collectors;
- local DuckDB/SQLite control state;
- Parquet Data Lake and heavy history;
- research/replay/Strategy Machine workers;
- local `127.0.0.1` cockpit during development.

This node owns **local operational truth**. If it is off, ChatGPT or a web page cannot honestly claim local collection is continuing.

Do not hardcode volatile hardware specs into platform contracts. Resource telemetry and storage paths come from runtime diagnostics because disks/RAM/machine roles can change.

### ChatGPT / AI Orchestrator — reasoning and development node
ChatGPT is an external reasoning/orchestration surface, not the always-on TQS process.
It can read/write Drive/GitHub and use connected tools, design/research/implement changes and interpret compact TQS exports. It does not have implicit access to the Windows process or local disk. Runtime knowledge requires an explicit bridge such as API access, deployment connector or SUPPORT snapshot.

### GitHub — code distribution and verification node
GitHub stores public-safe code/contracts and provides CI. Launcher pulls verified versions from GitHub. GitHub Actions proves deterministic code contracts but cannot by itself prove that Artem's Windows runtime is healthy right now.

### Google Drive — human/knowledge node
Drive stores durable human-readable goals, decisions, observations, cases and content. It is not the raw Data Lake and does not prove runtime health.

### TQS Screener / Web node
The web/Cockpit layer is a presentation/action client. During local development it may call local TQS APIs. A future cloud web surface must consume an authenticated safe bridge/sync layer; do not expose an unauthenticated local `8787` port to the public Internet.

### Mac / other operator devices
The owner's MacBook and phone are supported private Cockpit clients through the Remote Access Bridge. They do not need the market databases or a local TQS runtime. After one-time Tailscale sign-in to the same tailnet, the normal workflow is simply open the stable TQS HTTPS bookmark.

These devices are not canonical compute nodes unless explicitly promoted and given a runtime identity.

## 13. Integration bridges

Use named, observable bridges so a failure is diagnosable.

### CODE BRIDGE
`GitHub → Launcher → local install/update → healthcheck → rollback on failure`

### RUNTIME SUPPORT BRIDGE
`Local TQS → TQS_SNAPSHOT_V3 SUPPORT_REDACTED → ChatGPT/support`

### KNOWLEDGE BRIDGE
`validated runtime/research result → compact knowledge object/case with TQS IDs + provenance → Google Drive`

This bridge must be selective: raw candles/ticks/log spam do not go to Drive.

### COCKPIT BRIDGE
`TQS Intelligence canonical API/snapshots → TQS Screener/Cockpit`

The Cockpit consumes results; it must not create a parallel definition of anomalies, instruments or research statistics.

### REMOTE ACCESS BRIDGE
`Windows TQS 127.0.0.1:8787 → Tailscale Serve private tailnet HTTPS → Mac/phone browser`

Properties:
- no router port-forwarding;
- no public TQS bind;
- no Tailscale Funnel configured by TQS;
- tailnet identity/ACLs are the outer access boundary;
- Remote Node status is observable through Launcher, `GET /api/node/remote` and the System cockpit;
- closing Launcher must not stop the server.

### AI OBSERVABILITY BRIDGE
`TQS /api/audit → hidden owner-session publisher → synced Google Drive → ChatGPT Drive connector`

Properties:
- outbound/sanitized only;
- no raw account database, token, cookie or Tailscale credential;
- current truth file is overwritten every two minutes;
- hourly checkpoints retain only seven days;
- if Drive is unavailable, TQS still writes a local audit and reports the bridge as stale/not connected;
- this bridge is observability, not a second market-data source.

### FUTURE CLOUD/SYNC BRIDGE
If a future cloud control/data plane is added, prefer authenticated outbound sync/publish rather than public exposure of the workstation. It is separate from today's private Tailscale Remote Access Bridge. Sync only the data needed for remote views/actions, with explicit freshness and provenance.

## 14. Failure-domain rule

Each bridge/module reports its own health. A green GitHub CI does not mean Windows is online; an online Launcher does not mean all market sources are fresh; a loaded web page does not mean research is running; a Drive document does not mean code was deployed.

The owner-facing system should eventually show one unified status assembled from these distinct truths rather than collapsing them into one green/red dot.

### TQS Operations Control / Resource Governor
The owner control plane is not limited to STOP/LIGHT/MAX. v0.13 adds live resource policy:
- 1..4 heavy research workers;
- history/metric planner batch sizes;
- live refresh override;
- CPU/RAM soft limits.

The System cockpit shows CPU/RAM/disk/network, TQS processes, worker states and active jobs. Resource policy changes are durable and apply without process restart.

### AI CONTROL BRIDGE
`ChatGPT GitHub write -> tqs-control/remote-command.json -> office TQS poll -> allow-listed action -> Runtime Audit -> Google Drive -> ChatGPT`

Allowed actions are deliberately narrow: policy updates, market refresh and safe update request. There is no arbitrary shell, arbitrary process kill or order placement. This gives remote AI operations while preserving the existing private Tailscale boundary for the actual TQS web/API server.
