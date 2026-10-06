# AI_SESSION_STATE — TQS / ScreenerPRO

## Active development method

Owner experiment active since 2026-10-05:
- ChatGPT = product architect / researcher / critic / independent verifier / Cursor-prompt compressor.
- Cursor = primary implementation executor inside this repository.
- Durable continuity = Google Drive canon + GitHub repo state + runtime evidence + repo-level `.cursor/rules` / `AGENTS.md`.
- Cursor User Rules / old chat history are not canonical memory.

See `AGENTS.md` and `.cursor/rules/artem-cursor-first.mdc`.

## Current TQS Studio mission

- Existing mission/version: **TQS Studio V6**. Do not create V7/new repo/new DB for the current outcome.
- Active branch: `chatgpt/tqs-studio-v6-productization-2026-10-04`.
- Last verified owner-facing code commit before Cursor-rule/docs updates: `880312abaca941c96163620159ffeac8a22010ff`.
- Canonical runtime URL: `https://tqs-studio.vercel.app/studio`.
- Verified Vercel deployment for that code: `dpl_8eEb7dFXNWL7WaadtHufwmDm4LB4`, READY.
- Current branch also contains docs/rules-only commits that do not change Studio runtime behavior; fresh-read exact HEAD before implementation.

## Product direction

Keep:
- one World + Documents product model;
- React Flow spatial World;
- nested Project -> Course -> Lesson workspaces;
- Documents as linear authored/publication surface;
- Supabase as canonical shared Studio state, local cache/outbox for resilience;
- stable block/object IDs and real browser/runtime acceptance.

Current owner priority:
- polish Documents navigation/library, explicit Edit vs Preview, coherent Share/Publish/PDF, cooler blue-neutral visual direction;
- preserve useful block editor mechanics;
- add/prepare first-class Interactive/Data blocks;
- make GPT a structured co-author through document/block APIs rather than a permanent wide sidebar.

Google Drive `08_CURRENT STATE — DECISIONS — LESSONS` is the owner/product canon for the latest accepted decisions.

## Cursor execution contract

Before editing:
1. read `AGENTS.md`, applicable `.cursor/rules`, `START_HERE_FOR_AI.md`, `TQS_PLATFORM.md`, this file;
2. verify exact branch/HEAD and dirty state;
3. inspect affected implementation/tests/runtime before choosing internals;
4. reuse existing architecture/components and mature maintained solutions.

After implementation:
1. run targeted tests/build and real browser/runtime checks for user-visible behavior;
2. self-repair real failures;
3. record exact branch/SHA + verification here;
4. update existing Google Drive CURRENT_STATE/LESSONS only with a verified Drive connector and readback;
5. if Drive is unavailable, emit `PERSISTENCE_PACKET` for ChatGPT to verify and sync.

## PERSISTENCE_PACKET fallback

```text
PERSISTENCE_PACKET
project:
repo:
branch:
exact_sha:
outcome:
implemented:
verified_evidence:
product_decisions:
known_defects_or_blockers:
positive_practice:
negative_practice:
next_action:
```

## Verification rule

Build success, self-report, click success, HTTP 200 or deployment READY alone are not product PASS. Require observable owner-facing acceptance and exact runtime/source identity.
