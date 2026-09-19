# TQS v0.12.0 — Runtime Audit, AI Bridge and silent Windows background work

Status: release candidate — 2026-09-18.

## Why this release exists

v0.11 proved the private browser path from the office Windows TQS node to the owner's Mac through Tailscale. v0.12 closes the next operational gap:

1. prove what the node is actually collecting instead of assuming it;
2. expose missing/partial data layers explicitly;
3. stop recurring Windows console flashes from background probes;
4. create a sanitized runtime bridge into Google Drive so a new ChatGPT conversation can inspect the live node without joining the private Tailscale network;
5. make the bridge repair itself after an already configured server updates.

## Runtime Audit

New endpoints:

- `GET /api/audit`
- `GET /api/audit/text`

The audit reports deterministic evidence for:
- runtime liveness and snapshot freshness;
- source health and quote counts by provider/market;
- MOEX stocks/futures live universe;
- MOEX price/turnover;
- best bid/ask, NUMTRADES and trading status;
- MOEX futures OI;
- historical candle Data Lake;
- derivative Metric Lake;
- FUTOI aggregate participant history;
- LCHI public participant/portfolio evidence;
- exact public LCHI trade history;
- Pulse public-profile evidence;
- Remote Node/Tailscale safety;
- AI -> Google Drive bridge freshness;
- Git auto-update state.

The audit also explicitly marks important layers that are *not* yet complete:
- full persistent MOEX L2/depth history;
- canonical tick-by-tick MOEX trade tape;
- complete corporate-event / Russian-news layer.

This prevents the product from ever saying "all possible data is collected" when it cannot prove that statement.

## Cockpit

System -> **Самопроверка TQS** now renders the audit table:
- OK / WARN / FAIL / MISSING / PARTIAL / NOT_CONFIGURED;
- exact evidence for every layer;
- snapshot freshness;
- quote count;
- recent warnings/errors.

The System identity card also reports the AI Bridge state.

## TQS AI Bridge

New script:

`ai-bridge-windows.ps1`

Purpose:
- fetch the sanitized `/api/audit` every 2 minutes;
- always keep a local copy under `data/ai-bridge/`;
- when Google Drive for desktop is mounted, auto-detect:

`Trading QS/08_АВТОМАТИЗАЦИЯ И ПРОДУКТ/03_TQS REMOTE NODE/RUNTIME — TQS AI BRIDGE`

- overwrite:
  - `TQS_LIVE_AUDIT.json`
  - `TQS_LIVE_AUDIT.txt`
- keep one compact hourly JSON checkpoint for 7 days.

The bridge contains counts, health, versions, errors and coverage status. It does **not** copy raw private account databases, Tailscale credentials or API secrets.

A connected ChatGPT session can then read the Google Drive runtime audit through the Drive connector even though ChatGPT itself cannot join the owner's private tailnet.

## AI Bridge autostart

Server setup schema is now v2.

`setup-server-windows.ps1` registers:
- `TQS Intelligence Server` — SYSTEM / Windows startup;
- `TQS AI Bridge` — owner user / Windows logon / hidden.

The setup stores the resolved interactive owner account in `data/server-node.json`.

For nodes already configured under v0.11, the v0.12 FastAPI child runs a best-effort **post-update contract repair** in the background. Because the child runs under the SYSTEM-owned Supervisor, it can re-run server setup with `-NoStart`, upgrade the local setup schema, register the user AI Bridge task and start it without restarting the live server.

## Windows console flash fix

Recurring background probes now use `CREATE_NO_WINDOW` on Windows for:
- Launcher Git checks;
- Remote Node Tailscale/schtasks probes;
- UpdateManager Git checks;
- Supervisor Git/pip/update subprocesses where applicable.

One-time UAC/Tailscale browser authorization during explicit server setup can still appear by design. Periodic health/update probes should no longer flash terminal windows.

## Update proof

The audit includes:
- current branch;
- local HEAD;
- known remote HEAD;
- behind/ahead;
- dirty worktree;
- latest update execution state.

The server-mode Supervisor still checks Git approximately every five minutes and uses the existing safe path:
`fetch -> ff-only merge -> install -> backend healthcheck -> success or rollback`.

The audit does not fake freshness: if the remote ref has not been fetched yet, it reports only the state actually known to the node.

## Owner workflow

Normal daily use remains:
- office Windows stays on;
- TQS server runs without Launcher;
- Mac opens the private Tailscale bookmark;
- owner can inspect System -> Самопроверка TQS;
- ChatGPT can inspect `TQS_LIVE_AUDIT.json` from Google Drive once the AI Bridge reports fresh/Drive ON.

## Runtime acceptance

v0.12 is not fully accepted until the real office node proves:
- no recurring terminal flashes for at least 15–30 minutes;
- `/api/audit` returns current evidence;
- System -> Самопроверка TQS renders;
- Remote Node reports AI Bridge task installed;
- AI Bridge reports `drive_connected=true`, `fresh=true`;
- `TQS_LIVE_AUDIT.json` appears in the Drive folder and updates automatically;
- ChatGPT can read that file through the Drive connector;
- a later Git change is picked up without the owner pressing Update.
