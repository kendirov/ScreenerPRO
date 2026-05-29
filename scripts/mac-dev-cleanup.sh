#!/usr/bin/env bash
# macOS: clean dev caches / project artifacts / (optional) all Node tools.
# Run from repo root:  ./scripts/mac-dev-cleanup.sh [light|project|full]
#
#   light   — safe: stop dev, prune caches (~3–4 GB), keep Node + project deps
#   project — light + delete node_modules & .next, then pnpm install (fresh project)
#   full    — project + remove Homebrew node/pnpm + wipe ~/.npm (need reinstall for local dev)
#
# Does NOT uninstall Cursor, Docker app, Python, etc. See docs/MAC_CLEANUP.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODE="${1:-light}"

cd "$REPO_ROOT"

info()  { printf "[cleanup] %s\n" "$*"; }
warn()  { printf "[cleanup] WARN: %s\n" "$*" >&2; }

bytes_human() {
  if [[ -d "$1" ]]; then
    du -sh "$1" 2>/dev/null | cut -f1 | tr -d ' '
  else
    echo "0"
  fi
}

stop_dev() {
  if [[ -x "$REPO_ROOT/stop.sh" ]]; then
    "$REPO_ROOT/stop.sh"
  else
    pkill -9 -f "next-server" 2>/dev/null || true
    pkill -9 -f "next dev" 2>/dev/null || true
    lsof -ti tcp:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
    info "stopped dev processes (fallback)"
  fi
}

clean_caches() {
  info "npm cache (was $(bytes_human "$HOME/.npm"))"
  npm cache clean --force 2>/dev/null || warn "npm cache clean skipped"

  if command -v pnpm >/dev/null 2>&1; then
    info "pnpm store prune"
    pnpm store prune 2>/dev/null || true
  fi

  for dir in \
    "$HOME/Library/Caches/node-gyp" \
    "$HOME/Library/Caches/pnpm" \
    "$REPO_ROOT/frontend/.next/cache"; do
    if [[ -d "$dir" ]]; then
      info "removing $(bytes_human "$dir") $dir"
      rm -rf "$dir"
    fi
  done
}

clean_project_artifacts() {
  for dir in \
    "$REPO_ROOT/node_modules" \
    "$REPO_ROOT/frontend/node_modules" \
    "$REPO_ROOT/shared/node_modules" \
    "$REPO_ROOT/frontend/.next"; do
    if [[ -e "$dir" ]]; then
      info "removing $(bytes_human "$dir") $dir"
      rm -rf "$dir"
    fi
  done
}

reinstall_project() {
  info "pnpm install (may take a few minutes)"
  (cd "$REPO_ROOT" && pnpm install)
  if [[ ! -f "$REPO_ROOT/frontend/.env" && -f "$REPO_ROOT/frontend/.env.example" ]]; then
    cp "$REPO_ROOT/frontend/.env.example" "$REPO_ROOT/frontend/.env"
    info "created frontend/.env from .env.example"
  fi
  info "prisma db push (creates local SQLite tables)"
  (cd "$REPO_ROOT" && pnpm -C frontend prisma:push)
}

remove_node_tools() {
  warn "Removing Homebrew node ecosystem (you will need to reinstall for ./run-dev.sh)"
  if command -v brew >/dev/null 2>&1; then
    brew uninstall --ignore-dependencies node 2>/dev/null || warn "node not via brew or already removed"
    # pnpm often installed via npm/corepack or brew
    brew uninstall pnpm 2>/dev/null || true
    brew uninstall yarn 2>/dev/null || true
  fi
  info "removing ~/.npm ($(bytes_human "$HOME/.npm"))"
  rm -rf "$HOME/.npm"
  info "removing ~/Library/pnpm ($(bytes_human "$HOME/Library/pnpm"))"
  rm -rf "$HOME/Library/pnpm"
  if [[ -d "$HOME/.pnpm-store" ]]; then
    info "removing ~/.pnpm-store ($(bytes_human "$HOME/.pnpm-store"))"
    rm -rf "$HOME/.pnpm-store"
  fi
}

print_after_full() {
  cat <<'EOF'

[cleanup] Node removed. To work on ScreenerPRO locally again, install minimal stack:

  brew install node@22
  brew link --overwrite --force node@22
  corepack enable
  corepack prepare pnpm@10.32.1 --activate

  cd ~/Pro/Screener
  ./scripts/mac-dev-cleanup.sh project

Or skip local dev — use only Cursor + ./sync.sh save + screenerpro.vercel.app

EOF
}

case "$MODE" in
  light)
    info "mode: light (caches only, safe)"
    stop_dev
    clean_caches
    info "done. Try: ./run-dev.sh"
    ;;
  project)
    info "mode: project (caches + fresh node_modules + .next)"
    stop_dev
    clean_caches
    clean_project_artifacts
    reinstall_project
    info "done. First ./run-dev.sh start will be slow (normal). Then faster."
    ;;
  full)
    info "mode: full (remove Node/pnpm from Mac + project artifacts)"
    read -rp "[cleanup] This removes Node. Continue? (type yes): " ans
    if [[ "$ans" != "yes" ]]; then
      info "cancelled"
      exit 0
    fi
    stop_dev
    clean_project_artifacts
    clean_caches
    remove_node_tools
    print_after_full
    ;;
  *)
    echo "Usage: $0 {light|project|full}" >&2
    exit 2
    ;;
esac
