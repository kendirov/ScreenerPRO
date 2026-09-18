# START_HERE_FOR_AI — TQS PLATFORM

Status: ACTIVE FRONT DOOR — 2026-09-17

This repository is the current **TQS monorepo**. Its GitHub name `ScreenerPRO` is historical; do not infer that the whole system is only a screener or only MOEX.

## First principle

**TQS is one platform with several modules, not a collection of unrelated apps.**

Current conceptual modules:
- **TQS Intelligence** — local collection, Data Lake, features, anomalies/episodes, accounts, research and Strategy Machine;
- **TQS Launcher** — Windows control/update/health/log/diagnostic surface for the local engine plus one-click Remote Node setup;
- **TQS Remote Node** — office Windows as an always-on private server: boot autostart, Supervisor recovery, safe auto-update and Tailscale Serve access for Mac/phone;
- **TQS Screener / Cockpit** — trader-facing web/UI layer; existing ScreenerPRO frontend evolves into this role;
- **TQS Knowledge** — human-readable Google Drive knowledge + future structured index/graph;
- **TQS Research / Strategy Lab** — reproducible hypotheses, replay, validation and strategies;
- **TQS Briefing / Publishing** — briefings, streams, course/material outputs over the same canonical intelligence;
- **TQS Connectors / Data** — exchange/MOEX/news/account adapters and canonical storage.

Read `TQS_PLATFORM.md` for the full system map and boundaries.

## Minimal read order

Do not read the whole repository or Drive by default.

1. `TQS_PLATFORM.md` — what TQS is, modules, data flow and truth boundaries.
2. `AI_SESSION_STATE.md` — freshest verified state and exact next focus.
3. Current branch / PR / CI status.
4. The `AGENTS.md` belonging to the module you will change.
5. Only affected source/tests/contracts.
6. `PRODUCT_VISION.md` when a product/UX decision is involved.
7. Deep legacy references (`PROJECT_CONTEXT.md`, older docs) only when a concrete decision needs them.

For local engine work start at `tqs-intelligence/AGENTS.md`. For Windows server/autostart/remote-access/update work also read `tqs-intelligence/REMOTE_NODE.md`.

## Sources of truth

- **Google Drive** = product intent, owner decisions, market/author knowledge, cases, materials and reusable development lessons.
- **GitHub** = code, schemas, AGENTS/contracts, tests, PRs and CI.
- **Runtime/Data Lake/DB** = operational market/research state.
- **Heartbeat/process/API state** = whether the machine is alive now.
- **Primary external sources** = current provider facts.

A browser page, CPU usage, old log, cached snapshot or AI statement alone does not prove the system is running.

## Development mode

Default is **Chat-first**:

`ordinary ChatGPT → targeted context → GitHub change → deterministic CI/checks → repair → runtime/UI evidence → resumable checkpoint`

Work/Codex/Cursor are escalation tools only for a concrete capability gap such as a required local debugger/native toolchain/computer-use step that current Chat + GitHub Actions + connected tools cannot honestly execute or verify.

Do not hand the owner a prompt to another executor when the available tools can perform the task directly.

## Before changing anything

1. Translate Artem's natural-language request into one observable owner outcome.
2. Identify the existing TQS module that owns the capability.
3. Check freshest state; do not trust stale `CURRENT_STATE` text over Git/CI/runtime.
4. Reuse canonical upstream objects instead of recollecting/redefining data downstream.
5. Define acceptance and failure states.
6. Make a checkpoint-sized change.
7. Run the cheapest relevant verification.
8. Repair the root cause before expanding scope.

## Non-negotiable architecture rules

- Do not create another standalone screener/research app for a feature that belongs in TQS.
- TQS Screener/Cockpit consumes Intelligence/Knowledge contracts; it should not become a second data/research engine.
- New sources enter through adapters and explicit semantics/unit/provenance.
- Raw high-frequency data belongs in Data Lake, not Google Drive.
- Durable human knowledge belongs in Drive with provenance/stable IDs, not in chat history.
- AI reasons over compact state/events/results; deterministic code owns reproducible calculations.
- Negative research results are preserved.
- Never call an anomaly a BUY/SELL signal without strategy validation.
- UI work needs loading/empty/error/stale states and browser/screenshot proof before a final visual PASS.
- Local runtime work needs heartbeat, activity/progress, logs and diagnostic snapshot.
- Remote access must not expose TQS port 8787 to the public Internet. Current Remote Node uses loopback-only TQS + private Tailscale Serve; Launcher is not required to stay open after server setup.

## Privacy boundary

The GitHub repository is public. Never commit:
- API keys/secrets;
- private credentials or personal account payloads;
- private Drive content/IDs solely for convenience;
- raw private diagnostic snapshots.

Drive and local runtime can contain private material that must remain outside public GitHub.

## What to update after a substantial run

Keep GitHub state concise:
- final HEAD / PR;
- outcome: PASS / PARTIAL / FAIL;
- what changed for the owner;
- exact verification evidence;
- real blockers/limitations;
- exact next action.

Update durable contracts only when a reusable rule changed. Do not turn docs into a transcript of the chat.

## Owner trigger

These are sufficient commands:

`Нам нужен продукт: <цель>.`

or

`Продолжай TQS: <идея/проблема>.`

The AI must route the request to the correct module, load only the needed context, continue the existing platform, execute as far as current tools allow, verify the result and leave a recovery point.