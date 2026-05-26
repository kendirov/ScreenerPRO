#!/usr/bin/env bash
# Kill any local ScreenerPRO dev process so the next ./run-dev*.sh starts clean.
# Why this exists: simply pressing Ctrl+C in a stuck terminal or running `kill <pnpm-pid>`
# leaves Next.js' `next-server` workers (one per core) running in the background.
# Two stacked dev servers fill macOS swap fast — this script kills all of them.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

killed=0

# 1. Anything listening on port 3000.
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:3000 2>/dev/null || true)"
  if [[ -n "${PIDS}" ]]; then
    # shellcheck disable=SC2086
    kill -9 ${PIDS} 2>/dev/null || true
    killed=1
  fi
fi

# 2. All next-server / next dev workers (Turbopack spawns ~N per CPU core).
if pgrep -f "next-server" >/dev/null 2>&1; then
  pkill -9 -f "next-server" 2>/dev/null || true
  killed=1
fi
if pgrep -f "next dev" >/dev/null 2>&1; then
  pkill -9 -f "next dev" 2>/dev/null || true
  killed=1
fi

# 3. The pnpm wrapper for the frontend dev script.
if pgrep -f "pnpm.*-C.*frontend.*dev" >/dev/null 2>&1; then
  pkill -9 -f "pnpm.*-C.*frontend.*dev" 2>/dev/null || true
  killed=1
fi

# 4. Anything spawned out of frontend/.next (e.g. orphan postcss workers).
if pgrep -f "${SCRIPT_DIR}/frontend/.next" >/dev/null 2>&1; then
  pkill -9 -f "${SCRIPT_DIR}/frontend/.next" 2>/dev/null || true
  killed=1
fi

sleep 1

if [[ $killed -eq 1 ]]; then
  echo "[stop] killed previous ScreenerPRO dev processes"
else
  echo "[stop] nothing to kill"
fi
