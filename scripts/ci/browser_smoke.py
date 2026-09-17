#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("url")
parser.add_argument("--expect", action="append", default=[])
parser.add_argument("--screenshot", required=True)
parser.add_argument("--viewport-width", type=int, default=1440)
parser.add_argument("--viewport-height", type=int, default=1000)
args = parser.parse_args()

shot = Path(args.screenshot)
shot.parent.mkdir(parents=True, exist_ok=True)
evidence_path = shot.with_suffix(".json")
console_errors: list[str] = []
page_errors: list[str] = []
request_failures: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": args.viewport_width, "height": args.viewport_height})
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    page.on("requestfailed", lambda request: request_failures.append(f"{request.method} {request.url}: {request.failure}"))
    response = page.goto(args.url, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(2500)
    body = page.locator("body").inner_text(timeout=15_000)
    title = page.title()
    status = response.status if response else None
    missing = [text for text in args.expect if text not in body]
    page.screenshot(path=str(shot), full_page=True)
    evidence = {
        "url": page.url,
        "status": status,
        "title": title,
        "body_chars": len(body),
        "expected": args.expect,
        "missing": missing,
        "console_errors": console_errors,
        "page_errors": page_errors,
        "request_failures": request_failures,
    }
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    browser.close()

problems = []
if status is None or status >= 400:
    problems.append(f"main document status={status}")
if len(body.strip()) < 100:
    problems.append("page body unexpectedly small")
if missing:
    problems.append(f"missing expected text: {missing}")
if page_errors:
    problems.append(f"page errors: {page_errors}")
if console_errors:
    problems.append(f"console errors: {console_errors}")
if problems:
    raise SystemExit("; ".join(problems))
print(f"BROWSER PASS {args.url} -> {shot}")
