# CURRENT STATE — Chat-first development

Updated: 2026-09-17

## Active product line

- Repository: `kendirov/ScreenerPRO`
- Active TQS product PR: `#11` — `TQS Intelligence v0.5 — autonomous market, account and strategy research machine`
- Product branch: `codex/tqs-intelligence-engine-v0-1-2026-09-17`
- Product head incorporated by this harness merge: `fd66ae0f6095004b865b65683b5a0350b3cd026a`
- Current TQS package version at that head: `0.8.1`.

## Active development-system task

PR `#14`, branch `chat/chat-first-development-harness-2026-09-17`, installs the Chat-first development harness on the live TQS line.

Acceptance:

- ordinary Chat is the default execution route;
- Work/Codex/Cursor are capability-gap escalation only;
- GitHub Actions provide FAST and FULL deterministic execution plus browser evidence;
- security checks are separate and machine-run;
- external/live-provider checks are separate from deterministic merge gates;
- evidence is machine-readable and tied to the tested SHA;
- old append-only `AI_SESSION_STATE.md` is a compatibility pointer;
- newest TQS automatic-first product rules remain authoritative.

## Drift incorporated

The harness merge incorporates the current TQS head instead of leaving branch drift for the owner to resolve. New launcher-entry/runtime/product/research changes remain in the tree. Harness FAST/FULL run the full TQS test suite and current product contracts, so current product tests are part of the verification target.

## Automatic-first continuity

For TQS, `tqs-intelligence/AGENTS.md` remains the product contract:

- discover/derive automatically before asking for manual owner input;
- GPT/chat is the primary product-development input; manual controls are escape hatches;
- primary screens explain what is happening, why it is shown and what the machine does next;
- preserve research, provenance and evidence boundaries.

## Current verification status

`IN PROGRESS` — hidden evidence uploads are fixed, dependency review now degrades gracefully when GitHub Dependency Graph is unavailable, and FAST mirrors the current product branch's launcher/API contracts instead of inventing a stricter version-equality gate that the base branch itself does not enforce. The base currently has package metadata `0.8.1` while `app.version` reports `0.6.0`; that pre-existing metadata mismatch is recorded but is not introduced by this harness. Do not claim final verification until the final PR head has green FAST/FULL and relevant security evidence.

## Next action

Run the rebuilt PR checks, inspect the first meaningful failure if any, repair the root cause, and repeat until the final PR head satisfies `docs/ai/VERIFICATION.md`.
