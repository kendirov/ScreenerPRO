from __future__ import annotations

from tqs_intelligence.strategy_extensions import _diagnostics, detect_dips


def _rows() -> list[dict]:
    rows=[]; ts=1_700_000_000_000; price=100.0
    for i in range(220):
        # Repeating rise -> pullback -> recovery pattern, deterministic for the detector.
        phase=i % 20
        if phase < 10: price += .35
        elif phase == 10: price -= 2.2
        else: price += .28
        o=price; h=price+.35; l=price-.35; c=price+.05
        if phase == 10: l=price-1.2
        rows.append({'ts_ms':ts+i*600_000,'open':o,'high':h,'low':l,'close':c,'volume':1000+i})
    return rows


def test_dip_core_detects_and_explains_events() -> None:
    events=detect_dips(_rows(),drop_pct=1.0,target=40,stop=80,max_hold=6,cost_bps=5,
                      lookback=10,reset_bars=3,mode='bps')
    assert len(events) >= 5
    assert all('pre_vol_pct' in x.context for x in events)
    assert all('exit_reason' in x.context for x in events)
    diag=_diagnostics(events)
    assert diag['top_wins']
    assert diag['top_losses']
    assert diag['regime_cells']
