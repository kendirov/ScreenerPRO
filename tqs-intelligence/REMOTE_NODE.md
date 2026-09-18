# TQS REMOTE NODE — Windows server + Mac cockpit

Status: v0.11.0 architecture contract — 2026-09-18.

## Goal

The office Windows workstation is the always-on **TQS Node**. It collects market data, maintains DuckDB/Data Lake, computes anomalies/research and auto-updates from the active Git branch.

The owner's MacBook or phone is only a **TQS Cockpit client**. It connects over a private Tailscale network and does not need market databases or a local TQS install.

Canonical path:

```
GitHub active branch
        |
        v
Office Windows TQS Node
  - Windows scheduled task at boot
  - TQS Supervisor
  - FastAPI 127.0.0.1:8787
  - collectors / MOEX / LCHI / Pulse
  - DuckDB + Parquet Data Lake
  - research / Strategy Machine
  - safe auto-update + rollback
        |
        | Tailscale Serve (private tailnet HTTPS)
        v
https://<office-node>.<tailnet>.ts.net
        |
        +--> Mac Safari / Chrome
        +--> phone browser
```

No TQS port is opened on the public Internet.

## One-time Windows setup

The owner should not use terminal commands manually.

In **TQS Launcher** press:

**Настроить сервер**

The launcher starts `setup-server-windows.ps1` elevated. Windows may show one UAC confirmation. If Tailscale has never been authenticated on the office PC, the script opens the one-time Tailscale login/HTTPS approval flow.

The setup script then:

1. verifies the TQS virtual environment and Git;
2. installs Tailscale with winget when possible;
3. enables Windows Tailscale unattended mode;
4. configures private Tailscale Serve:
   `https://<node>.<tailnet>.ts.net -> http://127.0.0.1:8787`;
5. forces TQS host binding to `127.0.0.1`;
6. creates `data/server-node.json`;
7. creates Windows scheduled task **TQS Intelligence Server** running as SYSTEM at Windows startup;
8. marks the public Git checkout safe for the service account;
9. enables TQS auto-update;
10. starts the task immediately;
11. writes the stable remote URL to `data/remote-access.txt`.

TQS deliberately does **not** configure Tailscale Funnel.

## One-time Mac setup

1. Install Tailscale on the Mac.
2. Sign in to the **same Tailscale account/tailnet** as the office Windows node.
3. Copy the URL from the Windows Launcher button **Скопировать адрес для Mac**.
4. Open it in Safari/Chrome and bookmark it.

After that the normal owner workflow is only:

**come home -> open bookmark -> TQS**

No RDP, terminal, port forwarding or VPN router configuration is required for normal TQS use.

## Autostart and sleep behavior

`setup-server-windows.ps1` creates the scheduled task:

`TQS Intelligence Server`

The task starts `server-start-windows.ps1`, which starts the TQS Supervisor without a visible terminal.

In server mode the Supervisor:
- does not open a browser on the office PC;
- keeps Windows from system sleep while TQS server mode is running;
- restarts the FastAPI child if it crashes;
- writes supervisor heartbeat state;
- respects `data/server-stop.flag` for an intentional owner stop.

The display may turn off; the machine itself must remain powered.

## Auto-update contract

The server does not depend on the graphical Launcher for updates.

In server mode:
- update check interval defaults to **300 seconds**;
- Git update remains fast-forward only;
- dirty working tree blocks auto-update;
- heavy research blocks a non-forced update;
- dependencies are refreshed after code update;
- new backend must pass healthcheck;
- failed releases roll back to the prior Git commit.

Remote/manual `POST /api/system/update` is routed through the persistent Supervisor instead of launching the external updater. This prevents a race with the Windows scheduled task.

The Launcher remains a local control/status surface, not a runtime dependency.

## Stop / start semantics

When server mode is installed:

**Остановить** in Launcher writes `data/server-stop.flag` before terminating TQS processes. If Task Scheduler retries the task, `server-start-windows.ps1` sees the marker and exits cleanly instead of resurrecting TQS.

**Запустить** removes the marker and first attempts to start the scheduled task. If Windows policy prevents a normal user from starting the SYSTEM task, Launcher falls back to starting Supervisor directly; the startup task remains installed for the next reboot.

## Remote status

API:

`GET /api/node/remote`

Important fields:
- `enabled`
- `ready`
- `remote_url`
- `tailscale_online`
- `serve_configured`
- `scheduled_task.installed`
- `stopped_by_owner`
- `update_check_seconds`
- `loopback_only`
- `public_exposure`

The **System** page in TQS shows the same remote-node/security state.

Launcher diagnostics include a **REMOTE NODE** section so another ChatGPT session can understand whether the server path itself is broken.

## Security invariants

1. TQS backend remains on `127.0.0.1:8787`.
2. TQS remote setup uses **Tailscale Serve**, not Funnel.
3. No router port forwarding is required.
4. No Tailscale auth keys or other secrets are stored in Git.
5. `server-node.json` may contain local executable paths and the private tailnet URL; it lives under local `data/` and is not Git truth.
6. Tailnet access control remains the outer authentication boundary. Only devices/users allowed by the owner's Tailscale tailnet should reach the TQS URL.
7. If `TQS_HOST` is changed away from loopback, remote-node status reports `loopback_only=false` and `ready=false`.

## Runtime truth vs Git truth

GitHub contains:
- server implementation;
- setup scripts;
- security contracts;
- tests;
- release history.

Local Windows contains:
- Tailscale node identity;
- remote URL;
- scheduled task runtime;
- Data Lake;
- operational DBs;
- server-node configuration;
- liveness.

Google Drive contains:
- owner-facing architecture/operations documentation;
- durable project decisions and handoff notes.

Do not copy Tailscale credentials or private runtime databases into public GitHub.

## Key files

- `src/tqs_intelligence/remote_node.py`
- `src/tqs_intelligence/supervisor.py`
- `src/tqs_intelligence/update_manager.py`
- `src/tqs_intelligence/launcher.py`
- `setup-server-windows.ps1`
- `server-start-windows.ps1`
- `.env.example`
- `tests/test_remote_node.py`

## Acceptance checklist

Server setup is proven only when all are true:

- Launcher shows **REMOTE ONLINE**.
- Launcher shows a stable `https://...ts.net` URL.
- `GET /api/node/remote` returns `ready=true`.
- `loopback_only=true`.
- scheduled task is installed.
- Tailscale is online and Serve points to port 8787.
- closing Launcher does not stop TQS.
- after Windows reboot, TQS returns without opening Launcher.
- the same TQS page opens from the Mac on the same tailnet.
- a new safe Git commit is picked up automatically or by remote **Обновить**.
- failed update still preserves the last healthy build.

## Current external dependency assumptions

Tailscale's current documented Windows behavior supports:
- `tailscale up --unattended=true` so the node stays connected without a logged-in desktop user;
- `tailscale serve --bg <target>` for persistent private sharing within the tailnet;
- HTTPS termination by the Tailscale daemon.

If Tailscale changes its CLI contract, update `setup-server-windows.ps1` and this document together.
