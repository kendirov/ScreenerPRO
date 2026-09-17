#!/usr/bin/env bash
set -euo pipefail

mkdir -p .verification/fast/runtime
if [[ ! -f .verification/scopes.env ]]; then
  python scripts/ci/changed_scopes.py
fi
# shellcheck disable=SC1091
source .verification/scopes.env

python -m compileall -q scripts/ci
bash -n scripts/ci/verify-fast.sh scripts/ci/verify-full.sh scripts/ci/verify-live.sh
for required in AGENTS.md START_HERE_FOR_AI.md docs/ai/CURRENT_STATE.md docs/ai/VERIFICATION.md; do
  test -s "$required"
done

if [[ "$RUN_TQS" == "1" ]]; then
  python -m pip install --disable-pip-version-check -e './tqs-intelligence[dev]'
  python -m pytest -q tqs-intelligence/tests | tee .verification/fast/tqs-pytest.log
  python -m compileall -q tqs-intelligence/src

  TQS_DB_PATH="$PWD/.verification/fast/runtime/tqs.duckdb" \
  TQS_LAB_DB_PATH="$PWD/.verification/fast/runtime/tqs-lab.sqlite3" \
  TQS_ACCOUNTS_DB_PATH="$PWD/.verification/fast/runtime/tqs-accounts.sqlite3" \
  TQS_CONTROL_PATH="$PWD/.verification/fast/runtime/control.json" \
  TQS_DATA_LAKE_ROOT="$PWD/.verification/fast/runtime/data-lake" \
  TQS_MODE=stop TQS_ENABLE_BINANCE=false TQS_ENABLE_BITGET=false TQS_ENABLE_BYBIT=false TQS_ENABLE_OKX=false TQS_ENABLE_MOEX=false \
  python - <<'PY'
from importlib.metadata import version
from tqs_intelligence.api import app
assert version('tqs-intelligence') == app.version, (version('tqs-intelligence'), app.version)
paths = {route.path for route in app.routes}
required = {'/api/health', '/api/instrument/{canonical_id:path}', '/api/overview', '/api/anomalies', '/api/strategies', '/api/research/findings', '/api/briefing'}
missing = required - paths
assert not missing, missing
print('TQS API contract PASS', app.version)
PY

  node --check tqs-intelligence/src/tqs_intelligence/static/app.js
  node --check tqs-intelligence/src/tqs_intelligence/static/account-intelligence.js
  grep -q 'UNIVERSAL INSTRUMENT LAB' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'ПУЛЬС МАШИНЫ' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'Обновить продукт' tqs-intelligence/src/tqs_intelligence/static/index.html
  if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -Command '$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "tqs-intelligence/update-windows.ps1"),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count -gt 0){$errors|ForEach-Object{Write-Error $_.Message};exit 1}'
  fi
fi

if [[ "$RUN_FRONTEND" == "1" ]]; then
  corepack enable
  corepack prepare pnpm@10.32.1 --activate
  pnpm install --frozen-lockfile
  pnpm -C frontend exec tsc --noEmit
  mapfile -t changed_frontend < <(grep '^frontend/.*\.[cm]\?[jt]sx\?$' .verification/changed-files.txt || true)
  if (( ${#changed_frontend[@]} > 0 )); then
    (cd frontend && pnpm exec eslint "${changed_frontend[@]/#frontend\//}")
  fi
fi

echo 'FAST PASS' | tee .verification/fast/result.txt
