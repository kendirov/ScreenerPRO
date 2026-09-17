from tqs_intelligence.account_discovery import score_leaderboard_row


def row(p_day=1000,p_week=10000,p_month=50000,p_all=2000000,equity=250000,volume=50000000):
    return {
        'ethAddress':'0x'+'1'*40,
        'accountValue':str(equity),
        'windowPerformances':[
            ['day',{'pnl':str(p_day),'roi':'0.01','vlm':'100000'}],
            ['week',{'pnl':str(p_week),'roi':'0.05','vlm':'1000000'}],
            ['month',{'pnl':str(p_month),'roi':'0.15','vlm':'5000000'}],
            ['allTime',{'pnl':str(p_all),'roi':'1.5','vlm':str(volume)}],
        ],
    }


def test_persistent_account_scores_above_weak_account():
    strong, reasons, metrics = score_leaderboard_row(row())
    weak, _, _ = score_leaderboard_row(row(p_day=-100,p_week=-1000,p_month=-5000,p_all=1000,equity=5000,volume=500000000))
    assert strong > weak
    assert 'положительный PnL в нескольких окнах' in reasons
    assert metrics['equity'] == 250000


def test_extreme_turnover_is_flagged():
    _, reasons, metrics = score_leaderboard_row(row(equity=100000, volume=3_000_000_000))
    assert metrics['volume_equity_ratio'] > 20000
    assert any('HFT/MM' in x for x in reasons)
