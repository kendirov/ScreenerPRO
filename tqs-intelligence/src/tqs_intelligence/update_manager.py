from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

from .remote_node import server_mode_enabled


class UpdateManager:
    def __init__(self, request_path: str = './data/update-request.json') -> None:
        self.request_path = Path(request_path)
        self.request_path.parent.mkdir(parents=True, exist_ok=True)
        self.update_state_path = self.request_path.parent / 'update-state.json'
        self.tqs_root = Path(__file__).resolve().parents[2]
        self.repo_root = Path(__file__).resolve().parents[3]

    def _git(self, *args: str, timeout: int = 30) -> str:
        flags = int(getattr(subprocess, 'CREATE_NO_WINDOW', 0)) if os.name == 'nt' else 0
        return subprocess.check_output(
            ['git', '-C', str(self.repo_root), *args],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            creationflags=flags,
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

    def execution_state(self) -> dict[str, Any] | None:
        if not self.update_state_path.exists():
            return None
        try:
            payload = json.loads(self.update_state_path.read_text(encoding='utf-8-sig'))
            return payload if isinstance(payload, dict) else None
        except Exception:
            return None

    def status(self, fetch: bool = False) -> dict[str, Any]:
        try:
            inside = self._git('rev-parse', '--is-inside-work-tree') == 'true'
            if not inside:
                return {'available': False, 'reason': 'not a git worktree', 'execution': self.execution_state()}

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
                'execution': self.execution_state(),
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc), 'execution': self.execution_state()}

    def _launch_windows_updater(self) -> dict[str, Any] | None:
        if os.name != 'nt':
            return None
        script = self.tqs_root / 'update-windows.ps1'
        if not script.exists():
            return None
        flags = 0
        flags |= int(getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0))
        flags |= int(getattr(subprocess, 'DETACHED_PROCESS', 0))
        subprocess.Popen(
            [
                'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                '-File', str(script), '-FromApp',
            ],
            cwd=str(self.tqs_root),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
        return {
            'ok': True,
            'external': True,
            'requested_at_ms': int(time.time() * 1000),
            'message': 'Windows updater запущен отдельным процессом. TQS перезапустится автоматически.',
        }

    def request(self, force: bool = False) -> dict[str, Any]:
        # In always-on server mode the supervisor owns updates. Launching the
        # external Windows updater would kill the scheduled-task supervisor and
        # race Task Scheduler when it tries to restart it. Queue the request
        # instead; the live supervisor consumes it in its main loop.
        if server_mode_enabled(self.tqs_root):
            launch_error = None
        else:
            try:
                launched = self._launch_windows_updater()
                if launched is not None:
                    return launched
            except Exception as exc:
                # Fall back to the supervisor request file. This keeps the old path available
                # even if Windows blocks detached PowerShell for some reason.
                launch_error = str(exc)
            else:
                launch_error = None

        payload = {'requested_at_ms': int(time.time() * 1000), 'force': bool(force)}
        self.request_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        result: dict[str, Any] = {'ok': True, **payload, 'external': False, 'server_mode': server_mode_enabled(self.tqs_root)}
        if launch_error:
            result['fallback_reason'] = launch_error
        return result

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
