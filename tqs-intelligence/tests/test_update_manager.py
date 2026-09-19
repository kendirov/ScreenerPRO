from __future__ import annotations

import subprocess

from tqs_intelligence.update_manager import UpdateManager


def test_status_falls_back_to_origin_branch_when_upstream_missing(tmp_path, monkeypatch):
    manager = UpdateManager(str(tmp_path / 'update-request.json'))

    def fake_git(*args: str, timeout: int = 30) -> str:
        if args == ('rev-parse', '--is-inside-work-tree'):
            return 'true'
        if args == ('status', '--porcelain'):
            return ''
        if args == ('branch', '--show-current'):
            return 'codex/tqs-test'
        if args == ('rev-parse', 'HEAD'):
            return 'local-head'
        if args[:3] == ('fetch', '--prune', 'origin'):
            return ''
        if args == ('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'):
            raise subprocess.CalledProcessError(128, ['git'])
        if args == ('rev-parse', '--verify', 'origin/codex/tqs-test'):
            return 'remote-head'
        if args == ('rev-parse', 'origin/codex/tqs-test'):
            return 'remote-head'
        if args == ('rev-list', '--left-right', '--count', 'HEAD...origin/codex/tqs-test'):
            return '0 3'
        raise AssertionError(args)

    monkeypatch.setattr(manager, '_git', fake_git)
    status = manager.status(fetch=True)

    assert status['upstream'] == 'origin/codex/tqs-test'
    assert status['remote_head'] == 'remote-head'
    assert status['behind'] == 3
    assert status['ahead'] == 0
    assert status['update_available'] is True
    assert status['can_update'] is True


def test_status_reports_missing_remote_instead_of_claiming_fresh(tmp_path, monkeypatch):
    manager = UpdateManager(str(tmp_path / 'update-request.json'))

    def fake_git(*args: str, timeout: int = 30) -> str:
        if args == ('rev-parse', '--is-inside-work-tree'):
            return 'true'
        if args == ('status', '--porcelain'):
            return ''
        if args == ('branch', '--show-current'):
            return 'local-only'
        if args == ('rev-parse', 'HEAD'):
            return 'local-head'
        if args == ('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'):
            raise subprocess.CalledProcessError(128, ['git'])
        if args == ('rev-parse', '--verify', 'origin/local-only'):
            raise subprocess.CalledProcessError(128, ['git'])
        raise AssertionError(args)

    monkeypatch.setattr(manager, '_git', fake_git)
    status = manager.status(fetch=False)

    assert status['update_available'] is False
    assert status['upstream'] is None
    assert 'origin/local-only' in status['reason']
