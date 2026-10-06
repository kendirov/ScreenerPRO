# AGENTS.md — TQS / ScreenerPRO

This repository is one technical surface of the broader **Trading QS (TQS)** platform.

## Front door

Read in this order:

1. `START_HERE_FOR_AI.md`
2. `TQS_PLATFORM.md`
3. `AI_SESSION_STATE.md`
4. only the affected module docs/files

If connected to Artem's private workspace, also restore the current Trading QS and development canon from Google Drive before making product-level decisions. Do not copy private Drive content, IDs, secrets, account payloads or raw diagnostics into this public repository.

## Routing

- This repo owns the TQS **Screener/Cockpit**, Academy/materials currently implemented here, and existing Strategy Lab surfaces.
- The repository name `ScreenerPRO` is historical. It is **not** a global default for unrelated development.
- Generic computer/device execution belongs to **Artem OS** in `kendirov/tqs-development-factory`; do not create or revive a second generic desktop-control stack here.
- A new TQS capability should extend an existing TQS module unless a real deployment/security/toolchain/scale boundary requires a separate service/repo.

## Execution

During the active owner experiment, ChatGPT is the product architect/researcher/critic/independent verifier and **Cursor is the primary implementation executor**. Cursor is not the product memory: durable truth remains in Google Drive + this repo + runtime evidence. If the owner explicitly supersedes the experiment, follow the newer canon.

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
