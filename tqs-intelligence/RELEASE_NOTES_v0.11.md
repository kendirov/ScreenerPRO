# TQS v0.11.0 — Remote Node / always-on office server

Status: release candidate.

## Owner outcome

The office Windows workstation can now become the always-on **TQS Node** while the owner's MacBook/phone becomes a thin private Cockpit client.

Normal workflow after one-time setup:

`office PC boots -> TQS starts itself -> Supervisor keeps it alive -> GitHub updates are applied safely -> Tailscale Serve exposes a private HTTPS URL -> owner opens one bookmark on Mac`

The graphical Launcher is no longer required to stay open for server operation.

## One-click server setup

TQS Launcher adds a **TQS SERVER / УДАЛЁННЫЙ ДОСТУП** panel with:

- **Настроить сервер**
- **Скопировать адрес для Mac**
- **Открыть remote**
- REMOTE ONLINE / configured / stopped state
- stable private URL
- autostart state
- Tailscale state
- auto-update interval

The first setup may require:
- one Windows UAC confirmation;
- one Tailscale sign-in/HTTPS approval.

After that the owner does not need normal terminal/RDP/port-forwarding work.

## Windows boot autostart

`setup-server-windows.ps1` registers:

**TQS Intelligence Server**

as a Windows Scheduled Task:
- trigger: Windows startup;
- identity: SYSTEM;
- run level: highest;
- restart on failure;
- no execution time limit;
- hidden PowerShell entrypoint.

The task runs `server-start-windows.ps1`, which restores Tailscale Serve and launches the TQS Supervisor.

## Private Mac access

Remote path:

`Windows TQS 127.0.0.1:8787 -> Tailscale Serve HTTPS -> Mac/phone on the same tailnet`

Security invariants:
- TQS itself stays bound to loopback;
- no router port is opened;
- TQS does not configure Tailscale Funnel;
- remote-node readiness becomes false if TQS is bound to a non-loopback address;
- Tailscale/tailnet identity is the outer access boundary.

## Server-mode Supervisor

The Supervisor now understands persistent server mode:
- keeps the Windows machine awake while server mode is running;
- does not open an office browser on boot;
- keeps its existing child recovery/heartbeat behavior;
- checks safe Git updates every five minutes by default;
- writes server-mode information into heartbeat state;
- respects an explicit owner stop marker.

## Auto-update without Launcher

In server mode, `POST /api/system/update` and scheduled auto-update requests stay inside the persistent Supervisor.

This avoids a race where the legacy detached Windows updater could terminate a Supervisor that Windows Task Scheduler immediately tries to resurrect.

The safety contract is unchanged:
- fast-forward only;
- dirty worktree blocks update;
- heavy research can defer a non-forced update;
- dependencies refresh after code update;
- new backend must pass healthcheck;
- failed version rolls back to prior Git commit.

## Intentional stop semantics

When server mode is installed, Launcher **Остановить** first writes:

`data/server-stop.flag`

Then it stops TQS processes.

If Task Scheduler retries the task, `server-start-windows.ps1` sees this marker and exits cleanly rather than resurrecting a server the owner deliberately stopped.

Launcher **Запустить** removes the marker and prefers starting the scheduled task again.

## New runtime observability

New API:

`GET /api/node/remote`

It reports:
- server enabled/ready;
- private URL;
- Tailscale online state;
- Serve configuration;
- scheduled task installed state;
- intentional-stop state;
- update interval;
- bind host;
- loopback-only safety;
- public exposure flag.

The TQS **System** cockpit also shows Remote Node and security state.

Launcher's **Скопировать для ChatGPT** diagnostics now includes the Remote Node block, so another chat can diagnose the server path without reconstructing setup history.

## New/changed files

New:
- `src/tqs_intelligence/remote_node.py`
- `setup-server-windows.ps1`
- `server-start-windows.ps1`
- `tests/test_remote_node.py`
- `REMOTE_NODE.md`

Changed:
- `supervisor.py`
- `update_manager.py`
- `launcher.py`
- `api.py`
- `static/cockpit.js`
- `.env.example`
- platform/AI handoff contracts
- CI version/contracts

## One-time Mac action

The Mac still needs one user-owned trust step that GitHub cannot perform remotely:
1. install Tailscale;
2. sign in to the same tailnet as the office Windows node;
3. open/bookmark the stable URL copied from Launcher.

After that normal TQS usage from home is browser-only.

## Acceptance

Do not call v0.11 fully runtime-proven until:
- office Launcher shows REMOTE ONLINE;
- `/api/node/remote` reports `ready=true`;
- TQS opens from Mac through the private URL;
- Launcher can be closed while server keeps running;
- Windows reboot restores TQS without manually opening Launcher;
- an integration-branch update is applied by Supervisor and survives healthcheck;
- no public bind/port-forward/Funnel exists.

GitHub CI proves code/PowerShell/API contracts but cannot prove the office Tailscale identity or Windows scheduled task until the one-time setup runs on the real node.
