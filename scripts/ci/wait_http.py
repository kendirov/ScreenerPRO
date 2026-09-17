#!/usr/bin/env python3
from __future__ import annotations

import argparse
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("url")
parser.add_argument("--timeout", type=float, default=60.0)
args = parser.parse_args()

deadline = time.monotonic() + args.timeout
last = "no response"
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen(args.url, timeout=5) as response:
            if 200 <= response.status < 400:
                print(f"READY {response.status} {args.url}")
                raise SystemExit(0)
            last = f"HTTP {response.status}"
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        last = repr(exc)
    time.sleep(1)
raise SystemExit(f"Timed out waiting for {args.url}: {last}")
