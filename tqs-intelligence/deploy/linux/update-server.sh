#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="${TQS_UPDATE_BRANCH:-$(git -C "$REPO_ROOT" branch --show-current)}"
if [ -z "$BRANCH" ]; then
  echo "TQS update: detached HEAD is not supported" >&2
  exit 2
fi
if [ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)" ]; then
  echo "TQS update: repository has local changes; auto-update skipped to protect work" >&2
  exit 0
fi
OLD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
git -C "$REPO_ROOT" fetch origin "$BRANCH"
NEW="$(git -C "$REPO_ROOT" rev-parse "origin/$BRANCH")"
if [ "$OLD" = "$NEW" ]; then
  echo "TQS update: already current ($OLD)"
  exit 0
fi
echo "TQS update: $OLD -> $NEW"
git -C "$REPO_ROOT" merge --ff-only "origin/$BRANCH"
if docker compose -f docker-compose.server.yml --project-directory . build intelligence && \
   docker compose -f docker-compose.server.yml --project-directory . up -d intelligence; then
  for _ in $(seq 1 18); do
    if docker inspect --format='{{.State.Health.Status}}' tqs-intelligence 2>/dev/null | grep -q '^healthy$'; then
      echo "TQS update: healthy on $NEW"
      exit 0
    fi
    sleep 5
  done
fi
echo "TQS update: health/build failed, rolling back to $OLD" >&2
git -C "$REPO_ROOT" reset --hard "$OLD"
docker compose -f docker-compose.server.yml --project-directory . build intelligence
docker compose -f docker-compose.server.yml --project-directory . up -d intelligence
exit 1
