#!/usr/bin/env bash
# macOS / Linux quick dev launcher (frontend only, no Prisma reset / no MOEX ingest).
# Mirrors run-dev.cmd for Windows. For full setup run ./run-dev-full.sh instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[ERROR] pnpm is not installed. Install with: npm install -g pnpm" >&2
  exit 1
fi

# Always clean up any previous dev server before starting a new one.
# Without this, killing pnpm leaves orphan next-server workers alive
# and starting another dev stacks them — fastest way to swap-thrash a 16 GB Mac.
"$SCRIPT_DIR/stop.sh" >/dev/null 2>&1 || true

# Cap Node heap (16 GB Mac: leave room for Cursor + macOS).
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"

# dev:stable = webpack instead of Turbopack — slower first compile, much less RAM.
# On M4 16 GB this avoids swap thrashing and kernel watchdog panics.
echo "[INFO] dev:stable (webpack, low RAM) — http://localhost:3000/screener"
exec pnpm -C frontend dev:stable
