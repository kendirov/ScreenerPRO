#!/usr/bin/env bash
# Create a named rollback point ("checkpoint") so you can come back here later.
# Usage:
#   ./checkpoint.sh                       → auto label = cp-<date-time>
#   ./checkpoint.sh "before redesign"     → cp-before-redesign-<date-time>
#   ./checkpoint.sh list                  → show the last 30 checkpoints
#   ./checkpoint.sh delete <full-tag>     → remove a checkpoint (local + remote)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ACTION="${1:-create}"
STAMP="$(date '+%Y-%m-%d-%H%M%S')"

case "$ACTION" in
  list)
    echo "[checkpoint] fetching tags from origin..."
    git fetch origin --tags --quiet 2>/dev/null || true
    echo "[checkpoint] available rollback points (last 30):"
    if ! git tag --list 'cp-*' --sort=-creatordate --format='  %(creatordate:short)  %(refname:short)' | head -30; then
      echo "  (none yet — make one with: ./checkpoint.sh \"label\")"
    fi
    ;;

  delete)
    TAG="${2:-}"
    if [[ -z "$TAG" ]]; then
      echo "Usage: $0 delete <full-tag-name>" >&2
      exit 2
    fi
    git tag -d "$TAG" 2>/dev/null || true
    git push origin ":refs/tags/$TAG" 2>/dev/null || true
    echo "[checkpoint] deleted: $TAG"
    ;;

  create|*)
    LABEL="${1:-}"
    if [[ -n "$LABEL" && "$LABEL" != "create" ]]; then
      SAFE=$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '-' | sed 's/-\{2,\}/-/g; s/^-//; s/-$//')
      TAG="cp-${SAFE}-${STAMP}"
      MSG="checkpoint: ${LABEL} (${STAMP})"
    else
      TAG="cp-${STAMP}"
      MSG="checkpoint: ${STAMP}"
    fi

    if [[ -n "$(git status --porcelain)" ]]; then
      echo "[checkpoint] you have uncommitted changes — committing them first as WIP"
      git add -A
      git commit -m "wip before ${TAG}" >/dev/null
    fi

    git tag -a "$TAG" -m "$MSG"
    echo "[checkpoint] pushing tag to origin..."
    git push origin "$TAG" --quiet
    echo "[checkpoint] created: $TAG"
    echo "[checkpoint]   restore later with:  ./restore.sh $TAG"
    ;;
esac
