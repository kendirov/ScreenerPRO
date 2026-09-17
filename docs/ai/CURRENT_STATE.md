# CURRENT STATE — Chat-first development

Updated: 2026-09-17

## Active product line

- Repository: `kendirov/ScreenerPRO`
- Active TQS product PR: `#11` — `TQS Intelligence v0.5 — autonomous market, account and strategy research machine`
- Product branch: `codex/tqs-intelligence-engine-v0-1-2026-09-17`
- Product head at harness start: `1370dc3e1b523f2ad7a8457b44c78e6a29a9e5df`
- TQS package/runtime reports version `0.6.0`.

## Active development-system task

Build the Chat-first development harness on top of the current TQS head instead of stale `main`.

Harness branch: `chat/chat-first-development-harness-2026-09-17`

Acceptance:

- ordinary Chat is the default execution route in repo guidance;
- Work/Codex/Cursor are capability-gap escalation only;
- GitHub Actions provide FAST and FULL deterministic execution;
- UI/runtime verification can produce browser screenshot/JSON evidence;
- security checks are separate and machine-run;
- external/live-provider checks are separate from deterministic merge gates;
- evidence is machine-readable and tied to the tested SHA;
- old stale `AI_SESSION_STATE.md` becomes a compatibility pointer.

## Product context

For TQS product semantics use `tqs-intelligence/AGENTS.md` and its progressive-disclosure links. Do not reconstruct TQS from the old root `PROJECT_CONTEXT.md` unless a task specifically needs legacy ScreenerPRO context.

## Current verification status

`IN PROGRESS` — harness files are being installed. Do not claim VERIFIED PASS until the new branch's GitHub Actions evidence is green.

## Next action

Run the new Chat-first FAST/FULL/security gates on the harness PR, repair any failures, then update this file with the final verified SHA and evidence.
