# TQS DIAGNOSTICS / SUPPORT SNAPSHOT CONTRACT

Status: ACTIVE — 2026-09-17

Purpose: when something is slow, stale, restarting or broken, Artem should be able to press one button and give AI/support a compact package that answers **what ran, what failed, what state is preserved and what to inspect next**.

## 1. Two export levels

### SUPPORT snapshot — default
Safe-ish diagnostic package for sharing with ChatGPT/support.
Must contain enough operational evidence to diagnose TQS without raw private account payloads or secrets.

### FULL snapshot — explicit
Local/private reproducibility package. May contain database copy and detailed account/fill/position payloads. Treat as sensitive and do not upload to public GitHub.

## 2. Required identity

Every snapshot must identify the runtime it came from:
- platform: TQS;
- module: TQS Intelligence;
- semantic product version;
- Git branch and commit if available;
- runtime instance id;
- PID/start time;
- snapshot creation time;
- mode STOP/LIGHT/MAX.

Launcher, Web/API and snapshot should agree on version/identity. A mismatch is a diagnostic finding.

## 3. Required operational state

Support manifest includes:
- market collector state / last success / duration / cycle count;
- Research Runtime state / current action / queue / last error;
- account discovery/intelligence summary;
- source health and current instrument counts;
- Data Lake verification/coverage summary;
- storage/lab counters;
- current control configuration that is safe to expose;
- recent meaningful runtime errors/warnings;
- active/queued jobs with progress where available.

CPU/RAM is telemetry only and must not be used as proof of useful work.

## 4. Diagnostic assessment

Snapshot should produce a compact `diagnosis.json` with:
- `overall`: OK / DEGRADED / ERROR;
- alerts with component, evidence and severity;
- likely next checks/actions;
- whether visible market data may be stale;
- whether automated research/history is progressing, waiting or failing.

The diagnosis is deterministic heuristics. AI may interpret it further but must not overwrite the underlying evidence.

## 5. Data included by default

SUPPORT may include:
- manifest/identity;
- current market snapshot;
- episode/research/hypothesis/idea/job/strategy summaries;
- relationship summaries;
- runtime logs;
- redacted account intelligence aggregates;
- AI_READ_ME with evidence rules.

SUPPORT must not include by default:
- API keys, passphrases, tokens or env secrets;
- owner/private account credentials;
- full raw account IDs/fills/positions when they can identify private activity;
- arbitrary Drive file contents;
- raw `.env`;
- browser cookies/session tokens.

## 6. Redaction

When account identifiers are exported in SUPPORT, replace them with stable short fingerprints such as `hyperliquid:acct-12ab34cd`. Preserve aggregate statistics/signatures where useful.

FULL may include raw account details only after explicit request (`full=true`).

## 7. Incident workflow

Owner flow:
1. Launcher shows DEGRADED/OFFLINE or suspicious repeated restarts/stalls.
2. Do not repeatedly kill/restart on one missed health request.
3. Create SUPPORT snapshot.
4. AI reads `manifest.json`, `diagnosis.json`, latest logs and job/source state first.
5. AI identifies the first concrete failure/root hypothesis and checks Git/CI/current version.
6. Fix is implemented in GitHub and verified.
7. Owner updates through Launcher; new snapshot proves recovery if local evidence is needed.

## 8. Snapshot is evidence, not a backup strategy

A support snapshot is a diagnostic transport. Data Lake/database backups have their own retention policy. A snapshot can contain a full DB copy only in explicit FULL mode.

## 9. Compatibility

Snapshot format is versioned (`TQS_SNAPSHOT_V*`). New fields should be additive where possible. Breaking changes require a new format version and updated AI_READ_ME.

## 10. Acceptance

The feature is not complete unless a new chat, without terminal access, can inspect one SUPPORT snapshot and answer:
- which build/runtime produced it;
- whether the system was alive;
- what it was doing;
- what progressed recently;
- what failed;
- whether data are stale;
- which next technical check is justified.