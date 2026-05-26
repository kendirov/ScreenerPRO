#!/usr/bin/env bash
# Roll the working copy back to a checkpoint, commit, or relative ref.
# Usage:
#   ./restore.sh                      → list checkpoints + recent commits (no changes)
#   ./restore.sh cp-before-x-2026...  → reset to that checkpoint
#   ./restore.sh HEAD~3               → roll back 3 commits
#   ./restore.sh <commit-hash>        → reset to a specific commit
#
# Safety:
# - before doing anything, creates a 'rescue-<time>' tag pointing at the current
#   state — you can always come back via:  git reset --hard rescue-<time>
# - asks for explicit 'yes' confirmation before rewriting history
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

show_overview() {
  git fetch origin --tags --quiet 2>/dev/null || true
  echo "[restore] checkpoints (cp-*, last 30):"
  if ! git tag --list 'cp-*' --sort=-creatordate --format='  %(creatordate:short)  %(refname:short)' | head -30; then
    echo "  (none — make one with: ./checkpoint.sh \"label\")"
  fi
  echo
  echo "[restore] recent commits on '${BRANCH}' (last 15):"
  git log -15 --pretty=format:"  %h  %ad  %s" --date=short
  echo
  echo
  echo "Usage:  ./restore.sh <tag|hash|HEAD~N>"
}

if [[ $# -eq 0 ]]; then
  show_overview
  exit 0
fi

TARGET="$1"

if ! git rev-parse --verify "${TARGET}^{commit}" >/dev/null 2>&1; then
  echo "[restore] ERROR: '${TARGET}' is not a valid tag/commit ref." >&2
  echo "[restore] run without arguments to see available options." >&2
  exit 1
fi

echo "[restore] target:"
git log -1 --pretty=format:"  %h  %ad  %s" --date=short "$TARGET"
echo
echo
echo "[restore] this will rewind '${BRANCH}' to that point."
echo "[restore] later, to publish the rollback so other machines see it, run:"
echo "          git push --force-with-lease origin ${BRANCH}"
read -rp "[restore] proceed? (type 'yes' to confirm) " ANSWER
if [[ "$ANSWER" != "yes" ]]; then
  echo "[restore] cancelled"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git stash push -u -m "auto-stash before restore to ${TARGET}" >/dev/null
  echo "[restore] uncommitted changes stashed (see: git stash list)"
fi

RESCUE="rescue-$(date '+%Y-%m-%d-%H%M%S')"
git tag -a "$RESCUE" -m "state before restore to ${TARGET}"
git push origin "$RESCUE" --quiet 2>/dev/null || true
echo "[restore] safety tag created: ${RESCUE}"

git reset --hard "$TARGET"

echo
echo "[restore] '${BRANCH}' is now at ${TARGET}"
echo "[restore] to undo this restore:           git reset --hard ${RESCUE}"
echo "[restore] to publish rollback to GitHub:  git push --force-with-lease origin ${BRANCH}"
