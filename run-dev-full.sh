#!/usr/bin/env bash
# macOS / Linux equivalent of run-dev-full.ps1.
# Steps: ensure frontend/.env, free port 3000, pnpm install,
# prisma generate + db push, MOEX ingest (with demo fallback), pnpm -C frontend dev.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf "[STEP] %s\n" "$*"; }
ok()   { printf "[OK]   %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*"; }
err()  { printf "[ERROR] %s\n" "$*" >&2; }

if ! command -v pnpm >/dev/null 2>&1; then
  err "pnpm is not installed. Install with: npm install -g pnpm"
  exit 1
fi

step "Checking frontend environment file"
if [[ ! -f frontend/.env ]]; then
  if [[ ! -f frontend/.env.example ]]; then
    err "frontend/.env.example was not found."
    exit 1
  fi
  cp frontend/.env.example frontend/.env
  ok "Created frontend/.env from .env.example"
else
  ok "frontend/.env already exists"
fi

step "Stopping stale processes on port 3000"
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:3000 || true)"
  if [[ -n "${PIDS}" ]]; then
    echo "  > kill -9 ${PIDS}"
    # shellcheck disable=SC2086
    kill -9 ${PIDS} || true
  fi
fi
ok "Port 3000 cleanup completed"

step "Installing dependencies"
echo "  > pnpm install"
pnpm install
ok "Dependencies installed"
warn "If you see ignored build scripts, run: pnpm approve-builds"

step "Generating Prisma client"
echo "  > pnpm -C frontend prisma:generate"
pnpm -C frontend prisma:generate
ok "Prisma client generated"

step "Applying Prisma schema"
echo "  > pnpm -C frontend prisma:push"
pnpm -C frontend prisma:push
ok "Prisma schema applied"

step "Running MOEX ingest"
if pnpm -C frontend ingest:moex; then
  ok "MOEX ingest completed"
else
  warn "MOEX ingest failed. Starting app with demo fallback mode."
fi

step "Starting frontend dev server"
echo "[INFO] Open http://localhost:3000/screener"
exec pnpm -C frontend dev
