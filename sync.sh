#!/usr/bin/env bash
# Cross-platform sync helper (macOS / Linux side).
# Usage:
#   ./sync.sh pull              # safe pull (rebase + autostash) — run when starting work
#   ./sync.sh save  ["msg"]     # commit everything as WIP and push — run when leaving the machine
#   ./sync.sh status            # show current state vs origin
# Default (no args) = save with auto message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HOST="$(hostname -s 2>/dev/null || hostname)"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %z')"
ACTION="${1:-save}"
MSG="${2:-wip(${HOST}): ${STAMP}}"

case "$ACTION" in
  pull)
    echo "[sync] pull --rebase --autostash on '${BRANCH}'"
    git fetch origin
    git pull --rebase --autostash origin "${BRANCH}"
    echo "[sync] up to date with origin/${BRANCH}"
    ;;

  save|push)
    if [[ -z "$(git status --porcelain)" ]]; then
      echo "[sync] no local changes — pushing existing commits only"
      git push origin "${BRANCH}"
      exit 0
    fi
    echo "[sync] staging all changes"
    git add -A
    echo "[sync] commit: ${MSG}"
    git commit -m "${MSG}"
    echo "[sync] pulling remote (rebase) before push to avoid divergence"
    git pull --rebase --autostash origin "${BRANCH}" || {
      echo "[sync] rebase has conflicts — resolve them, then run: git rebase --continue && ./sync.sh save" >&2
      exit 1
    }
    echo "[sync] pushing to origin/${BRANCH}"
    git push origin "${BRANCH}"
    echo "[sync] done"
    ;;

  status)
    git fetch origin >/dev/null 2>&1 || true
    echo "[sync] branch: ${BRANCH} on ${HOST}"
    git status --short --branch
    ;;

  *)
    echo "Usage: $0 {pull|save|status} [commit message]" >&2
    exit 2
    ;;
esac
