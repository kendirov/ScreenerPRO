from types import SimpleNamespace

from tqs_intelligence.history_autopilot import START_2021_MS, build_history_plan, history_key
from tqs_intelligence.models import AssetClass, Quote


def q(provider: str, market_type: str, symbol: str, turnover: float, **meta):
    return Quote(
        provider=provider,
        venue=provider,
        symbol=symbol,
        asset_class=AssetClass.FUTURE if market_type in {'usdt-futures','forts'} else AssetClass.STOCK,
        market_type=market_type,
        last=100,
        turnover_24h=turnover,
        change_24h_pct=1,
        ts_ms=1,
        observed_at_ms=1,
        meta=meta,
    )


def test_history_plan_round_robins_crypto_and_moex():
    quotes = [
        q('binance','usdt-futures','BTCUSDT',1000),
        q('binance','usdt-futures','ETHUSDT',900),
        q('binance','spot','BTCUSDT',800),
        q('moex','shares','SBER',700,engine='stock',market='shares'),
        q('moex','forts','SiZ6',600,engine='futures',market='forts'),
    ]
    payloads, stats = build_history_plan(quotes, [], batch_size=4)
    assert len(payloads) == 4
    assert payloads[0]['provider'] == 'binance'
    assert payloads[1]['provider'] == 'moex' and payloads[1]['market_type'] == 'forts'
    assert payloads[2]['provider'] == 'moex' and payloads[2]['market_type'] == 'shares'
    assert payloads[3]['provider'] == 'binance' and payloads[3]['market_type'] == 'spot'
    assert all(p['start_ms'] == START_2021_MS for p in payloads)
    assert stats['target_total'] == 5


def test_history_plan_does_not_requeue_known_or_failed_symbol():
    quotes = [q('binance','usdt-futures','BTCUSDT',1000), q('binance','usdt-futures','ETHUSDT',900)]
    old = {
        'provider':'binance','symbol':'BTCUSDT','market_type':'usdt-futures','interval':'5m','start_ms':START_2021_MS,
    }
    jobs = [SimpleNamespace(kind='historical_backfill', payload=old, status='failed')]
    payloads, stats = build_history_plan(quotes, jobs, batch_size=10)
    assert all(history_key(p) != history_key(old) for p in payloads)
    assert payloads[0]['symbol'] == 'ETHUSDT'
    assert stats['failed'] == 1
    assert stats['remaining'] == 1


def test_unsupported_provider_is_not_planned():
    quotes = [q('bitget','usdt-futures','BTCUSDT',1000)]
    payloads, stats = build_history_plan(quotes, [], batch_size=10)
    assert payloads == []
    assert stats['target_total'] == 0
