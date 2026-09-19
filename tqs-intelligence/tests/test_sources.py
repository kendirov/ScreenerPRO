from tqs_intelligence.sources import MoexSource


def test_moex_section_uses_dynamic_columns():
    payload = {"marketdata": {"columns": ["SECID", "LAST", "VOLTODAY"], "data": [["SBER", 300.5, 1000]]}}
    assert MoexSource._section(payload) == [{"SECID": "SBER", "LAST": 300.5, "VOLTODAY": 1000}]
