#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
from pathlib import Path


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def valid_commit(value: str) -> bool:
    if not value or set(value) == {"0"}:
        return False
    return subprocess.call(["git", "cat-file", "-e", f"{value}^{{commit}}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0


head = os.environ.get("HEAD_SHA") or os.environ.get("GITHUB_SHA") or git("rev-parse", "HEAD")
base = os.environ.get("BASE_SHA", "").strip()
if not valid_commit(base):
    try:
        base = git("rev-parse", f"{head}^")
    except subprocess.CalledProcessError:
        base = head

if base == head:
    files = []
else:
    raw = git("diff", "--name-only", f"{base}...{head}")
    files = [line for line in raw.splitlines() if line.strip()]

forced_tqs = os.environ.get("VERIFY_TQS") == "1"
forced_frontend = os.environ.get("VERIFY_FRONTEND") == "1"
run_tqs = forced_tqs or any(path.startswith("tqs-intelligence/") for path in files)
run_frontend = forced_frontend or any(path.startswith("frontend/") or path in {"pnpm-lock.yaml", "pnpm-workspace.yaml"} for path in files)
run_harness = any(path.startswith(("scripts/ci/", ".github/workflows/chat-first", "docs/ai/", "docs/adr/", "docs/exec-plans/")) or path in {"AGENTS.md", "START_HERE_FOR_AI.md", "AI_SESSION_STATE.md"} for path in files)

out = Path(".verification")
out.mkdir(exist_ok=True)
(out / "changed-files.txt").write_text("\n".join(files) + ("\n" if files else ""), encoding="utf-8")
(out / "scopes.env").write_text(
    f"BASE_SHA={base}\nHEAD_SHA={head}\nRUN_TQS={int(run_tqs)}\nRUN_FRONTEND={int(run_frontend)}\nRUN_HARNESS={int(run_harness)}\n",
    encoding="utf-8",
)

print(f"base={base}")
print(f"head={head}")
print(f"changed_files={len(files)}")
print(f"RUN_TQS={int(run_tqs)} RUN_FRONTEND={int(run_frontend)} RUN_HARNESS={int(run_harness)}")
for path in files[:200]:
    print(path)
