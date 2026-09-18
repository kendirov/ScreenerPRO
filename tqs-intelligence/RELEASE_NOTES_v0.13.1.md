# TQS v0.13.1 — stability hotfix

Status: release candidate — 2026-09-18.

## Why this hotfix exists

The first real v0.13 office screenshot exposed two operational risks:

1. Windows memory pressure was ~89.5%, so the workstation felt heavily stalled even though TQS was in LIGHT.
2. The displayed Data disk free space changed from ~555 GB in earlier screenshots to ~22 GB after the update. That strongly suggests the durable Data Lake root may have fallen back from the intended data drive to the local `./data-lake` path on the system drive.
3. Immediately after the successful v0.13 update, Git reported a dirty working tree and blocked future auto-updates.

v0.13.1 is a containment/stability release before adding more data.

## Data Lake path safety

`control.json` is durable runtime truth.

The API now:
- applies environment defaults only on first control creation;
- never silently overwrites an existing owner/runtime policy on restart;
- if the durable Data Lake path is empty/default but `.env` explicitly points to a non-default data drive, repairs the path back to that configured location.

This specifically protects against a service-context startup falling back to `./data-lake` on C:.

`GET /api/resources` now reports:
- exact resolved Data Root;
- whether Data Root is inside the TQS Git checkout;
- an explicit warning when the Data Lake sits inside the repository.

## Dirty worktree safety

Local runtime/build artifacts must not block Git updates.

New ignore rules include:
- `data-lake/`
- `*.egg-info/`
- `*.dist-info/`
- `.hatch/`
- common local tool caches

UpdateManager now separates:
- real tracked/local edits — BLOCK update;
- known untracked generated artifacts — do not block update.

No tracked modification is automatically discarded.

Launcher diagnostics now show the exact dirty paths instead of only saying `DIRTY`.

## Current office-node containment

While diagnosing the real node, ChatGPT sent an allow-listed AI control command that requests:
- STOP
- 1 heavy worker
- minimal planning batches
- slow refresh override
- conservative CPU/RAM soft limits

The command is intentionally a temporary containment policy. It must be verified from Runtime Audit or the local Launcher before claiming it applied.

## Direct operations path

The preferred next step is to connect **Remote Desktop Commander** to the authorized office Windows machine. That gives ChatGPT an explicit user-authorized filesystem/terminal/process connection without exposing TQS publicly.

Once connected, inspect:
1. `git status --short`;
2. current `data/control.json`;
3. current `.env`;
4. exact Data Lake root and size;
5. top RAM/CPU processes;
6. TQS worker/process tree;
7. scheduled tasks;
8. AI Bridge task/logs.

Then repair the local node directly and prove v0.13.1 update/health.

## Acceptance

Do not resume MAX until:
- RAM pressure cause is identified;
- Data Lake root is confirmed correct;
- system drive has adequate free space;
- dirty paths are classified;
- working tree is clean or only safe generated artifacts remain;
- v0.13.1 is installed;
- `/api/resources` shows the correct Data Root;
- auto-update is unblocked.
