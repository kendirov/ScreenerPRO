#!/usr/bin/env bash
# Manual production deploy for ScreenerPRO (frontend app on Vercel).
# Requires: pnpm, vercel CLI, one-time `vercel login`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"

if ! command -v vercel >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "[ERROR] Install Vercel CLI: npm install -g vercel" >&2
  exit 1
fi

VERCEL_CMD=(vercel)
if ! command -v vercel >/dev/null 2>&1; then
  VERCEL_CMD=(npx --yes vercel)
fi

echo "[INFO] Checking Vercel auth..."
if ! "${VERCEL_CMD[@]}" whoami >/dev/null 2>&1; then
  echo "[INFO] Not logged in. Run: cd frontend && vercel login"
  echo "       Then re-run: ./scripts/vercel-deploy-prod.sh"
  exit 1
fi

echo "[INFO] Git: $(git -C "$ROOT" rev-parse --short HEAD) on $(git -C "$ROOT" branch --show-current)"
cd "$FRONTEND"

echo "[INFO] Deploying to production (project should be screenerpro, root=frontend)..."
"${VERCEL_CMD[@]}" deploy --prod --yes

echo ""
echo "[INFO] Verifying production API..."
sleep 5
curl -sS "https://screenerpro.vercel.app/api/screener/health" | head -c 500
echo ""
curl -sS "https://screenerpro.vercel.app/api/screener?assetClass=stock" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); s=d['status']; print('screener:', s.get('source'), 'isDemo=', s.get('isDemo'), 'rows=', s.get('stockRows'))"
