from __future__ import annotations

from tqs_intelligence.control import ControlCenter
from tqs_intelligence.supervisor import Supervisor


def test_update_quiesce_temporarily_pauses_max_and_restores(tmp_path, monkeypatch):
    sup = Supervisor.__new__(Supervisor)
    sup.control = ControlCenter(str(tmp_path / "control.json"))
    sup.control.update(mode="max", changed_by="test")
    states = iter([True, True, False])
    sup._busy = lambda: next(states, False)
    events = []
    sup._write_update_state = lambda **payload: events.append(payload)
    sup._say = lambda message: None
    monkeypatch.setattr("tqs_intelligence.supervisor.time.sleep", lambda _: None)

    previous = sup._quiesce_research_for_update(timeout_s=10)

    assert previous == "max"
    assert sup.control.get().mode == "light"
    assert any(x.get("step") == "quiesce" for x in events)

    sup._restore_mode_after_update(previous)
    assert sup.control.get().mode == "max"


def test_update_quiesce_does_nothing_when_research_idle(tmp_path):
    sup = Supervisor.__new__(Supervisor)
    sup.control = ControlCenter(str(tmp_path / "control.json"))
    sup.control.update(mode="max", changed_by="test")
    sup._busy = lambda: False

    assert sup._quiesce_research_for_update(timeout_s=5) is None
    assert sup.control.get().mode == "max"
