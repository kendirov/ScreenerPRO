#!/usr/bin/env bash
set -euo pipefail

mkdir -p .verification/live/runtime
python -m pip install --disable-pip-version-check -e './tqs-intelligence[dev]'

export TQS_DB_PATH="$PWD/.verification/live/runtime/tqs.duckdb"
export TQS_LAB_DB_PATH="$PWD/.verification/live/runtime/tqs-lab.sqlite3"
export TQS_ACCOUNTS_DB_PATH="$PWD/.verification/live/runtime/tqs-accounts.sqlite3"
export TQS_CONTROL_PATH="$PWD/.verification/live/runtime/control.json"
export TQS_DATA_LAKE_ROOT="$PWD/.verification/live/runtime/data-lake"
export TQS_MODE=light
export TQS_REFRESH_SECONDS=20

python -m uvicorn tqs_intelligence.api:app --host 127.0.0.1 --port 8766 > .verification/live/runtime.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
python scripts/ci/wait_http.py http://127.0.0.1:8766/api/health --timeout 90
sleep 35
curl --fail --silent --show-error http://127.0.0.1:8766/api/health > .verification/live/health.json
python - <<'PY'
import json
from pathlib import Path
p = json.loads(Path('.verification/live/health.json').read_text())
assert p.get('ok') is True
sources = p.get('sources') or []
print('LIVE app health PASS; provider rows:', len(sources))
for row in sources:
    print(row.get('provider'), row.get('status'), row.get('last_error'))
PY
