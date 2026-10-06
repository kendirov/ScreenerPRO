# AGENTS.md — TQS / ScreenerPRO

This repository is one technical surface of the broader **Trading QS (TQS)** platform.

## Front door

Read in this order:

1. `START_HERE_FOR_AI.md`
2. `TQS_PLATFORM.md`
3. `AI_SESSION_STATE.md`
4. only the affected module docs/files

If connected to Artem's private workspace, restore memory from Google Drive before a product decision. Search for the document named `00_ПАМЯТЬ РАЗРАБОТКИ — ЛЮБОЙ КОМПЬЮТЕР` and read it first, including how the owner wants the work to look, what already worked, and what must not be repeated. It is the memory shared by MacBook, home Windows, and work Windows. Chat history is not memory.

When an owner task starts, replace «Сейчас делаем» in that Drive document with the live assignment and read it back. Wins go to «Получилось». Dead ends go to «Не повторять». Standing taste goes to «Как хочет владелец». Do this without waiting for a separate reminder. Do not copy private Drive content, IDs, secrets, account payloads, or raw diagnostics into this public repository.

## Routing

- This repo owns the TQS **Screener/Cockpit**, Academy/materials currently implemented here, and existing Strategy Lab surfaces.
- The repository name `ScreenerPRO` is historical. It is **not** a global default for unrelated development.
- Generic computer/device execution belongs to **Artem OS** in `kendirov/tqs-development-factory`; do not create or revive a second generic desktop-control stack here.
- A new TQS capability should extend an existing TQS module unless a real deployment/security/toolchain/scale boundary requires a separate service/repo.

## Execution

During the active owner experiment, ChatGPT is the product architect/researcher/critic/independent verifier and **Cursor is the primary implementation executor**. Cursor is not the product memory: durable truth remains in Google Drive + this repo + runtime evidence. If the owner explicitly supersedes the experiment, follow the newer canon.

The chat that is already open is the executor when its machine can change the repo and show the result. Do not send the owner to another computer, another chat, or another agent while this one can finish the outcome.

One chat owns one owner outcome. Keep going inside that chat until the outcome is verified. A new chat resumes from Drive, git, and the live site.

## Studio

Owner site: https://tqs-studio.vercel.app. Route: `/studio`.

Before changing the board or handout, read the Drive document `28_STUDIO LIVE — читать перед работой` and the live page it names. Do not start a new Studio board or a new engine version while the current one can be improved.

Before code changes:
- confirm current HEAD/branch and `AI_SESSION_STATE.md`;
- resolve the owning TQS module;
- reuse existing code paths;
- define observable acceptance.

After changes:
- run targeted tests/build;
- verify the actual runtime/UI when user-visible behavior changed;
- update `AI_SESSION_STATE.md` only with compact durable current state;
- do not call a component PASS if the owner-facing flow is still partial.

## Baseline gate

At minimum keep:
```
pnpm -C frontend build
```

Use narrower verification scripts relevant to the changed module before the full build.


## Cursor-first handoff

Before implementation:
- read applicable `.cursor/rules/*.mdc` in addition to this file;
- recover exact branch/HEAD and current technical state;
- inspect affected implementation/tests before choosing internals;
- treat ChatGPT prompts as outcome/constraints/acceptance plus advisory options, not brittle micro-specs;
- prefer existing architecture/components and mature maintained libraries.

After a substantial run:
- record exact branch/SHA and objective verification in `AI_SESSION_STATE.md` or the current repo state surface;
- if a verified Google Drive MCP connection exists, update the existing relevant CURRENT_STATE/DECISIONS/LESSONS and read it back;
- otherwise emit a compact `PERSISTENCE_PACKET` for ChatGPT to verify against GitHub/runtime and sync to Drive;
- never claim persistence or product PASS from self-report/build/deploy READY alone.


## Studio owner-rejection hard gate — 2026-10-06

The current Portal Rooms / Interactive Documents implementation has been explicitly rejected by the owner as far below the required product quality. It is a technical checkpoint, not a visual baseline to defend.

Before any Studio work, restore the current private Studio canon and read the latest Product Contract / Execution rules, especially the active owner-rejection quality-reset and owner-review hard-gate sections. Do not ask the owner to restate the same product goals and do not require a new hand-written prompt for each iteration.

Studio priorities are now ordered:
1. **P0 canonical persistence** — production shared World/Documents must read/write from the real canonical store. `/api/studio/live` 404, blob 403, local-only truth or visible `Не записалось` are automatic FAIL.
2. **Reference-first visual system** — Board and Documents major visual work must be implemented against explicit reference screens grounded in the accepted Trading Workspace design language, not another prose-only interpretation.
3. **Coherent system implementation** — one design-token/component system for Board, Portal Rooms, Navigator/Search/Add/tools, Documents Editor/Handout and light/dark states.
4. **Independent audit before owner** — fix meaningful self-fixable P0/P1 defects before any `OWNER REVIEW REQUIRED` handoff.

Do not send the owner an `OWNER REVIEW REQUIRED` checkpoint while canonical persistence is broken, the result is localhost-only, visual target comparison has not been done, or major UX/visual defects remain. Build green, tests green, deployment READY and developer screenshots are necessary evidence but never sufficient acceptance.

The visual layer may be substantially rewritten inside the existing Studio/repo if needed. Preserve proven semantic architecture and data contracts (One World, Rooms, Documents, stable IDs, AI context, history, structured voice/annotations) where they are sound; do not preserve weak presentation merely because it already exists.
