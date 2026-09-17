# Verification contract — cost per VERIFIED PASS

The purpose of the harness is to move execution and checking from probabilistic LLM judgement into cheap deterministic machines.

## FAST

Run after every meaningful code commit. Target: quick feedback.

Checks only affected surfaces plus the harness itself:

- Python/shell harness syntax and required contract files;
- TQS: install, pytest, compileall, API/version/route contract, JavaScript syntax, key HTML contract, PowerShell updater parse where available;
- frontend: frozen dependency install, TypeScript, targeted ESLint for changed JS/TS/TSX files.

A failed FAST is not a blocker to investigate manually: read the failed step/log, repair root cause, commit, rerun.

## FULL

Runs only after FAST passes and before a change may be called verified.

For affected TQS:

- all FAST-level tests again in a clean job;
- isolated local runtime with live external providers disabled;
- `/api/health` readback;
- Playwright Chromium smoke against the real page;
- expected trader-facing text;
- screenshot + browser evidence JSON;
- unexpected browser console/page errors fail the gate.

For affected Next/frontend:

- frozen install;
- production build;
- local production server;
- Playwright browser smoke + screenshot/console evidence for the screener surface.

FULL artifacts are uploaded even on failure.

## SECURITY

Separate workflow, machine-run:

- dependency review on pull requests;
- CodeQL for Python and JavaScript/TypeScript;
- least-privilege workflow permissions;
- repository secrets must never be echoed or committed.

Security findings are evidence, not prose. A relevant blocking finding must be fixed or explicitly documented as an accepted owner/security decision before release.

## LIVE

External market/provider availability is intentionally separate from deterministic merge gates.

Scheduled/manual LIVE verification may access real providers and records a health snapshot. Temporary external-provider failure must not masquerade as a deterministic code regression.

## VERIFIED PASS

An agent may use the exact phrase `VERIFIED PASS` only when all relevant conditions hold for the same final SHA:

1. A GitHub commit exists on the intended branch/PR.
2. FAST is green.
3. FULL is green for affected runnable surfaces.
4. Browser evidence exists for user-facing UI changes when the surface can be exercised.
5. Relevant security checks have no new blocking finding.
6. DB/migration/readback/advisor evidence exists when DB state changed.
7. Deployment/runtime evidence exists when the task claims a deployed/runtime result.
8. The evidence references the tested SHA; no untested code was appended afterward.

LIVE provider health is reported separately unless the task's acceptance explicitly depends on a live external source.

## Machine-readable evidence

Every FAST/FULL/LIVE run writes `.verification/<stage>-summary.json` with SHA, branch, stage, status, changed files and produced evidence paths. GitHub Actions uploads `.verification/` as an artifact.

## Repair budget

- First meaningful failure: diagnose → repair → verify.
- Second failure with the same root cause: stop blind retries, reconsider assumptions/tooling.
- Escalate to Codex/Cursor/Work only if the unresolved step requires a capability ordinary Chat + connected tools + Actions do not provide.
