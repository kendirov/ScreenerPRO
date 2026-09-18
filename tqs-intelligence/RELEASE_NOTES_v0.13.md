# TQS v0.13.0 — Operations Control, Resource Governor and AI Control Bridge

Status: release candidate — 2026-09-18.

## Owner outcome

v0.13 turns TQS from "server is running" into an operator-controlled research machine.

The owner can now see:
- what is loading CPU/RAM/disk/network;
- which TQS processes are alive;
- how many research workers are active/idle/throttled;
- which exact research jobs are running;
- how often live market collection refreshes;
- which resource policy is currently applied.

The owner can change the heavy-work policy live without restarting TQS.

A future/current ChatGPT session also gets a narrow allow-listed command channel through GitHub, while runtime truth still comes back through the Google Drive AI Bridge.

## Update starvation fix

The screenshot that motivated this release showed:

`UPDATE: preflight`
`ОШИБКА ОБНОВЛЕНИЯ: идёт тяжёлая research-задача`

The old rule was safe but could starve updates forever because MAX autopilot can keep at least one heavy research job continuously running.

v0.13 changes the update contract:

`update requested -> MAX temporarily becomes LIGHT -> current heavy job reaches cooperative checkpoint and is re-queued -> update -> install -> healthcheck -> previous mode restored`

If a provider call does not reach a checkpoint within the timeout, Supervisor proceeds with backend restart. On startup, any durable job still marked `running` is recovered back to `queued`. Data Lake writes remain tmp+replace atomic.

This removes the "there is always a research job, therefore update never installs" failure mode.

## Resource governor

New live policy fields in `ControlState`:
- `heavy_workers` = 1..4
- `history_batch_size` = 1..16
- `metric_batch_size` = 1..8
- `refresh_seconds_override` = 0/AUTO..900
- `cpu_soft_limit_pct` = 50..99
- `ram_soft_limit_pct` = 50..99

These values are durable in `data/control.json` and reload without restarting the process.

### Heavy workers

ResearchRuntime now owns four worker slots. The current control policy decides how many are enabled.

Workers expose explicit states:
- RUNNING
- IDLE
- PAUSED
- STANDBY
- THROTTLED

Every running worker reports job id/kind/title.

### CPU/RAM governor

When system CPU or RAM is above the configured soft limit, TQS does not start additional heavy jobs.

Live market collection remains separate and continues unless the owner explicitly chooses STOP.

This is a soft governor, not a hard OS resource cap.

## Resource dashboard

New API:

`GET /api/resources`

System Cockpit now has **Ресурсы и управление** with:
- total CPU + per-core sampling;
- RAM/swap;
- Data Lake disk free space;
- disk read/write MB/s;
- network receive/send MB/s;
- TQS process list with PID/CPU/RAM/threads;
- active research workers/jobs;
- effective live refresh interval;
- current resource policy.

Live controls apply without restart.

Presets:
- **ТИХО** — LIGHT, 1 worker, slow live refresh, conservative CPU/RAM limits;
- **БАЛАНС** — MAX, 2 workers, normal planning and limits;
- **ТУРБО** — MAX, 4 workers, larger planning batches, faster live refresh, high resource limits.

The purpose is operational clarity, not maximum CPU usage by default.

## AI operational control bridge

New module:

`src/tqs_intelligence/ai_control.py`

Default command source:

`https://raw.githubusercontent.com/kendirov/ScreenerPRO/tqs-control/tqs-intelligence/control/remote-command.json`

The office node polls it approximately every 30 seconds.

Allowed actions only:
- `noop`
- `set_control`
- `refresh_market`
- `request_update`

Allowed `set_control` fields are exactly the resource/control policy above.

Every non-noop command:
- has a unique command id;
- has issued/expiry timestamps;
- expires within at most one hour;
- is replay-protected locally.

Results are exposed in `GET /api/ai-control` and in Runtime Audit, therefore the Google Drive AI Bridge returns the result to ChatGPT.

### Security boundary

This is deliberately not SSH/RDP and not a general remote shell.

The bridge cannot:
- execute arbitrary shell commands;
- kill arbitrary processes;
- read arbitrary filesystem paths;
- place trading orders;
- receive credentials/secrets through the command schema.

GitHub collaborators control the public command file; secrets must never be committed there.

This gives ChatGPT operational control over TQS policy without turning a public repository into remote-code execution.

## Similar-project research that informed v0.13

Patterns reviewed:
- Freqtrade: web/Telegram operator control and explicit operational commands;
- Hummingbot Dashboard: orchestration separated from bot instances;
- OpenBB: connect once / consume data from several surfaces;
- Qlib/RD-Agent: research automation should be a separate research layer, not mixed into live collection;
- recent open-source quant stacks commonly separate hot monitoring/control from Parquet/DuckDB research storage;
- community discussions continue to favor Parquet + DuckDB for local/cold research, while ClickHouse/QuestDB become attractive when persistent tick/L2 volume becomes large.

TQS keeps the current single-node architecture for now:
- DuckDB / SQLite for operational metadata;
- Parquet/Data Lake for historical research;
- local FastAPI Cockpit for live truth;
- no Kafka/Redis/ClickHouse complexity until tick/L2 volume actually requires it.

Future L2/tick ingestion can add a dedicated hot time-series store without replacing the existing cold Data Lake.

## Runtime Audit integration

The AI audit now also contains:
- full resource/process snapshot;
- governor state;
- current control policy;
- AI-control bridge status;
- last AI command/result.

Therefore a connected ChatGPT session can answer both:
1. "what is TQS doing right now?"
2. "what should be reduced/increased?"

and can apply allowed changes through the control mailbox after v0.13 is deployed.

## Acceptance

v0.13 is accepted only after the real node proves:
- the previously blocked update installs;
- mode returns to MAX after update when MAX was the prior mode;
- System -> Resources renders without JS/API errors;
- changing worker count changes actual worker states;
- CPU/RAM soft limit causes THROTTLED under artificial/high load and recovers automatically;
- AI control polls successfully;
- a `set_control` canary written by ChatGPT is applied by the office node;
- the Google Drive audit reports that exact command/result back;
- no generic shell/process-kill capability exists.
