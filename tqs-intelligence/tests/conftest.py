import os
import tempfile
from pathlib import Path

# API-module tests must never open the live TQS databases.  Pytest loads this
# file before test modules, so Settings sees isolated paths on first import.
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="tqs-pytest-"))
os.environ.setdefault("TQS_DB_PATH", str(_TEST_ROOT / "tqs-intelligence.duckdb"))
os.environ.setdefault("TQS_LAB_DB_PATH", str(_TEST_ROOT / "tqs-lab.sqlite3"))
os.environ.setdefault("TQS_ACCOUNTS_DB_PATH", str(_TEST_ROOT / "tqs-accounts.sqlite3"))
os.environ.setdefault("TQS_LCHI_DB_PATH", str(_TEST_ROOT / "tqs-lchi.sqlite3"))
os.environ.setdefault("TQS_PULSE_DB_PATH", str(_TEST_ROOT / "tqs-pulse.sqlite3"))
os.environ.setdefault("TQS_CONTROL_PATH", str(_TEST_ROOT / "control.json"))
os.environ.setdefault("TQS_DATA_LAKE_ROOT", str(_TEST_ROOT / "data-lake"))
os.environ.setdefault("TQS_AUTO_UPDATE", "false")
os.environ.setdefault("TQS_MODE", "light")
