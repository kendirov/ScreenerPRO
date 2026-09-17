# TQS MACHINE ACTIVITY CONTRACT

Purpose: make it impossible for the owner to wonder whether TQS is actually working, what it is doing, why resources are used, and what useful result is being produced.

## 1. Runtime truth

The UI must never infer "working" from CPU/RAM, an open browser tab, old logs, or previously loaded market data.

Canonical states:
- `OFFLINE` — backend/worker is not reachable; no new collection/research is happening.
- `STARTING` — process exists but health/initialization is not complete.
- `RUNNING` — heartbeat is fresh and at least one scheduled loop is active or waiting for its next due time.
- `PAUSED` — backend is healthy but work is intentionally paused/STOP.
- `DEGRADED` — backend is alive, but one or more required loops/sources are stale or failing.
- `ERROR` — backend/worker failed and cannot continue without repair.

A browser page showing the last snapshot while backend is OFFLINE must display a prominent stale/offline banner. Cached data is not live data.

## 2. One runtime identity

Launcher and Web must expose the same:
- semantic product version;
- local Git commit;
- runtime instance ID;
- backend PID/start time;
- mode STOP/LIGHT/MAX;
- last successful health timestamp.

If Launcher and Web disagree, status is `DEGRADED` until reconciled.

## 3. Every loop must be observable

Every autonomous loop/job should expose at minimum:
- stable `job/loop id` and human Russian name;
- purpose / owner value;
- state: queued/running/waiting/paused/success/error;
- started_at;
- last_heartbeat_at;
- last_success_at;
- next_due_at;
- progress current/total when total is knowable;
- items read / produced / persisted;
- current instrument/source/range when relevant;
- last error + retry state;
- resulting artifact or downstream destination.

Examples:
- `Рынок — Bitget/Binance/Bybit/OKX/MOEX`: refreshed 16 508 instruments, 5/5 sources, next cycle in 22s.
- `Аномалии`: evaluated 16 508 instruments, promoted 392 observations, opened 17 new episodes.
- `MOEX history BR`: 2021-01-01 → 2026-09-17, 63%, 1.24M candles stored.
- `Account Intelligence`: universe 45 389, hot-set 60, 87 open positions, +2 431 fills this cycle.
- `Strategy Machine`: 420 variants evaluated, 3 validation candidates, holdout pending.

## 4. Product funnel, not raw counters

Home should explain the transformation:

`market universe → observations → anomalies → In Play → episodes → research runs → strategy candidates/rejections`

Each count must have a stable definition. A large raw number without stage meaning is not useful.

## 5. "Что машина делает сейчас" must be literal

Never show generic `RUN`, `working`, `market cycles`, or CPU load as the main explanation.

Show the top 3-7 active/waiting processes in Russian with:
- action;
- object;
- progress;
- useful output;
- next step.

If queue is empty, say exactly what is still running automatically and what is not. Example:
`Research queue пустая — новые исследования сейчас не считаются. Live market collection and anomaly/episode tracking continue every 30s.`

## 6. Activity ledger

Persist a compact append-only activity ledger for meaningful events, not every HTTP request:
- collector cycle completed/failed;
- source became stale/recovered;
- anomaly episode opened/closed;
- backfill started/progress milestone/completed;
- research/strategy run started/completed/rejected;
- account discovery/sync completed;
- snapshot/export/update completed;
- runtime restart/error/recovery.

The UI should show latest events and allow filtering by market/research/accounts/system.

## 7. Night / session summary

TQS should be able to answer `что сделано за ночь / с запуска / за 24ч` from persisted counters:
- runtime duration and cycles;
- data downloaded/stored;
- coverage added;
- new/closed episodes;
- new In Play cases;
- account sync/fills/position changes;
- completed research runs;
- candidate/rejected/inconclusive strategies;
- errors/retries/recoveries;
- Data Lake growth.

## 8. Health semantics

`5/5 sources online` means only source health. It does not mean research is running.
`Research 0` means no queued/running research jobs.
`market cycles 13` means 13 completed cycles for the current runtime/session, not "13%" and not proof that a cycle is running now.
CPU/RAM are capacity telemetry, not progress metrics.

## 9. Acceptance for future changes

A machine/autonomy feature is incomplete until the owner can answer from Launcher/Web without terminal access:
1. Is it alive now?
2. What exactly is it doing now?
3. What useful output did the last cycle produce?
4. When will it run again?
5. Is it progressing or stuck?
6. Where is the result stored/shown?
7. What failed, if anything?

This contract is part of the owner-facing product, not optional diagnostics.