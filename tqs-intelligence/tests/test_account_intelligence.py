from __future__ import annotations

from pathlib import Path

from tqs_intelligence.account_intelligence import AccountFill, AccountIntelStore, PositionSnapshot


def test_account_profile_detects_bias_and_concentration(tmp_path: Path) -> None:
    store = AccountIntelStore(str(tmp_path / 'accounts.sqlite3'))
    account = '0x' + '1' * 40
    store.track('hyperliquid', account, 'test whale')
    fills = []
    for i in range(12):
        fills.append(AccountFill(
            source='hyperliquid', account_id=account, trade_id=f't{i}', ts_ms=1_700_000_000_000 + i * 60_000,
            symbol='BTC' if i < 10 else 'ETH', side='buy', qty=1, price=50_000 if i < 10 else 3_000,
            direction='Open Long', closed_pnl=100 if i % 2 == 0 else -50, taker=True,
        ))
    store.upsert_fills(fills)
    store.save_positions([
        PositionSnapshot(source='hyperliquid', account_id=account, observed_at_ms=1_700_001_000_000,
                         symbol='BTC', side='long', size=2, entry_price=50_000, notional=100_000, unrealized_pnl=3_000),
    ])
    profile = store.profile('hyperliquid', account)
    assert profile is not None
    assert profile['long_open_share'] == 1.0
    assert profile['taker_share'] == 1.0
    assert profile['open_long_notional'] == 100_000
    assert profile['top_instruments'][0]['symbol'] == 'BTC'
    assert any('LONG' in x for x in profile['signatures'])
    assert any('концентрация' in x for x in profile['signatures'])
