from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from .control import ControlCenter
from .update_manager import UpdateManager


class Supervisor:
    def __init__(self) -> None:
        self.root = Path(__file__).resolve().parents[2]
        os.chdir(self.root)
        self.control = ControlCenter('./data/control.json')
        self.updater = UpdateManager('./data/update-request.json')
        self.child: subprocess.Popen | None = None
        self.host = os.getenv('TQS_HOST', '127.0.0.1')
        self.port = int(os.getenv('TQS_PORT', '8787'))
        self.url = f'http://{self.host}:{self.port}'
        self.last_auto_check = 0.0
        self.update_state_path = Path('./data/update-state.json')

    def _write_update_state(self, **payload) -> None:
        state = {'updated_at_ms': int(time.time() * 1000), **payload}
        try:
            self.update_state_path.parent.mkdir(parents=True, exist_ok=True)
            self.update_state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        except Exception:
            pass

    def start_child(self) -> None:
        self.child = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'tqs_intelligence.api:app', '--host', self.host, '--port', str(self.port)],
            cwd=self.root,
        )

    def stop_child(self) -> None:
        if self.child is None or self.child.poll() is not None:
            return
        self.child.terminate()
        try:
            self.child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.child.kill()
            self.child.wait(timeout=5)

    def healthy(self, timeout_s: int = 60) -> bool:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            if self.child and self.child.poll() is not None:
                return False
            try:
                with urllib.request.urlopen(self.url + '/api/health', timeout=2) as r:
                    if 200 <= r.status < 300:
                        return True
            except Exception:
                pass
            time.sleep(1)
        return False

    def _run(self, args: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
        return subprocess.run(args, cwd=self.root, text=True, capture_output=True, timeout=timeout)

    def _busy(self) -> bool:
        try:
            with urllib.request.urlopen(self.url + '/api/research/runtime', timeout=2) as r:
                payload = json.loads(r.read().decode('utf-8'))
                return int(payload.get('running_jobs') or 0) > 0
        except Exception:
            return False

    def apply_update(self, force: bool = False) -> bool:
        status = self.updater.status(fetch=True)
        if not status.get('available'):
            self._write_update_state(status='failed', step='status', error=status.get('reason'))
            return False
        if not status.get('update_available'):
            self._write_update_state(status='noop', step='status', message='Новых обновлений нет', head=status.get('head'))
            return True
        if status.get('dirty'):
            self._write_update_state(status='blocked', step='preflight', error='Локальная ветка содержит незакоммиченные изменения')
            return False
        if self._busy() and not force:
            self._write_update_state(status='blocked', step='preflight', error='Идёт тяжёлая research-задача')
            return False

        old_head = str(status.get('head') or '')
        remote_ref = str(status.get('remote_ref') or status.get('upstream') or '')
        if not remote_ref:
            self._write_update_state(status='failed', step='preflight', error='Не найден remote ref для обновления')
            return False

        self._write_update_state(status='running', step='stopping', old_head=old_head, remote_ref=remote_ref)
        self.stop_child()

        fetch = self._run(['git', '-C', str(self.updater.repo_root), 'fetch', '--prune', 'origin'], 120)
        if fetch.returncode != 0:
            self.start_child()
            self._write_update_state(status='failed', step='fetch', error=fetch.stderr[-4000:])
            return False

        merge = self._run(['git', '-C', str(self.updater.repo_root), 'merge', '--ff-only', remote_ref], 120)
        if merge.returncode != 0:
            self.start_child()
            self._write_update_state(status='failed', step='fast-forward', error=(merge.stderr or merge.stdout)[-4000:])
            return False

        try:
            new_head = subprocess.check_output(
                ['git', '-C', str(self.updater.repo_root), 'rev-parse', 'HEAD'],
                stderr=subprocess.STDOUT,
                text=True,
                timeout=20,
            ).strip()
        except Exception:
            new_head = ''

        self._write_update_state(status='running', step='install', old_head=old_head, new_head=new_head)
        install = self._run([sys.executable, '-m', 'pip', 'install', '-e', '.[dev,analytics]'], 300)
        self.start_child()
        if install.returncode == 0 and self.healthy(75):
            self._write_update_state(status='success', step='healthcheck', old_head=old_head, new_head=new_head)
            return True

        self.stop_child()
        self._write_update_state(
            status='running',
            step='rollback',
            old_head=old_head,
            new_head=new_head,
            error=(install.stderr or install.stdout)[-4000:] if install.returncode != 0 else 'healthcheck failed',
        )
        if old_head:
            self._run(['git', '-C', str(self.updater.repo_root), 'reset', '--hard', old_head], 60)
            self._run([sys.executable, '-m', 'pip', 'install', '-e', '.[dev,analytics]'], 300)
        self.start_child()
        rolled_back = self.healthy(60)
        self._write_update_state(
            status='rolled_back' if rolled_back else 'failed',
            step='rollback',
            old_head=old_head,
            new_head=new_head,
            error='Новая версия не прошла healthcheck; выполнен откат.' if rolled_back else 'Откат тоже не прошёл healthcheck.',
        )
        return False

    def run(self) -> int:
        self.start_child()
        if not self.healthy(60):
            return 2
        try:
            webbrowser.open(self.url)
        except Exception:
            pass
        self.last_auto_check = time.time()
        try:
            while True:
                if self.child and self.child.poll() is not None:
                    self.start_child()
                    self.healthy(30)
                request = self.updater.pop_request()
                if request is not None:
                    self.apply_update(bool(request.get('force')))
                state = self.control.get()
                if state.auto_update and time.time() - self.last_auto_check >= 1800:
                    self.last_auto_check = time.time()
                    self.apply_update(False)
                time.sleep(2)
        except KeyboardInterrupt:
            return 0
        finally:
            self.stop_child()


def main() -> None:
    raise SystemExit(Supervisor().run())


if __name__ == '__main__':
    main()
