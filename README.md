# TQS / Trading QS

> `ScreenerPRO` is the historical GitHub repository name. This repository currently acts as the **TQS modular monorepo**.

TQS is an AI-first market operating system: market/data collection → states/anomalies/episodes → historical research/strategies → durable knowledge → trader-facing screener/cockpit → briefings/materials.

## Main modules

- **TQS Intelligence** — local collection, normalization, Data Lake, anomaly/episode engine, account intelligence, research and Strategy Machine (`tqs-intelligence/`).
- **TQS Launcher** — Windows operations/control for the local engine: run modes, version/update/rollback, health, logs and support snapshot.
- **TQS Screener / Cockpit** — trader-facing visual/action layer; the existing `frontend/` evolves into this role.
- **TQS Knowledge** — durable human-readable market/product knowledge in Google Drive, with structured indexing added only when useful.
- **TQS Research / Strategy Lab** — reproducible hypotheses, replay, controls, OOS/walk-forward/stability/cost analysis.
- **TQS Briefing / Publishing** — briefings, live-stream/course/material outputs over the same canonical intelligence and knowledge.
- **TQS Connectors / Data** — exchange/MOEX/news/account adapters and canonical local storage.

Full architecture: [`TQS_PLATFORM.md`](TQS_PLATFORM.md)  
Machine-readable map: [`TQS_MANIFEST.json`](TQS_MANIFEST.json)

## New AI / developer session

Read only what is needed, in this order:

1. [`START_HERE_FOR_AI.md`](START_HERE_FOR_AI.md)
2. [`TQS_PLATFORM.md`](TQS_PLATFORM.md)
3. [`AI_SESSION_STATE.md`](AI_SESSION_STATE.md)
4. current branch / PR / CI / runtime evidence
5. affected module `AGENTS.md` and source/tests

A sufficient owner request is:

`Продолжай TQS: <цель>.`

The default development route is **Chat-first**: connected ChatGPT + GitHub changes + deterministic CI/runtime/UI evidence. Work/Codex/Cursor are escalation paths for concrete capability gaps, not the default just because a task is large.

## Sources of truth

- **Google Drive** — product intent, owner decisions, observations, cases, human-readable knowledge/materials.
- **GitHub** — public-safe code, schemas/contracts, tests, PRs and CI.
- **Local Data Lake / DB** — market, history and research operational data.
- **Runtime heartbeat/process/API/job state** — whether the local machine is actually alive and working now.
- **Primary external providers** — current external facts.

These layers are connected by explicit contracts/IDs/exports; they are **not full mirrors of one another**.

## Current local runtime

The current primary compute/data node is a Windows workstation running TQS Launcher + TQS Intelligence + local Data Lake/research workers. ChatGPT, GitHub, Drive and Web are separate nodes/clients with different truth responsibilities.

See the Runtime Topology and Integration Bridges sections in `TQS_PLATFORM.md`.

## Diagnostics

Local runtime issues should be transferred through **TQS_SNAPSHOT_V3**:

- default `SUPPORT_REDACTED` — identity, health, sources, jobs, Data Lake, logs and deterministic diagnosis with account/secret redaction;
- explicit `FULL_PRIVATE` — may contain detailed account/database payloads and must remain private.

Contract: [`tqs-intelligence/TQS_DIAGNOSTICS_CONTRACT.md`](tqs-intelligence/TQS_DIAGNOSTICS_CONTRACT.md)

## Security boundary

This repository is public. Never commit API keys, tokens, credentials, private Drive content, private account payloads, `.env` secrets or raw `FULL_PRIVATE` diagnostic exports.

## Current implementation line

See PR **#11** and `AI_SESSION_STATE.md` for the freshest implementation/verification state. Do not infer current runtime health from README text; verify Git/CI and the actual local runtime.