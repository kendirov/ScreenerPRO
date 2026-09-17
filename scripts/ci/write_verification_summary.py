#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("stage", choices=["fast", "full", "live", "security"])
parser.add_argument("status", choices=["pass", "fail", "partial"])
args = parser.parse_args()

root = Path(".verification")
root.mkdir(exist_ok=True)
changed = root / "changed-files.txt"
changed_files = changed.read_text(encoding="utf-8").splitlines() if changed.exists() else []
artifacts = []
for path in sorted(root.rglob("*")):
    if path.is_file() and path.name not in {f"{args.stage}-summary.json"}:
        artifacts.append(str(path))

payload = {
    "stage": args.stage,
    "status": args.status,
    "sha": os.environ.get("GITHUB_SHA", "unknown"),
    "branch": os.environ.get("GITHUB_HEAD_REF") or os.environ.get("GITHUB_REF_NAME") or "unknown",
    "run_id": os.environ.get("GITHUB_RUN_ID", "local"),
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "changed_files": changed_files,
    "evidence": artifacts,
}
(root / f"{args.stage}-summary.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, ensure_ascii=False, indent=2))
