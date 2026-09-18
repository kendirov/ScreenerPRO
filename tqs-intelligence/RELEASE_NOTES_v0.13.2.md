# TQS v0.13.2 — fast runtime truth and unattended stability

Status: release candidate — 2026-09-18.

## Why this release exists

The office node is now a real always-on machine with:
- TQS server + Supervisor;
- Tailscale private access;
- Google Drive Runtime Audit bridge;
- ChatGPT AI control;
- Remote Desktop Commander admin access.

The remaining operational problem was that the Runtime Audit could take longer than the AI Bridge timeout because it performed a full Parquet row-count verification across the historical Data Lake on every audit request. That is the wrong cost profile for a health packet that is requested every few minutes.

## Changes

### Fast Runtime Audit

Frequent runtime audit now uses file-level coverage:
- history Parquet file count;
- metric Parquet file count;
- metric names present;
- Data Lake free/total disk;
- current runtime/source/participant/update/control state.

It does not open every historical Parquet file merely to count rows.

Exact row verification still remains available through the existing full Data Lake verification code path when a deep diagnostic is explicitly needed.

Runtime Audit marks exact row counts as deferred when using quick stats and remains truthful about what is known.

### Lightweight resource evidence in AI audit

The AI audit now uses the lightweight health resource snapshot:
- total CPU;
- RAM;
- Data Lake free/total disk;
- TQS process memory;
- current resource policy;
- research throttle state.

The expensive full Windows process table remains available at `GET /api/resources` for the owner System dashboard, but it is no longer required for every Google Drive AI heartbeat.

### Expected effect

- `GET /api/audit` should complete comfortably inside the AI Bridge timeout.
- `TQS_LIVE_AUDIT.json` should update every ~2 minutes again.
- AI observability should not compete with live market collection or research by scanning the full historical lake.
- The Drive bridge can recover by itself after this version reaches the office node.

## Office node state before deployment

Confirmed directly through authorized Remote Desktop Commander:
- admin access: true;
- TQS v0.13.1;
- Git clean and local == remote;
- Data Root: `D:\TQS_DATA`;
- D: ~555 GB free;
- Tailscale server task running;
- AI control polling and applying bounded commands;
- Remote Desktop Commander online;
- RAM pressure is primarily system-wide (Chrome/Edge/Roblox/Discord/etc.), not only TQS;
- TQS remains under conservative policy while RAM is high.

## Acceptance

v0.13.2 is accepted when the real office node proves:
1. Git auto-update reaches v0.13.2 with clean working tree.
2. `GET /api/audit` completes in well under 30 seconds.
3. AI Bridge state shows `drive_connected=true` and a recent `last_drive_publish_ms`.
4. Google Drive `TQS_LIVE_AUDIT.json` updates automatically.
5. TQS can run in LIGHT with one heavy worker target and CPU/RAM governor active.
6. A fresh market snapshot appears without causing heavy research to start while RAM is above the soft limit.
