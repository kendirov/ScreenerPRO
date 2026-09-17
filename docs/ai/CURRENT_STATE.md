# CURRENT STATE — Chat-first development

Updated: 2026-09-17

## Active product line

- Repository: `kendirov/ScreenerPRO`
- Active TQS product PR: `#11` — `TQS Intelligence v0.5 — autonomous market, account and strategy research machine`
- Product branch: `codex/tqs-intelligence-engine-v0-1-2026-09-17`
- Product head incorporated by this harness merge: `0a1870aa07dbdd4ca145b904b360d0c3db936dc4`
- Current TQS package version at that head: `0.8.0`.

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

The harness merge incorporates the current TQS head instead of leaving branch drift for the owner to resolve. New product work on the base — including launcher/runtime changes and the latest anomaly-noise tests — stays in the tree. Harness FAST/FULL run the full TQS test suite, so current product tests are part of the verification target.

## Automatic-first continuity

For TQS, `tqs-intelligence/AGENTS.md` remains the product contract:

- discover/derive automatically before asking for manual owner input;
- GPT/chat is the primary product-development input; manual controls are escape hatches;
- primary screens explain what is happening, why it is shown and what the machine does next;
- preserve research, provenance and evidence boundaries.

## Current verification status

`IN PROGRESS` — the previous PR head's FAST verification logic passed its tests/contracts, but the job failed only when `upload-artifact` excluded the hidden `.verification/` directory. The rebuilt workflow explicitly uploads hidden evidence files and removes duplicate push+PR runs. Do not claim `VERIFIED PASS` until the final PR head has green FAST/FULL and relevant security evidence.

## Next action

Run the rebuilt PR checks, inspect the first meaningful failure if any, repair the root cause, and repeat until the final PR head satisfies `docs/ai/VERIFICATION.md`.
