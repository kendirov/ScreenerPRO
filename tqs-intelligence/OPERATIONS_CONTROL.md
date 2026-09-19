# TQS OPERATIONS CONTROL

Canonical operational contract for v0.13+.

## Goal

The office Windows node must be observable and controllable without:
- opening port 8787 publicly;
- relying on Launcher staying open;
- exposing a remote shell;
- letting heavy research starve updates;
- guessing which component is consuming resources.

## Control planes

### 1. Owner browser control

Private path:

`Mac/phone -> Tailscale Serve -> TQS Cockpit -> /api/control + /api/resources`

Use System -> **Ресурсы и управление**.

### 2. ChatGPT operational control

Outbound polling path:

`ChatGPT GitHub write -> branch tqs-control / remote-command.json -> office TQS polls -> allow-listed action -> Runtime Audit -> Google Drive -> ChatGPT verifies`

This is the supported AI control loop. It is not SSH/RDP.

## Resource policy

Durable in `data/control.json`.

Fields:
- `mode`: stop | light | max
- `heavy_workers`: 1..4
- `history_batch_size`: 1..16
- `metric_batch_size`: 1..8
- `refresh_seconds_override`: 0 means AUTO, otherwise 15..900 effective bounds
- `cpu_soft_limit_pct`: 50..99
- `ram_soft_limit_pct`: 50..99
- `auto_update`

Heavy research workers observe policy live. No restart is required.

## Presets

### ТИХО
- LIGHT
- 1 heavy worker target
- history batch 1
- metric batch 1
- live refresh override 120s
- CPU soft 70%
- RAM soft 85%

### БАЛАНС
- MAX
- 2 workers
- history batch 4
- metric batch 2
- refresh 60s
- CPU soft 85%
- RAM soft 92%

### ТУРБО
- MAX
- 4 workers
- history batch 8
- metric batch 4
- refresh 30s
- CPU soft 95%
- RAM soft 96%

Presets are owner conveniences, not research-quality settings.

## Worker semantics

ResearchRuntime owns 4 worker slots.

State meanings:
- RUNNING: executing a durable research job;
- IDLE: enabled, queue empty;
- STANDBY: slot exists but current `heavy_workers` is lower;
- PAUSED: mode is LIGHT/STOP;
- THROTTLED: CPU/RAM soft governor is preventing a new heavy job.

Active job metadata must show worker id, job id, kind, title and start time.

## Update quiesce

A safe update must not wait forever for MAX autopilot.

Contract:
1. detect update;
2. if heavy research is active, remember current mode;
3. when current mode is MAX, set LIGHT;
4. cooperative job progress callbacks raise `ResearchPaused`;
5. job returns to `queued`;
6. wait for running_jobs to reach zero up to bounded timeout;
7. update/install/healthcheck;
8. restore previous mode;
9. if new version fails, rollback then restore previous mode.

If a stuck provider call misses the checkpoint timeout, backend restart recovers durable `running` jobs to `queued`.

## Process telemetry

`GET /api/resources` exposes:
- CPU total and per-core;
- RAM/swap;
- disk free and IO rates;
- network IO rates;
- TQS processes;
- top Windows processes;
- worker states;
- active jobs;
- resource policy/effective values;
- supervisor heartbeat.

It deliberately does not provide arbitrary process termination.

## AI command schema

Source branch: `tqs-control`

File: `tqs-intelligence/control/remote-command.json`

Allowed actions:
- `noop`
- `set_control`
- `refresh_market`
- `request_update`

Non-noop command:
```json
{
  "schema_version": 1,
  "command_id": "unique-id",
  "issued_at_ms": 0,
  "expires_at_ms": 0,
  "requested_by": "chatgpt",
  "action": "set_control",
  "params": {
    "heavy_workers": 2
  }
}
```

Rules:
- TTL <= 1 hour;
- command id is replay-protected;
- unsupported actions/keys are rejected;
- never store secrets in this public file.

## Security boundary

The AI bridge must never grow into generic remote code execution.

Forbidden in this mailbox:
- shell / PowerShell / cmd execution;
- arbitrary process kill;
- arbitrary filesystem reads/writes;
- browser automation;
- credential manipulation;
- trading order placement.

If one of these capabilities becomes necessary later, build a separately authenticated, audited capability with an explicit permission model.

## Storage direction

Current architecture intentionally stays single-node:
- operational metadata: DuckDB/SQLite;
- historical cold path: Parquet Data Lake + DuckDB-style analytics;
- live browser/control: FastAPI;
- private network: Tailscale.

Reviewed project/community patterns support keeping Parquet/DuckDB for local research and adding a dedicated tick/L2 store such as ClickHouse/QuestDB only when persistent tick/depth volume makes it operationally justified.

Do not add Kafka/Redis/ClickHouse merely because larger projects use them. Add them when the measured workload requires them.

## AI handoff rule

Before changing resource policy:
1. read fresh `TQS_LIVE_AUDIT.json`;
2. inspect resources, active jobs, source health and update state;
3. write one bounded command with unique id;
4. wait for a newer audit;
5. verify the exact command id and result;
6. only then send another command.

This prevents blind control loops.
