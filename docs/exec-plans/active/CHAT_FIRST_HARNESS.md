# Execution plan — Chat-first development harness

Status: active until final green evidence is recorded
Date: 2026-09-17

## Outcome

Make ordinary ChatGPT capable of taking a natural-language development request through GitHub changes and deterministic verification without defaulting to Work/Codex/Cursor.

## Scope

- root progressive-disclosure agent guidance;
- compact current state and verification contract;
- FAST/FULL execution scripts;
- Playwright runtime/browser evidence;
- machine-readable summaries/artifacts;
- SECURITY and LIVE workflows;
- legacy TQS CI converted to manual compatibility mode;
- no change to TQS market/research formulas or trading semantics.

## Acceptance

1. New Chat-first workflow runs from a branch/PR.
2. FAST executes TQS tests/compile/contracts for this change.
3. FULL starts isolated TQS runtime and validates it through Playwright.
4. Artifacts include JSON summaries and screenshot/evidence.
5. Security workflow is installed.
6. A PR targets the active TQS branch rather than stale `main`.
7. CURRENT_STATE is updated only after final evidence.

## Non-goals

- no production deployment;
- no merging PR #11;
- no rewrite of TQS product logic;
- no arbitrary workflow-dispatch shell endpoint.
