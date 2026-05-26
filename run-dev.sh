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

echo "[INFO] Open http://localhost:3000/screener"
exec pnpm -C frontend dev
