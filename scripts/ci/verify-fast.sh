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

  if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -Command '$files=@("tqs-intelligence/update-windows.ps1","tqs-intelligence/install-windows.ps1","tqs-intelligence/start-windows.ps1");foreach($file in $files){$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count -gt 0){$errors|ForEach-Object{Write-Error "$file : $($_.Message)"};exit 1}};Write-Host "PowerShell scripts syntax PASS"'
  fi

  python -m py_compile tqs-intelligence/src/tqs_intelligence/launcher.py tqs-intelligence/src/tqs_intelligence/launcher_entry.py
  grep -q 'TQS Launcher' tqs-intelligence/TQS-Launcher.cmd
  grep -q 'launcher_entry' tqs-intelligence/TQS-Launcher.cmd
  grep -q 'TQS-Launcher.cmd' tqs-intelligence/start-windows.cmd
  grep -q 'launcher_entry:main' tqs-intelligence/pyproject.toml
  grep -q 'LOCAL BUILD' tqs-intelligence/src/tqs_intelligence/launcher.py
  grep -q 'REMOTE BUILD' tqs-intelligence/src/tqs_intelligence/launcher.py
  grep -q 'АКТУАЛЬНАЯ ВЕРСИЯ' tqs-intelligence/src/tqs_intelligence/launcher.py
  grep -q 'SetThreadExecutionState' tqs-intelligence/src/tqs_intelligence/launcher_entry.py
  grep -q 'Backend OFFLINE — запускаю автоматически' tqs-intelligence/src/tqs_intelligence/launcher_entry.py

  TQS_DB_PATH="$PWD/.verification/fast/runtime/tqs.duckdb" \
  TQS_LAB_DB_PATH="$PWD/.verification/fast/runtime/tqs-lab.sqlite3" \
  TQS_ACCOUNTS_DB_PATH="$PWD/.verification/fast/runtime/tqs-accounts.sqlite3" \
  TQS_CONTROL_PATH="$PWD/.verification/fast/runtime/control.json" \
  TQS_DATA_LAKE_ROOT="$PWD/.verification/fast/runtime/data-lake" \
  TQS_MODE=stop TQS_ENABLE_BINANCE=false TQS_ENABLE_BITGET=false TQS_ENABLE_BYBIT=false TQS_ENABLE_OKX=false TQS_ENABLE_MOEX=false \
  python - <<'PY'
from tqs_intelligence.api import app
paths = {route.path for route in app.routes}
required = {'/api/health', '/api/instrument/{canonical_id:path}', '/api/overview', '/api/anomalies', '/api/accounts', '/api/strategies', '/api/research/findings', '/api/briefing'}
missing = required - paths
assert not missing, missing
print('TQS API contract PASS', app.version)
PY

  node --check tqs-intelligence/src/tqs_intelligence/static/v07.js
  node --check tqs-intelligence/src/tqs_intelligence/static/app.js
  grep -q 'MARKET RESEARCH OS · v0.7' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'UNIVERSAL INSTRUMENT LAB' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'ПУЛЬС МАШИНЫ' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'Авторазведка публичных счетов' tqs-intelligence/src/tqs_intelligence/static/index.html
  grep -q 'Идеи, которые мы делаем через GPT' tqs-intelligence/src/tqs_intelligence/static/index.html

  python - <<'PY'
from tqs_intelligence.account_discovery import score_leaderboard_row, HyperliquidLeaderboardDiscovery
assert 'hyperliquid.xyz' in HyperliquidLeaderboardDiscovery.URL
score, reasons, metrics = score_leaderboard_row({
    'accountValue':'100000',
    'windowPerformances':[
        ['day', {'pnl':'100','roi':'0.01','vlm':'10000'}],
        ['week', {'pnl':'1000','roi':'0.05','vlm':'100000'}],
        ['month', {'pnl':'5000','roi':'0.1','vlm':'500000'}],
        ['allTime', {'pnl':'10000','roi':'0.5','vlm':'1000000'}],
    ],
})
assert score > 0 and reasons and metrics['equity'] == 100000
print('Account discovery contract PASS')
PY
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
