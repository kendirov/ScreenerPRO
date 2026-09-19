from tqs_intelligence.watchdog_policy import WatchdogPolicy


def test_transient_health_miss_with_live_processes_never_restarts_early():
    p = WatchdogPolicy(start_after_s=12, hard_recover_after_s=180, restart_cooldown_s=90)
    assert p.observe(now=0, healthy=False, mode='max', process_count=2, busy=False).action == 'wait'
    assert p.observe(now=30, healthy=False, mode='max', process_count=2, busy=False).action == 'wait'
    assert p.observe(now=120, healthy=False, mode='max', process_count=2, busy=False).action == 'wait'
    assert p.observe(now=181, healthy=False, mode='max', process_count=2, busy=False).action == 'hard_recover'


def test_fresh_supervisor_heartbeat_blocks_destructive_recovery():
    p = WatchdogPolicy(start_after_s=12, hard_recover_after_s=30, restart_cooldown_s=10)
    p.observe(now=0, healthy=False, mode='max', process_count=2, busy=False)
    decision = p.observe(
        now=300,
        healthy=False,
        mode='max',
        process_count=2,
        busy=False,
        supervisor_heartbeat_fresh=True,
    )
    assert decision.action == 'wait'
    assert 'heartbeat' in decision.reason


def test_missing_processes_are_started_after_short_grace():
    p = WatchdogPolicy(start_after_s=12, hard_recover_after_s=180, restart_cooldown_s=30)
    assert p.observe(now=0, healthy=False, mode='max', process_count=0, busy=False).action == 'wait'
    assert p.observe(now=13, healthy=False, mode='max', process_count=0, busy=False).action == 'start'


def test_stop_mode_never_recovers_and_health_resets_outage():
    p = WatchdogPolicy(start_after_s=1, hard_recover_after_s=2, restart_cooldown_s=1)
    assert p.observe(now=0, healthy=False, mode='stop', process_count=0, busy=False).action == 'none'
    p.observe(now=10, healthy=False, mode='max', process_count=2, busy=False)
    assert p.observe(now=11, healthy=True, mode='max', process_count=2, busy=False).action == 'none'
    assert p.offline_since is None
