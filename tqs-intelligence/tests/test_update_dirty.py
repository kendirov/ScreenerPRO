from __future__ import annotations

from tqs_intelligence.update_manager import UpdateManager


def test_generated_data_lake_files_are_safe_untracked():
    rows = UpdateManager._parse_porcelain(
        "?? tqs-intelligence/data-lake/moex/SBER/5m/part-001.parquet\n"
        "?? tqs-intelligence/src/tqs_intelligence.egg-info/PKG-INFO\n"
    )
    assert rows
    assert all(UpdateManager._safe_generated_untracked(x) for x in rows)


def test_real_edits_are_never_classified_safe():
    rows = UpdateManager._parse_porcelain(
        " M tqs-intelligence/src/tqs_intelligence/api.py\n"
        "?? notes-important.txt\n"
    )
    assert len(rows) == 2
    assert all(not UpdateManager._safe_generated_untracked(x) for x in rows)


def test_renamed_path_parsing_uses_destination():
    rows = UpdateManager._parse_porcelain(
        "R  old.txt -> tqs-intelligence/src/tqs_intelligence/api.py\n"
    )
    assert rows == [{"code": "R ", "path": "tqs-intelligence/src/tqs_intelligence/api.py"}]
