from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any


class UpdateManager:
    def __init__(self, request_path: str = './data/update-request.json') -> None:
        self.request_path = Path(request_path)
        self.request_path.parent.mkdir(parents=True, exist_ok=True)
        self.tqs_root = Path(__file__).resolve().parents[2]
        self.repo_root = Path(__file__).resolve().parents[3]

    def _git(self, *args: str, timeout: int = 30) -> str:
        return subprocess.check_output(
            ['git', '-C', str(self.repo_root), *args],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
        ).strip()

    def _remote_ref(self, branch: str) -> tuple[str | None, str | None]:
        """Return a usable remote ref even when the local branch has no configured upstream."""
        try:
            upstream = self._git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
            remote_head = self._git('rev-parse', upstream)
            return upstream, remote_head
        except Exception:
            pass

        if not branch:
            return None, None
        fallback = f'origin/{branch}'
        try:
            self._git('rev-parse', '--verify', fallback)
            remote_head = self._git('rev-parse', fallback)
            return fallback, remote_head
        except Exception:
            return None, None

    def status(self, fetch: bool = False) -> dict[str, Any]:
        try:
            inside = self._git('rev-parse', '--is-inside-work-tree') == 'true'
            if not inside:
                return {'available': False, 'reason': 'not a git worktree'}

            dirty = bool(self._git('status', '--porcelain'))
            branch = self._git('branch', '--show-current')
            head = self._git('rev-parse', 'HEAD')

            fetch_error = None
            if fetch:
                try:
                    self._git('fetch', '--prune', 'origin', timeout=90)
                except Exception as exc:
                    fetch_error = str(exc)

            remote_ref, remote_head = self._remote_ref(branch)
            ahead = 0
            behind = 0
            if remote_ref and remote_head:
                try:
                    counts = self._git('rev-list', '--left-right', '--count', f'HEAD...{remote_ref}').split()
                    if len(counts) >= 2:
                        ahead, behind = int(counts[0]), int(counts[1])
                except Exception:
                    behind = int(self._git('rev-list', '--count', f'HEAD..{remote_ref}') or 0)

            reason = None
            if not branch:
                reason = 'detached HEAD; automatic update disabled'
            elif remote_ref is None:
                reason = f'remote branch origin/{branch} not found'
            elif fetch_error:
                reason = f'fetch failed: {fetch_error}'

            return {
                'available': True,
                'branch': branch,
                'head': head,
                'dirty': dirty,
                'upstream': remote_ref,
                'remote_ref': remote_ref,
                'ahead': ahead,
                'behind': behind,
                'remote_head': remote_head,
                'update_available': bool(remote_head and remote_head != head and behind > 0),
                'can_update': bool(branch and remote_ref and not dirty),
                'reason': reason,
                'requested': self.request_path.exists(),
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def request(self, force: bool = False) -> dict[str, Any]:
        payload = {'requested_at_ms': int(time.time() * 1000), 'force': bool(force)}
        self.request_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        return {'ok': True, **payload}

    def pop_request(self) -> dict[str, Any] | None:
        if not self.request_path.exists():
            return None
        try:
            payload = json.loads(self.request_path.read_text(encoding='utf-8'))
        except Exception:
            payload = {}
        try:
            self.request_path.unlink()
        except Exception:
            pass
        return payload
