from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

from .control import ControlCenter
from .remote_node import auto_update_interval_seconds, server_mode_enabled, stop_marker_path
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
        self.heartbeat_path = Path('./data/supervisor-heartbeat.json')
        self.started_at_ms = int(time.time() * 1000)
        self.server_mode = server_mode_enabled(self.root)
        self.auto_update_interval_s = auto_update_interval_seconds(self.root)
        self.server_stop_marker = stop_marker_path(self.root)

    def _say(self, message: str) -> None:
        print(f'[TQS SUPERVISOR {time.strftime("%H:%M:%S")}] {message}', flush=True)


    def _set_system_awake(self, enabled: bool) -> None:
        if os.name != 'nt':
            return
        try:
            es_continuous = 0x80000000
            es_system_required = 0x00000001
            flags = es_continuous | (es_system_required if enabled else 0)
            ctypes.windll.kernel32.SetThreadExecutionState(flags)
        except Exception:
            pass

    def _owner_requested_stop(self) -> bool:
        return bool(self.server_mode and self.server_stop_marker.exists())

    def _write_heartbeat(self, state: str = 'running', **extra) -> None:
        child_alive = bool(self.child is not None and self.child.poll() is None)
        payload = {
            'ts_ms': int(time.time() * 1000),
            'started_at_ms': self.started_at_ms,
            'state': state,
            'supervisor_pid': os.getpid(),
            'child_pid': self.child.pid if child_alive and self.child is not None else None,
            'child_alive': child_alive,
            **extra,
        }
        try:
            self.heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.heartbeat_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
            tmp.replace(self.heartbeat_path)
        except Exception:
            pass

    def _write_update_state(self, **payload) -> None:
        state = {'updated_at_ms': int(time.time() * 1000), **payload}
        try:
            self.update_state_path.parent.mkdir(parents=True, exist_ok=True)
            self.update_state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        except Exception:
            pass

    def start_child(self) -> None:
        if self.child is not None and self.child.poll() is None:
            self._write_heartbeat('running')
            return
        env = dict(os.environ)
        env['PYTHONUNBUFFERED'] = '1'
        self.child = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'tqs_intelligence.api:app', '--host', self.host, '--port', str(self.port)],
            cwd=self.root,
            env=env,
        )
        self._say(f'uvicorn запущен PID={self.child.pid}')
        self._write_heartbeat('starting')

    def stop_child(self) -> None:
        child = self.child
        if child is None:
            self._write_heartbeat('stopped')
            return
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)
        self._say(f'uvicorn остановлен exit={child.returncode}')
        self.child = None
        self._write_heartbeat('stopped')

    def healthy(self, timeout_s: int = 60) -> bool:
        if self.child is None:
            return False
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            self._write_heartbeat('healthcheck')
            if self.child.poll() is not None:
                self._say(f'uvicorn завершился до healthcheck exit={self.child.returncode}')
                self._write_heartbeat('child_exited', exit_code=self.child.returncode)
                return False
            try:
                with urllib.request.urlopen(self.url + '/api/health', timeout=2) as r:
                    if 200 <= r.status < 300:
                        self._write_heartbeat('running')
                        return True
            except Exception:
                pass
            time.sleep(1)
        self._write_heartbeat('health_timeout')
        return False

    def _run(self, args: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
        flags = int(getattr(subprocess, 'CREATE_NO_WINDOW', 0)) if os.name == 'nt' else 0
        return subprocess.run(
            args,
            cwd=self.root,
            text=True,
            capture_output=True,
            timeout=timeout,
            creationflags=flags,
        )

    def _busy(self) -> bool:
        try:
            with urllib.request.urlopen(self.url + '/api/research/runtime', timeout=2) as r:
                payload = json.loads(r.read().decode('utf-8'))
                return int(payload.get('running_jobs') or 0) > 0
        except Exception:
            return False

    def _quiesce_research_for_update(self, timeout_s: int = 45) -> str | None:
        """Pause MAX cooperatively so updates cannot starve behind endless research.

        Historical/metric jobs checkpoint through ResearchRuntime progress callbacks.
        Switching MAX -> LIGHT makes the current job re-queue at the next checkpoint.
        If a provider call is stuck past the timeout, the update still proceeds: the
        child restart recovers any job left running, and DataLake writes are
        tmp+replace atomic.
        """
        if not self._busy():
            return None
        state = self.control.get()
        previous_mode = state.mode
        if previous_mode == 'max':
            self._write_update_state(
                status='waiting',
                step='quiesce',
                message='Обновление ждёт safe checkpoint: MAX → LIGHT; текущая research-задача будет поставлена обратно в очередь',
                previous_mode=previous_mode,
            )
            self.control.update(mode='light', changed_by='supervisor-update-quiesce')
        else:
            self._write_update_state(
                status='waiting',
                step='quiesce',
                message=f'Жду завершения текущей research-задачи перед обновлением · mode={previous_mode.upper()}',
                previous_mode=previous_mode,
            )

        deadline = time.time() + max(5, int(timeout_s))
        while time.time() < deadline:
            if not self._busy():
                self._write_update_state(
                    status='running',
                    step='quiesce',
                    message='Research safe checkpoint достигнут; начинаю обновление',
                    previous_mode=previous_mode,
                )
                return previous_mode
            time.sleep(1)

        self._write_update_state(
            status='running',
            step='quiesce-timeout',
            message='Safe checkpoint не ответил вовремя; backend будет перезапущен, research job восстановится из очереди',
            previous_mode=previous_mode,
        )
        return previous_mode

    def _restore_mode_after_update(self, previous_mode: str | None) -> None:
        if not previous_mode:
            return
        try:
            current = self.control.get().mode
            if current != previous_mode:
                self.control.update(mode=previous_mode, changed_by='supervisor-update-restore')
                self._say(f'режим восстановлен после update: {previous_mode.upper()}')
        except Exception as exc:
            self._say(f'не удалось восстановить mode={previous_mode}: {exc}')

    def apply_update(self, force: bool = False) -> bool:
        status = self.updater.status(fetch=True)
        if not status.get('available'):
            self._write_update_state(status='failed', step='status', error=status.get('reason'))
            return False
        if not status.get('update_available'):
            self._write_update_state(status='noop', step='status', message='Новых обновлений нет', head=status.get('head'))
            return True
        if status.get('blocking_dirty_paths'):
            paths = ', '.join(str(x.get('path') or '') for x in (status.get('blocking_dirty_paths') or [])[:8])
            self._write_update_state(
                status='blocked',
                step='preflight',
                error='Локальная ветка содержит реальные незакоммиченные изменения',
                dirty_paths=status.get('blocking_dirty_paths'),
                detail=paths,
            )
            return False
        if status.get('safe_generated_only'):
            self._write_update_state(
                status='running',
                step='preflight',
                message='Есть только служебные untracked-файлы; они не блокируют обновление',
                safe_generated_dirty=status.get('safe_generated_dirty'),
            )

        # Continuous MAX autopilot can keep the queue busy indefinitely. Quiesce
        # research cooperatively, apply the update, then restore the previous mode.
        previous_mode = self._quiesce_research_for_update(timeout_s=45) if self._busy() else None

        old_head = str(status.get('head') or '')
        remote_ref = str(status.get('remote_ref') or status.get('upstream') or '')
        if not remote_ref:
            self._restore_mode_after_update(previous_mode)
            self._write_update_state(status='failed', step='preflight', error='Не найден remote ref для обновления')
            return False

        self._write_update_state(status='running', step='stopping', old_head=old_head, remote_ref=remote_ref)
        self.stop_child()

        fetch = self._run(['git', '-C', str(self.updater.repo_root), 'fetch', '--prune', 'origin'], 120)
        if fetch.returncode != 0:
            self.start_child()
            self._restore_mode_after_update(previous_mode)
            self._write_update_state(status='failed', step='fetch', error=fetch.stderr[-4000:])
            return False

        merge = self._run(['git', '-C', str(self.updater.repo_root), 'merge', '--ff-only', remote_ref], 120)
        if merge.returncode != 0:
            self.start_child()
            self._restore_mode_after_update(previous_mode)
            self._write_update_state(status='failed', step='fast-forward', error=(merge.stderr or merge.stdout)[-4000:])
            return False

        try:
            flags = int(getattr(subprocess, 'CREATE_NO_WINDOW', 0)) if os.name == 'nt' else 0
            new_head = subprocess.check_output(
                ['git', '-C', str(self.updater.repo_root), 'rev-parse', 'HEAD'],
                stderr=subprocess.STDOUT,
                text=True,
                timeout=20,
                creationflags=flags,
            ).strip()
        except Exception:
            new_head = ''

        self._write_update_state(status='running', step='install', old_head=old_head, new_head=new_head)
        install = self._run([sys.executable, '-m', 'pip', 'install', '-e', '.[dev,analytics]'], 300)
        self.start_child()
        if install.returncode == 0 and self.healthy(75):
            self._restore_mode_after_update(previous_mode)
            self._write_update_state(
                status='success',
                step='healthcheck',
                message='Обновление установлено; research mode восстановлен',
                old_head=old_head,
                new_head=new_head,
                restored_mode=previous_mode,
            )
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
        self._restore_mode_after_update(previous_mode)
        self._write_update_state(
            status='rolled_back' if rolled_back else 'failed',
            step='rollback',
            old_head=old_head,
            new_head=new_head,
            error='Новая версия не прошла healthcheck; выполнен откат.' if rolled_back else 'Откат тоже не прошёл healthcheck.',
        )
        return False

    def _ensure_initial_child(self) -> bool:
        for attempt in range(1, 4):
            self.start_child()
            if self.healthy(60):
                self._say(f'backend ONLINE (attempt {attempt})')
                self._write_heartbeat('running')
                return True
            self._say(f'initial healthcheck failed (attempt {attempt}/3)')
            self.stop_child()
            time.sleep(min(8, attempt * 2))
        return False

    def _browser_url(self) -> str:
        try:
            flags = int(getattr(subprocess, 'CREATE_NO_WINDOW', 0)) if os.name == 'nt' else 0
            build = subprocess.check_output(
                ['git', '-C', str(self.root.parent), 'rev-parse', 'HEAD'],
                stderr=subprocess.DEVNULL, text=True, timeout=5,
                creationflags=flags,
            ).strip()[:12]
        except Exception:
            build = str(int(time.time()))
        return f'{self.url}/?build={build}'

    def run(self) -> int:
        self._write_heartbeat('booting')
        if not self._ensure_initial_child():
            self._say('backend не поднялся после 3 попыток; внешний Launcher watchdog попробует снова')
            self._write_heartbeat('failed_initial_start')
            return 2
        if self.server_mode:
            self._set_system_awake(True)
            self._say(f'server mode ON · auto-update every {self.auto_update_interval_s}s · Windows sleep blocked while supervisor runs')
        else:
            try:
                webbrowser.open(self._browser_url())
            except Exception:
                pass
        self.last_auto_check = time.time()
        try:
            while True:
                try:
                    if self._owner_requested_stop():
                        self._say('owner stop marker detected; server exits cleanly')
                        self._write_heartbeat('owner_stopped')
                        return 0
                    self._write_heartbeat('running', server_mode=self.server_mode, auto_update_interval_s=self.auto_update_interval_s)
                    if self.child is None or self.child.poll() is not None:
                        exit_code = None if self.child is None else self.child.returncode
                        self._say(f'backend child потерян exit={exit_code}; восстановление')
                        self.stop_child()
                        self.start_child()
                        if not self.healthy(30):
                            self._say('restart healthcheck failed; повтор через 3 сек')
                            self.stop_child()
                            time.sleep(3)
                            continue
                    request = self.updater.pop_request()
                    if request is not None:
                        self.apply_update(bool(request.get('force')))
                    state = self.control.get()
                    if state.auto_update and time.time() - self.last_auto_check >= self.auto_update_interval_s:
                        self.last_auto_check = time.time()
                        self.apply_update(False)
                    time.sleep(2)
                except Exception as exc:
                    # One malformed update request/control read must never kill
                    # the supervisor and leave an overnight session dead.
                    self._say(f'loop error: {type(exc).__name__}: {exc}')
                    self._write_heartbeat('loop_error', error=f'{type(exc).__name__}: {exc}'[:500])
                    time.sleep(3)
        except KeyboardInterrupt:
            return 0
        finally:
            self.stop_child()
            if self.server_mode:
                self._set_system_awake(False)
            self._write_heartbeat('stopped')


def main() -> None:
    raise SystemExit(Supervisor().run())


if __name__ == '__main__':
    main()
