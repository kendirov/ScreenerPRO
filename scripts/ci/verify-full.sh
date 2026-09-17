#!/usr/bin/env bash
set -euo pipefail

mkdir -p .verification/full
if [[ ! -f .verification/scopes.env ]]; then
  python scripts/ci/changed_scopes.py
fi
# shellcheck disable=SC1091
source .verification/scopes.env

cleanup_pids=()
cleanup() {
  for pid in "${cleanup_pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

if [[ "$RUN_TQS" == "1" ]]; then
  mkdir -p .verification/full/tqs-runtime .verification/full/tqs-browser
  python -m pip install --disable-pip-version-check -e './tqs-intelligence[dev]' 'playwright==1.63.0'
  python -m pytest -q tqs-intelligence/tests | tee .verification/full/tqs-pytest.log
  python -m compileall -q tqs-intelligence/src
  python -m playwright install --with-deps chromium

  export TQS_DB_PATH="$PWD/.verification/full/tqs-runtime/tqs.duckdb"
  export TQS_LAB_DB_PATH="$PWD/.verification/full/tqs-runtime/tqs-lab.sqlite3"
  export TQS_ACCOUNTS_DB_PATH="$PWD/.verification/full/tqs-runtime/tqs-accounts.sqlite3"
  export TQS_CONTROL_PATH="$PWD/.verification/full/tqs-runtime/control.json"
  export TQS_DATA_LAKE_ROOT="$PWD/.verification/full/tqs-runtime/data-lake"
  export TQS_MODE=stop
  export TQS_ENABLE_BINANCE=false TQS_ENABLE_BITGET=false TQS_ENABLE_BYBIT=false TQS_ENABLE_OKX=false TQS_ENABLE_MOEX=false
  python -m uvicorn tqs_intelligence.api:app --host 127.0.0.1 --port 8765 > .verification/full/tqs-runtime.log 2>&1 &
  tqs_pid=$!
  cleanup_pids+=("$tqs_pid")
  python scripts/ci/wait_http.py http://127.0.0.1:8765/api/health --timeout 90
  curl --fail --silent --show-error http://127.0.0.1:8765/api/health > .verification/full/tqs-health.json
  python scripts/ci/browser_smoke.py http://127.0.0.1:8765/ \
    --expect 'TQS Intelligence' --expect 'ПУЛЬС МАШИНЫ' --expect 'Обновить продукт' \
    --screenshot .verification/full/tqs-browser/desktop.png
  python scripts/ci/browser_smoke.py http://127.0.0.1:8765/ \
    --expect 'TQS Intelligence' --expect 'Сейчас в игре' \
    --viewport-width 390 --viewport-height 844 \
    --screenshot .verification/full/tqs-browser/mobile.png
  python -m pip check | tee .verification/full/tqs-pip-check.txt
  kill "$tqs_pid" 2>/dev/null || true
fi

if [[ "$RUN_FRONTEND" == "1" ]]; then
  mkdir -p .verification/full/frontend-browser
  corepack enable
  corepack prepare pnpm@10.32.1 --activate
  pnpm install --frozen-lockfile
  pnpm -C frontend build | tee .verification/full/frontend-build.log
  python -m pip install --disable-pip-version-check 'playwright==1.63.0'
  python -m playwright install --with-deps chromium
  PORT=3000 pnpm -C frontend start > .verification/full/frontend-runtime.log 2>&1 &
  front_pid=$!
  cleanup_pids+=("$front_pid")
  python scripts/ci/wait_http.py http://127.0.0.1:3000/screener --timeout 90
  python scripts/ci/browser_smoke.py http://127.0.0.1:3000/screener \
    --screenshot .verification/full/frontend-browser/screener.png
  kill "$front_pid" 2>/dev/null || true
fi

echo 'FULL PASS' | tee .verification/full/result.txt
