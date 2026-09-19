#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
docker compose -f "$ROOT/docker-compose.server.yml" --project-directory "$ROOT" ps
printf '\n--- recent logs ---\n'
docker compose -f "$ROOT/docker-compose.server.yml" --project-directory "$ROOT" logs --tail=80 intelligence
printf '\n--- auto-update timer ---\n'
systemctl status tqs-intelligence-update.timer --no-pager || true
