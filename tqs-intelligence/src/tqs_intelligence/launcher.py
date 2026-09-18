from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import urllib.request
import webbrowser
from collections import deque
from pathlib import Path
from typing import Any

import psutil
import tkinter as tk
from tkinter import ttk

from .remote_node import remote_node_status, request_server_task_start, server_mode_enabled, stop_marker_path

BG = "#090c0f"
PANEL = "#10151a"
PANEL_2 = "#151b21"
BORDER = "#283039"
TEXT = "#f2efe7"
MUTED = "#8d98a3"
AMBER = "#d7a84d"
GREEN = "#67c895"
RED = "#df6d70"


class TQSLauncher:
    def __init__(self) -> None:
        self.root_dir = Path(__file__).resolve().parents[2]
        self.repo_root = self.root_dir.parent
        self.data_dir = self.root_dir / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_log = self.data_dir / "runtime.log"
        self.launcher_event_log = self.data_dir / "launcher-events.log"
        self.update_state = self.data_dir / "update-state.json"
        self.python = self.root_dir / ".venv" / "Scripts" / "python.exe"
        self.update_script = self.root_dir / "update-windows.ps1"
        self.server_setup_script = self.root_dir / "setup-server-windows.ps1"
        self.url = "http://127.0.0.1:8787"
        self._remote_cache: dict[str, Any] = {}
        self._remote_last_s = 0.0
        self._busy = False
        self._busy_lock = threading.Lock()
        self._last_log_text = ""
        self._events: deque[str] = deque(maxlen=100)
        try:
            previous = self.launcher_event_log.read_text(encoding="utf-8", errors="replace").splitlines()[-100:]
            for row in reversed(previous):
                if row.strip():
                    self._events.append(row)
        except Exception:
            pass
        self._health_payload: dict[str, Any] | None = None
        self._health_last_ok_s = 0.0
        self._health_last_probe_s = 0.0
        self._health_error = ""
        self._health_lock = threading.RLock()
        self._owner_summary: dict[str, Any] = {}
        self._owner_accounts: dict[str, Any] = {}
        self._owner_summary_last_s = 0.0
        self._git_verified = False
        self._git_fetch_error = ""

        self.root = tk.Tk()
        self.root.title("TQS Launcher")
        self.root.geometry("1040x835")
        self.root.minsize(900, 720)
        self.root.configure(bg=BG)
        self._setup_style()
        self._build_ui()
        threading.Thread(target=self._health_loop, name="tqs-launcher-health", daemon=True).start()
        self.root.after(250, self.refresh_all)
        self.root.after(1200, lambda: self._thread(self.refresh_git, True))
        self.root.after(2500, self._poll)

    def _setup_style(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("Header.TLabel", background=BG, foreground=TEXT, font=("Segoe UI Semibold", 20))
        style.configure("SubHeader.TLabel", background=BG, foreground=AMBER, font=("Segoe UI Semibold", 9))
        style.configure("TButton", font=("Segoe UI Semibold", 9), padding=(12, 8), background=PANEL_2, foreground=TEXT, bordercolor=BORDER)
        style.map("TButton", background=[("active", "#202830")])
        style.configure("Primary.TButton", background=AMBER, foreground="#101010", bordercolor=AMBER)
        style.map("Primary.TButton", background=[("active", "#e1b85f")])
        style.configure("Green.TButton", background="#173025", foreground=GREEN, bordercolor="#27513c")
        style.configure("Red.TButton", background="#351b1d", foreground=RED, bordercolor="#5a2a2e")

    def _build_ui(self) -> None:
        outer = ttk.Frame(self.root, padding=18)
        outer.pack(fill="both", expand=True)
        header = ttk.Frame(outer); header.pack(fill="x")
        left = ttk.Frame(header); left.pack(side="left", fill="x", expand=True)
        ttk.Label(left, text="TQS Launcher", style="Header.TLabel").pack(anchor="w")
        ttk.Label(left, text="SYSTEM CONTROL · UPDATE · HEALTH · LOGS", style="SubHeader.TLabel").pack(anchor="w", pady=(2, 0))
        self.version_label = ttk.Label(header, text="версия: —", style="Muted.TLabel"); self.version_label.pack(side="right", anchor="ne", pady=(8, 0))

        self.banner = tk.Frame(outer, bg=PANEL_2, highlightbackground=BORDER, highlightthickness=1); self.banner.pack(fill="x", pady=(16, 12))
        self.status_dot = tk.Label(self.banner, text="●", bg=PANEL_2, fg=MUTED, font=("Segoe UI", 14)); self.status_dot.pack(side="left", padx=(14, 8), pady=12)
        self.status_title = tk.Label(self.banner, text="Проверяю систему…", bg=PANEL_2, fg=TEXT, font=("Segoe UI Semibold", 12)); self.status_title.pack(side="left", pady=12)
        self.status_detail = tk.Label(self.banner, text="", bg=PANEL_2, fg=MUTED, font=("Segoe UI", 9)); self.status_detail.pack(side="left", padx=(10, 0), pady=12)

        grid = ttk.Frame(outer); grid.pack(fill="x")
        for i in range(4): grid.columnconfigure(i, weight=1)
        self.cards: dict[str, tuple[tk.Label, tk.Label]] = {}
        for i, (key, title) in enumerate([("backend", "BACKEND"), ("local", "LOCAL BUILD"), ("remote", "REMOTE BUILD"), ("mode", "РЕЖИМ")]):
            f = tk.Frame(grid, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); f.grid(row=0, column=i, sticky="nsew", padx=(0 if i == 0 else 6, 0), pady=(0, 12))
            tk.Label(f, text=title, bg=PANEL, fg=MUTED, font=("Segoe UI Semibold", 8)).pack(anchor="w", padx=12, pady=(10, 3))
            v = tk.Label(f, text="—", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 13)); v.pack(anchor="w", padx=12)
            s = tk.Label(f, text="", bg=PANEL, fg=MUTED, font=("Segoe UI", 8)); s.pack(anchor="w", padx=12, pady=(2, 10))
            self.cards[key] = (v, s)

        actions = ttk.Frame(outer); actions.pack(fill="x", pady=(0, 12))
        ttk.Button(actions, text="▶ Запустить", style="Green.TButton", command=self.start_backend).pack(side="left", padx=(0, 6))
        ttk.Button(actions, text="■ Остановить", style="Red.TButton", command=self.stop_backend).pack(side="left", padx=6)
        ttk.Button(actions, text="↻ Перезапустить", command=self.restart_backend).pack(side="left", padx=6)
        ttk.Button(actions, text="Открыть TQS", style="Primary.TButton", command=self.open_tqs).pack(side="left", padx=6)
        ttk.Separator(actions, orient="vertical").pack(side="left", fill="y", padx=10)
        ttk.Button(actions, text="Проверить обновление", command=lambda: self._thread(self.refresh_git, True)).pack(side="left", padx=6)
        ttk.Button(actions, text="⬆ Обновить", style="Primary.TButton", command=self.run_update).pack(side="left", padx=6)
        ttk.Button(actions, text="Сохранить TQS", command=self.export_snapshot).pack(side="right", padx=(6, 0))

        modes = ttk.Frame(outer); modes.pack(fill="x", pady=(0, 8))
        ttk.Label(modes, text="Нагрузка:", style="Muted.TLabel").pack(side="left", padx=(0, 8))
        ttk.Button(modes, text="СТОП", command=lambda: self.set_mode("stop")).pack(side="left", padx=4)
        ttk.Button(modes, text="ЛАЙТ", command=lambda: self.set_mode("light")).pack(side="left", padx=4)
        ttk.Button(modes, text="МАКС", command=lambda: self.set_mode("max")).pack(side="left", padx=4)
        self.resource_label = ttk.Label(modes, text="CPU — · RAM — · Data —", style="Muted.TLabel"); self.resource_label.pack(side="right")

        remote = tk.Frame(outer, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); remote.pack(fill="x", pady=(0, 10))
        left_remote = tk.Frame(remote, bg=PANEL); left_remote.pack(side="left", fill="x", expand=True, padx=12, pady=9)
        tk.Label(left_remote, text="TQS SERVER / УДАЛЁННЫЙ ДОСТУП", bg=PANEL, fg=MUTED, font=("Segoe UI Semibold", 8)).pack(anchor="w")
        self.remote_value = tk.Label(left_remote, text="Проверяю…", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 11)); self.remote_value.pack(anchor="w", pady=(2, 0))
        self.remote_detail = tk.Label(left_remote, text="", bg=PANEL, fg=MUTED, font=("Segoe UI", 8)); self.remote_detail.pack(anchor="w")
        remote_actions = tk.Frame(remote, bg=PANEL); remote_actions.pack(side="right", padx=8, pady=8)
        ttk.Button(remote_actions, text="Настроить сервер", command=self.setup_server).pack(side="left", padx=4)
        ttk.Button(remote_actions, text="Скопировать адрес для Mac", command=self.copy_remote_url).pack(side="left", padx=4)
        ttk.Button(remote_actions, text="Открыть remote", style="Primary.TButton", command=self.open_remote).pack(side="left", padx=4)

        support = ttk.Frame(outer); support.pack(fill="x", pady=(0, 10))
        ttk.Label(support, text="Если что-то непонятно — нажми одну кнопку и вставь результат в ChatGPT.", style="Muted.TLabel").pack(side="left")
        ttk.Button(support, text="Скопировать для ChatGPT", style="Primary.TButton", command=self.copy_diagnostics).pack(side="right")
        self.log_toggle_button = ttk.Button(support, text="Показать техлог", command=self.toggle_log)
        self.log_toggle_button.pack(side="right", padx=(0, 8))

        content = ttk.Frame(outer); content.pack(fill="both", expand=True); content.columnconfigure(0, weight=1); content.columnconfigure(1, weight=0); content.rowconfigure(0, weight=1)
        self.content_frame = content
        lp = tk.Frame(content, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); lp.grid(row=0, column=0, sticky="nsew")
        rp = tk.Frame(content, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); rp.grid(row=0, column=1, sticky="nsew", padx=(12, 0))
        self.log_panel = rp
        self.log_visible = False
        tk.Label(lp, text="ЧТО ПРОИСХОДИТ / ПОСЛЕДНИЕ ДЕЙСТВИЯ", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 9)).pack(anchor="w", padx=12, pady=(10, 4))
        self.activity = tk.Text(lp, bg="#0b0f12", fg="#cfd6dc", insertbackground=TEXT, relief="flat", font=("Cascadia Mono", 9), wrap="word"); self.activity.pack(fill="both", expand=True, padx=10, pady=(4, 10)); self.activity.configure(state="disabled")
        tk.Label(rp, text="ТЕХНИЧЕСКИЙ ЛОГ · ДЛЯ ДИАГНОСТИКИ", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 9)).pack(anchor="w", padx=12, pady=(10, 4))
        self.log = tk.Text(rp, bg="#070a0c", fg="#9bc4a9", insertbackground=TEXT, relief="flat", font=("Cascadia Mono", 8), wrap="none"); self.log.pack(fill="both", expand=True, padx=10, pady=(4, 10)); self.log.configure(state="disabled")
        self.log_panel.grid_remove()

        foot = ttk.Frame(outer); foot.pack(fill="x", pady=(10, 0))
        self.branch_label = ttk.Label(foot, text="branch: —", style="Muted.TLabel"); self.branch_label.pack(side="left")
        ttk.Label(foot, text=str(self.root_dir), style="Muted.TLabel").pack(side="right")

    def toggle_log(self) -> None:
        self.log_visible = not bool(self.log_visible)
        if self.log_visible:
            self.content_frame.columnconfigure(0, weight=2)
            self.content_frame.columnconfigure(1, weight=1)
            self.log_panel.grid()
            self.log_toggle_button.configure(text="Скрыть техлог")
        else:
            self.log_panel.grid_remove()
            self.content_frame.columnconfigure(0, weight=1)
            self.content_frame.columnconfigure(1, weight=0)
            self.log_toggle_button.configure(text="Показать техлог")

    def _thread(self, fn, *args, exclusive: bool = False) -> None:
        if exclusive:
            with self._busy_lock:
                if self._busy:
                    self._event("Управляющая операция уже выполняется; остальные кнопки Launcher остаются доступны.")
                    return
                self._busy = True
        def run() -> None:
            try:
                fn(*args)
            except Exception as exc:
                self._event(f"ОШИБКА: {exc}")
            finally:
                if exclusive:
                    with self._busy_lock:
                        self._busy = False
                self.root.after(0, self.refresh_all)
        threading.Thread(target=run, daemon=True).start()

    def _event(self, text: str) -> None:
        line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {text}"
        self._events.appendleft(line)
        try:
            with self.launcher_event_log.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except Exception:
            pass
        self.root.after(0, self._render_activity)

    def _render_activity(self) -> None:
        state = self._read_update_state(); lines = list(self._events)
        hs = self.health_status()
        health = hs.get("payload") or {}
        if health:
            rr = health.get("research_runtime") or {}
            ai = self._owner_accounts or health.get("account_intelligence") or {}
            discovery = ai.get("discovery") or {}
            runtime = health.get("runtime") or {}
            control = health.get("control") or {}
            mode = str(control.get("mode") or "—").upper()
            if mode == "LIGHT":
                mode_note = "live-сбор работает · тяжёлые исследования ждут MAX"
            elif mode == "MAX":
                mode_note = "live-сбор + история + исследования работают"
            elif mode == "STOP":
                mode_note = "сбор и тяжёлая работа на паузе"
            else:
                mode_note = ""
            ah = rr.get("auto_history") or {}
            am = rr.get("auto_metrics") or {}
            remote = self._remote_cache or {}
            remote_note = ""
            if remote.get("enabled"):
                remote_note = f"SERVER: {'ONLINE' if remote.get('ready') else 'НАСТРОЕН'} · {remote.get('remote_url') or 'URL определяется'} · автообновление {int(remote.get('update_check_seconds') or 300)//60} мин"
            summary = [
                f"СЕЙЧАС: {rr.get('last_action') or runtime.get('last_action') or 'TQS работает'}",
                f"РЕЖИМ: {mode} · {mode_note}",
                f"РЫНОК: циклов этой сессии {runtime.get('refresh_count', 0)}",
                f"АВТОИСТОРИЯ: готово {ah.get('done', 0)}/{ah.get('target_total', 0)} · осталось {ah.get('remaining', 0)}",
                f"АВТОМЕТРИКИ: готово {am.get('done', 0)}/{am.get('target_total', 0)} · осталось {am.get('remaining', 0)}",
                f"ПУБЛИЧНЫЕ СЧЕТА: найдено {discovery.get('discovered_accounts', 0)} · hot {ai.get('tracked_accounts', 0)} · позиций {ai.get('open_positions', 0)} · fills {ai.get('fills', 0)}",
            ]
            if remote_note:
                summary.append(remote_note)
            day = self._owner_summary or {}
            if day:
                st = day.get("status") or {}
                summary += [
                    "",
                    f"ЗА 24 ЧАСА: jobs {day.get('jobs_touched', 0)} · готово {st.get('done', 0)} · в работе/очереди {day.get('unfinished', 0)} · ошибок {day.get('failed', 0)}",
                    f"ДАННЫЕ +24Ч: свечей {day.get('candles_added', 0):,} · metric points {day.get('metric_points_added', 0):,}",
                    f"ИССЛЕДОВАНИЯ +24Ч: replay {day.get('replay_runs_done', 0)} · strategy runs {day.get('strategy_runs_done', 0)}",
                ]
                errors = day.get("recent_errors") or []
                if errors:
                    summary.append(f"ПОСЛЕДНЯЯ ОШИБКА: {errors[0].get('title_ru') or errors[0].get('id')} · {errors[0].get('error') or ''}")
            summary.append("")
            lines = summary + lines
        elif hs.get("processes_alive"):
            age = hs.get("last_ok_age_s")
            age_text = f"{age:.0f}с" if isinstance(age, (int, float)) else "—"
            lines = [
                "СЕЙЧАС: процессы TQS живы, но API занят и временно не ответил.",
                f"Последний успешный health: {age_text} назад · процессов {hs.get('process_count', 0)}.",
                "Работа не считается упавшей только из-за timeout; watchdog ждёт heartbeat supervisor.",
                "",
            ] + lines
        else:
            lines = ["СЕЙЧАС: TQS backend не запущен.", ""] + lines
        if state:
            lines.insert(0, "ОБНОВЛЕНИЕ: " + " · ".join(str(state.get(k) or "") for k in ("status", "step", "message") if state.get(k)))
            if state.get("error"): lines.insert(1, f"ОШИБКА ОБНОВЛЕНИЯ: {state['error']}")
        self.activity.configure(state="normal"); self.activity.delete("1.0", "end"); self.activity.insert("1.0", "\n".join(lines[:80]) or "Launcher готов. Запусти TQS или проверь обновление."); self.activity.configure(state="disabled")

    def _run_git(self, *args: str, timeout: int = 45, allow_fail: bool = False) -> tuple[int, str]:
        flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if os.name == "nt" else 0
        p = subprocess.run(
            ["git", "-C", str(self.repo_root), *args],
            text=True,
            capture_output=True,
            timeout=timeout,
            creationflags=flags,
        )
        text = ((p.stdout or "") + ("\n" + p.stderr if p.stderr else "")).strip()
        if p.returncode and not allow_fail: raise RuntimeError(text or f"git {' '.join(args)} failed: {p.returncode}")
        return p.returncode, text

    def git_state(self, fetch: bool = False) -> dict[str, Any]:
        branch = self._run_git("branch", "--show-current")[1].strip()
        if fetch and branch: self._run_git("fetch", "--prune", "origin", branch, timeout=90)
        head = self._run_git("rev-parse", "HEAD")[1].strip(); dirty = bool(self._run_git("status", "--porcelain")[1].strip())
        remote_ref = f"origin/{branch}" if branch else ""; remote_head = ""; ahead = behind = 0
        if remote_ref:
            code, remote_head = self._run_git("rev-parse", "--verify", remote_ref, allow_fail=True)
            if code == 0:
                _, counts = self._run_git("rev-list", "--left-right", "--count", f"HEAD...{remote_ref}"); parts = counts.split()
                if len(parts) >= 2: ahead, behind = int(parts[0]), int(parts[1])
            else: remote_head = ""
        return {"branch": branch, "head": head, "remote_head": remote_head.strip(), "ahead": ahead, "behind": behind, "dirty": dirty}

    def _api(self, path: str, method: str = "GET", payload: dict[str, Any] | None = None, timeout: int = 3) -> Any:
        data = None; headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8"); headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.url + path, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as response: return json.loads(response.read().decode("utf-8"))

    def _probe_health(self) -> dict[str, Any] | None:
        now = time.time()
        try:
            payload = self._api("/api/health", timeout=1)
            with self._health_lock:
                self._health_payload = payload
                self._health_last_ok_s = now
                self._health_error = ""
            return payload
        except Exception as exc:
            with self._health_lock:
                self._health_error = f"{type(exc).__name__}: {exc}"
            return None
        finally:
            with self._health_lock:
                self._health_last_probe_s = time.time()

    def _health_loop(self) -> None:
        while True:
            health = self._probe_health()
            now = time.time()
            if now - self._remote_last_s >= 15:
                try:
                    value = remote_node_status(self.root_dir)
                    if isinstance(value, dict):
                        self._remote_cache = value
                    self._remote_last_s = now
                except Exception:
                    pass
            if health is not None and now - self._owner_summary_last_s >= 15:
                try:
                    summary = self._api("/api/activity-summary?hours=24", timeout=2)
                    accounts = self._api("/api/accounts", timeout=2)
                    if isinstance(summary, dict):
                        self._owner_summary = summary
                    if isinstance(accounts, dict):
                        self._owner_accounts = accounts.get("status") or {}
                    self._owner_summary_last_s = now
                except Exception:
                    pass
            time.sleep(1.5)

    def health(self, max_age_s: float = 12.0) -> dict[str, Any] | None:
        with self._health_lock:
            payload = self._health_payload
            age = time.time() - self._health_last_ok_s if self._health_last_ok_s else 10**9
        return payload if payload is not None and age <= max_age_s else None

    def health_status(self) -> dict[str, Any]:
        with self._health_lock:
            age = time.time() - self._health_last_ok_s if self._health_last_ok_s else None
            error = self._health_error
            last_probe = self._health_last_probe_s
        processes = self._matching_tqs_processes()
        return {
            "payload": self.health(),
            "last_ok_age_s": round(age, 1) if age is not None else None,
            "last_probe_age_s": round(time.time() - last_probe, 1) if last_probe else None,
            "error": error,
            "process_count": len(processes),
            "processes_alive": bool(processes),
        }

    def _product_version(self) -> str:
        try:
            import tomllib
            data = tomllib.loads((self.root_dir / "pyproject.toml").read_text(encoding="utf-8")); return str(data.get("project", {}).get("version") or "—")
        except Exception: return "—"

    def refresh_git(self, fetch: bool = False) -> None:
        if fetch:
            self._event("Проверяю GitHub…")
        try:
            state = self.git_state(fetch=fetch)
        except subprocess.TimeoutExpired:
            if fetch:
                self._git_verified = False
                self._git_fetch_error = "GitHub/VPN не ответил вовремя"
                self._event("GitHub временно недоступен или медленный VPN. TQS продолжает работать; проверку обновлений можно повторить позже.")
            return
        except Exception as exc:
            if fetch:
                self._git_verified = False
                self._git_fetch_error = str(exc)[:300]
                self._event(f"Не удалось проверить GitHub: {str(exc)[:180]}. Это не останавливает TQS.")
            return
        self._git_cache = state
        if fetch:
            self._git_verified = True
            self._git_fetch_error = ""
            self._event(f"Есть обновление: +{state['behind']} commit(ов)" if state["behind"] > 0 else "Локальная версия подтверждена GitHub")

    def refresh_all(self) -> None:
        try:
            if not hasattr(self, "_git_cache"): self._git_cache = self.git_state(fetch=False)
        except Exception as exc: self._git_cache = {"branch":"?", "head":"", "remote_head":"", "ahead":0, "behind":0, "dirty":False, "error":str(exc)}
        g = self._git_cache; hs = self.health_status(); h = hs.get("payload"); version = self._product_version(); self.version_label.configure(text=f"product v{version}"); self.branch_label.configure(text=f"branch: {g.get('branch') or '—'}")
        local = (g.get("head") or "")[:8] or "—"; remote = (g.get("remote_head") or "")[:8] or "—"
        self.cards["local"][0].configure(text=local, fg=AMBER if g.get("dirty") else TEXT); self.cards["local"][1].configure(text="есть локальные изменения" if g.get("dirty") else "working tree clean")
        self.cards["remote"][0].configure(text=remote); self.cards["remote"][1].configure(text=f"behind {g.get('behind',0)} · ahead {g.get('ahead',0)}")
        if h:
            self.cards["backend"][0].configure(text="ONLINE", fg=GREEN); self.cards["backend"][1].configure(text="health OK")
            mode = str((h.get("control") or {}).get("mode") or "—").upper(); self.cards["mode"][0].configure(text=mode, fg=AMBER if mode == "MAX" else GREEN if mode == "LIGHT" else RED)
            self.cards["mode"][1].configure(text=str((h.get("research_runtime") or {}).get("last_action") or "")); res = h.get("resources") or {}; self.resource_label.configure(text=f"CPU {res.get('cpu_percent','—')}% · RAM {res.get('memory_percent','—')}% · Data {res.get('data_disk_free_gb','—')} GB free")
        elif hs.get("processes_alive"):
            age = hs.get("last_ok_age_s")
            age_text = f"{age:.0f}с" if isinstance(age, (int, float)) else "—"
            self.cards["backend"][0].configure(text="ЗАНЯТ", fg=AMBER)
            self.cards["backend"][1].configure(text=f"процессы живы · API не ответил {age_text}")
            try:
                control = json.loads((self.data_dir / "control.json").read_text(encoding="utf-8"))
                mode = str(control.get("mode") or "—").upper()
            except Exception:
                mode = "—"
            self.cards["mode"][0].configure(text=mode, fg=AMBER)
            self.cards["mode"][1].configure(text="работа не прерывается; Launcher не будет перезапускать процесс из-за одного timeout")
            vm = psutil.virtual_memory(); self.resource_label.configure(text=f"CPU {psutil.cpu_percent()}% · RAM {vm.percent}% · health timeout")
        else:
            self.cards["backend"][0].configure(text="OFFLINE", fg=RED); self.cards["backend"][1].configure(text="процессов TQS нет"); self.cards["mode"][0].configure(text="—"); self.cards["mode"][1].configure(text="backend offline"); vm = psutil.virtual_memory(); self.resource_label.configure(text=f"CPU {psutil.cpu_percent()}% · RAM {vm.percent}%")
        remote = self._remote_cache or {}
        if remote.get("enabled"):
            if remote.get("ready"):
                self.remote_value.configure(text="REMOTE ONLINE", fg=GREEN)
            elif remote.get("stopped_by_owner"):
                self.remote_value.configure(text="SERVER ОСТАНОВЛЕН", fg=RED)
            else:
                self.remote_value.configure(text="SERVER НАСТРОЕН", fg=AMBER)
            url = remote.get("remote_url") or "адрес Tailscale пока не определён"
            task = "автозапуск ON" if (remote.get("scheduled_task") or {}).get("installed") else "автозапуск ?"
            ts = "Tailscale ON" if remote.get("tailscale_online") else "Tailscale ждёт"
            self.remote_detail.configure(text=f"{url} · {task} · {ts} · update {int(remote.get('update_check_seconds') or 300)//60} мин")
        else:
            self.remote_value.configure(text="НЕ НАСТРОЕН", fg=MUTED)
            self.remote_detail.configure(text="Один раз нажми «Настроить сервер»: автозапуск + приватный доступ с Mac + автообновления")

        if g.get("error"): self._set_banner("Не удалось определить локальную версию", MUTED, g["error"])
        elif g.get("dirty"): self._set_banner("Локальные изменения — автообновление заблокировано", AMBER, f"LOCAL {local} · REMOTE {remote}")
        elif self._git_fetch_error: self._set_banner("GitHub временно недоступен", MUTED, f"LOCAL v{version} · commit {local} · TQS продолжает работать")
        elif self._git_verified and g.get("behind", 0) > 0: self._set_banner("ЕСТЬ ОБНОВЛЕНИЕ", AMBER, f"LOCAL {local} → REMOTE {remote} · +{g['behind']} commit")
        elif self._git_verified and remote != "—" and local == remote: self._set_banner("АКТУАЛЬНАЯ ВЕРСИЯ", GREEN, f"v{version} · commit {local} · проверено по GitHub")
        else: self._set_banner("Локальная версия", MUTED, f"v{version} · commit {local} · сверяю с GitHub…")
        self._render_activity(); self._refresh_log()

    def _set_banner(self, title: str, color: str, detail: str) -> None:
        self.status_dot.configure(fg=color); self.status_title.configure(text=title); self.status_detail.configure(text=detail)

    def open_tqs(self) -> None:
        build = str((getattr(self, "_git_cache", {}) or {}).get("head") or "")[:12]
        suffix = f"?build={build}" if build else f"?t={int(time.time())}"
        webbrowser.open(self.url + "/" + suffix)


    def setup_server(self) -> None:
        def work() -> None:
            if os.name != "nt":
                raise RuntimeError("Автонастройка сервера сейчас предназначена для Windows-узла TQS")
            if not self.server_setup_script.exists():
                raise RuntimeError("setup-server-windows.ps1 не найден")
            script = str(self.server_setup_script).replace("'", "''")
            command = (
                "$p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru "
                f"-ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','{script}'); "
                "exit $p.ExitCode"
            )
            self._event("SERVER: запускаю одноразовую настройку Windows + Tailscale. Подтверди UAC и вход Tailscale, если Windows попросит.")
            proc = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], text=True, capture_output=True, timeout=420)
            if proc.returncode != 0:
                raise RuntimeError(((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()[-1200:] or f"server setup exit {proc.returncode}")
            self._remote_cache = remote_node_status(self.root_dir)
            self._remote_last_s = time.time()
            if self._remote_cache.get("ready"):
                self._event(f"SERVER READY: {self._remote_cache.get('remote_url')}")
            else:
                self._event("SERVER настроен. Если Tailscale просил подтверждение HTTPS/логина, заверши его и нажми «Настроить сервер» ещё раз.")
        self._thread(work, exclusive=True)

    def copy_remote_url(self) -> None:
        remote = self._remote_cache or remote_node_status(self.root_dir)
        url = str(remote.get("remote_url") or "")
        if not url:
            self._event("Remote URL пока не определён. Сначала настрой сервер/Tailscale.")
            return
        self.root.clipboard_clear(); self.root.clipboard_append(url); self.root.update()
        self._event(f"Адрес для Mac скопирован: {url}")

    def open_remote(self) -> None:
        remote = self._remote_cache or remote_node_status(self.root_dir)
        url = str(remote.get("remote_url") or "")
        if not url:
            self._event("Remote URL пока не определён. Сначала настрой сервер/Tailscale.")
            return
        webbrowser.open(url)

    def _diagnostic_text(self) -> str:
        g = getattr(self, "_git_cache", {}) or {}
        hs = self.health_status()
        payload = hs.get("payload") or self._health_payload or {}
        sections = [
            "TQS DIAGNOSTICS — вставь этот блок в ChatGPT целиком",
            f"Время: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Product: v{self._product_version()}",
            f"Branch: {g.get('branch') or '—'}",
            f"LOCAL: {(g.get('head') or '')[:12] or '—'}",
            f"REMOTE: {(g.get('remote_head') or '')[:12] or '—'} · behind {g.get('behind',0)} · ahead {g.get('ahead',0)}",
            f"Working tree: {'DIRTY' if g.get('dirty') else 'clean'}",
            f"Health: {'ONLINE' if hs.get('payload') else 'BUSY/UNAVAILABLE' if hs.get('processes_alive') else 'OFFLINE'} · last OK age {hs.get('last_ok_age_s')}s · processes {hs.get('process_count')}",
            f"Health error: {hs.get('error') or '—'}",
            "",
            "=== OWNER SUMMARY 24H ===",
            json.dumps(self._owner_summary or {}, ensure_ascii=False, indent=2, default=str),
            "",
            "=== ACCOUNT SUMMARY ===",
            json.dumps(self._owner_accounts or {}, ensure_ascii=False, indent=2, default=str),
            "",
            "=== REMOTE NODE ===",
            json.dumps(self._remote_cache or {}, ensure_ascii=False, indent=2, default=str),
            "",
            "=== HEALTH / RUNTIME SUMMARY ===",
            json.dumps({
                "control": payload.get("control"),
                "runtime": payload.get("runtime"),
                "research_runtime": payload.get("research_runtime"),
                "account_intelligence": payload.get("account_intelligence"),
                "resources": payload.get("resources"),
                "storage": payload.get("storage"),
                "lab": payload.get("lab"),
            }, ensure_ascii=False, indent=2, default=str),
        ]
        for filename, title in (("supervisor-heartbeat.json", "SUPERVISOR HEARTBEAT"), ("control.json", "CONTROL"), ("update-state.json", "UPDATE STATE")):
            p = self.data_dir / filename
            try:
                content = p.read_text(encoding="utf-8-sig")
            except Exception as exc:
                content = f"unavailable: {exc}"
            sections += ["", f"=== {title} ===", content]
        for endpoint, title in (("/api/jobs?limit=80", "RECENT JOBS"), ("/api/data-lake", "DATA LAKE")):
            try:
                value = self._api(endpoint, timeout=2)
                content = json.dumps(value, ensure_ascii=False, indent=2, default=str)
            except Exception as exc:
                content = f"unavailable: {type(exc).__name__}: {exc}"
            sections += ["", f"=== {title} ===", content]
        sections += ["", "=== LAUNCHER EVENTS ===", "\n".join(list(self._events)[:100])]
        try:
            log_tail = "\n".join(self.runtime_log.read_text(encoding="utf-8", errors="replace").splitlines()[-180:])
        except Exception as exc:
            log_tail = f"unavailable: {exc}"
        sections += ["", "=== RUNTIME LOG TAIL ===", log_tail]
        return "\n".join(sections)

    def copy_diagnostics(self) -> None:
        def work() -> None:
            text = self._diagnostic_text()
            folder = self.data_dir / "diagnostics"; folder.mkdir(parents=True, exist_ok=True)
            path = folder / f"TQS-DIAGNOSTICS-{time.strftime('%Y%m%d-%H%M%S')}.txt"
            path.write_text(text, encoding="utf-8")
            def copy_ui() -> None:
                self.root.clipboard_clear(); self.root.clipboard_append(text); self.root.update()
                self._event(f"Диагностика скопирована для ChatGPT · {path}")
            self.root.after(0, copy_ui)
        self._thread(work)

    def _read_update_state(self) -> dict[str, Any] | None:
        try: return json.loads(self.update_state.read_text(encoding="utf-8-sig")) if self.update_state.exists() else None
        except Exception: return None

    def _refresh_log(self) -> None:
        text = ""
        try:
            if self.runtime_log.exists(): text = "".join(self.runtime_log.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)[-120:])
        except Exception: pass
        if not text:
            try:
                rows = self._api("/api/logs?limit=80", timeout=2); text = "\n".join(f"{r.get('level','')} {r.get('component','')}: {r.get('message','')}" for r in reversed(rows))
            except Exception: text = "Backend offline. Runtime log появится после запуска через Launcher."
        if text != self._last_log_text:
            self._last_log_text = text; self.log.configure(state="normal"); self.log.delete("1.0", "end"); self.log.insert("1.0", text); self.log.see("end"); self.log.configure(state="disabled")

    def _matching_tqs_processes(self) -> list[psutil.Process]:
        out = []; me = os.getpid()
        for proc in psutil.process_iter(["pid", "cmdline"]):
            try:
                if proc.pid == me: continue
                cmd = " ".join(proc.info.get("cmdline") or []).lower()
                if "tqs_intelligence.supervisor" in cmd or "tqs_intelligence.api" in cmd or ("uvicorn" in cmd and "tqs_intelligence" in cmd): out.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied): pass
        return out

    def start_backend(self) -> None: self._thread(self._start_backend, exclusive=True)
    def _start_backend(self) -> None:
        if self._probe_health(): self._event("TQS уже запущен"); return
        if not self.python.exists(): raise RuntimeError(".venv не найден. Один раз запусти install-windows.cmd")
        marker = stop_marker_path(self.root_dir)
        try:
            if marker.exists(): marker.unlink()
        except Exception:
            pass
        if server_mode_enabled(self.root_dir) and request_server_task_start(self.root_dir):
            self._event("SERVER: запускаю автозапуск-задачу TQS…")
        else:
            self._event("Запускаю TQS backend…")
            log_handle = self.runtime_log.open("a", encoding="utf-8"); flags = 0
            if os.name == "nt": flags = int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)) | int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
            subprocess.Popen([str(self.python), "-m", "tqs_intelligence.supervisor"], cwd=str(self.root_dir), stdout=log_handle, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, creationflags=flags, close_fds=True)
        for _ in range(60):
            if self._probe_health(): self._event("TQS ONLINE"); return
            time.sleep(1)
        raise RuntimeError("TQS не прошёл healthcheck за 60 секунд")

    def stop_backend(self) -> None: self._thread(self._stop_backend, exclusive=True)
    def _stop_backend(self) -> None:
        if server_mode_enabled(self.root_dir):
            try:
                stop_marker_path(self.root_dir).write_text("owner requested stop\n", encoding="utf-8")
            except Exception:
                pass
        procs = self._matching_tqs_processes()
        if not procs: self._event("TQS уже остановлен"); return
        self._event(f"Останавливаю TQS ({len(procs)} процессов)…")
        for p in procs:
            try: p.terminate()
            except Exception: pass
        _, alive = psutil.wait_procs(procs, timeout=8)
        for p in alive:
            try: p.kill()
            except Exception: pass
        self._event("TQS остановлен")

    def restart_backend(self) -> None:
        def work(): self._stop_backend(); time.sleep(1); self._start_backend()
        self._thread(work, exclusive=True)

    def run_update(self) -> None: self._thread(self._run_update, exclusive=True)

    def _restart_launcher_process(self) -> None:
        if not self.python.exists():
            self._event("Launcher обновлён. Закрой и открой его вручную.")
            return
        flags = 0
        if os.name == "nt":
            flags = int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)) | int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
        subprocess.Popen(
            [str(self.python), "-m", "tqs_intelligence.launcher_entry"],
            cwd=str(self.root_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
        self.root.after(700, self.root.destroy)

    def _run_update(self) -> None:
        try:
            g = self.git_state(fetch=True)
        except subprocess.TimeoutExpired as exc:
            self._git_verified = False
            self._git_fetch_error = "GitHub/VPN не ответил вовремя"
            raise RuntimeError("GitHub/VPN не ответил при проверке обновления. TQS не остановлен; повтори позже.") from exc
        self._git_cache = g; self._git_verified = True; self._git_fetch_error = ""
        if g["dirty"]: raise RuntimeError("Есть незакоммиченные локальные изменения. Обновление остановлено для защиты файлов.")
        if g["behind"] <= 0: self._event("Обновление не требуется — локальный commit последний"); return
        if server_mode_enabled(self.root_dir):
            self._event(f"SERVER UPDATE: ставлю {g['head'][:8]} → {g['remote_head'][:8]} через supervisor без остановки server task…")
            self._api("/api/system/update", method="POST", payload=None, timeout=5)
            deadline = time.time() + 600
            last = None
            while time.time() < deadline:
                state = self._read_update_state()
                if state and state != last:
                    last = state
                    self._event("UPDATE: " + " · ".join(str(state.get(k) or "") for k in ("step", "message") if state.get(k)))
                    if state.get("status") in {"success", "noop", "rolled_back", "failed", "blocked"}:
                        break
                time.sleep(1)
            state = self._read_update_state() or {}
            if state.get("status") in {"failed", "rolled_back", "blocked"}:
                raise RuntimeError(state.get("error") or state.get("message") or "server update failed")
            self.refresh_git(fetch=False)
            self._event("SERVER UPDATE завершён. TQS продолжает работать; перезапускаю Launcher на новом коде.")
            self.root.after(0, self._restart_launcher_process)
            return
        if not self.update_script.exists(): raise RuntimeError("update-windows.ps1 не найден")
        self._event(f"Запускаю обновление {g['head'][:8]} → {g['remote_head'][:8]}…")
        flags = int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)) | int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if os.name == "nt" else 0
        p = subprocess.Popen(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(self.update_script), "-NoBrowser"], cwd=str(self.root_dir), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, creationflags=flags, close_fds=True)
        deadline = time.time() + 600; last = None
        while time.time() < deadline:
            state = self._read_update_state()
            if state and state != last:
                last = state; self._event("UPDATE: " + " · ".join(str(state.get(k) or "") for k in ("step", "message") if state.get(k)))
                if state.get("status") in {"success", "noop", "rolled_back", "failed"}: break
            if p.poll() is not None and state and state.get("status") not in {"running"}: break
            time.sleep(1)
        self.refresh_git(fetch=False); state = self._read_update_state() or {}
        if state.get("status") in {"failed", "rolled_back"}: raise RuntimeError(state.get("error") or state.get("message") or "update failed")
        build = str((self._git_cache or {}).get("head") or "")[:12]
        try:
            webbrowser.open(self.url + "/" + (f"?build={build}" if build else f"?t={int(time.time())}"))
        except Exception:
            pass
        self._event("Обновление завершено. Открываю текущий build и перезапускаю Launcher…")
        self.root.after(0, self._restart_launcher_process)

    def _write_control_mode_fallback(self, mode: str) -> None:
        path = self.data_dir / "control.json"
        try:
            raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            if not isinstance(raw, dict):
                raw = {}
        except Exception:
            raw = {}
        raw["mode"] = mode
        raw["changed_by"] = "launcher-fallback"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)

    def set_mode(self, mode: str) -> None:
        mode = str(mode).lower()
        if mode not in {"stop", "light", "max"}:
            self._event(f"ОШИБКА: неизвестный режим {mode}")
            return
        def work() -> None:
            try:
                self._api("/api/control", method="POST", payload={"mode": mode}, timeout=2)
                self._event(f"Режим: {mode.upper()} · подтверждён backend")
            except Exception as exc:
                self._write_control_mode_fallback(mode)
                self._event(
                    f"Режим: {mode.upper()} · записан локально, API был занят ({type(exc).__name__}); "
                    "backend подхватит изменение автоматически"
                )
        self._thread(work)

    def export_snapshot(self) -> None:
        def work():
            result = self._api("/api/export/snapshot", method="POST", payload={"full": False}, timeout=120); self._event(f"TQS snapshot: {result.get('zip_path') or result}")
        self._thread(work)

    def _poll(self) -> None:
        if not self._busy:
            try: self.refresh_all()
            except Exception: pass
        self.root.after(3000, self._poll)

    def run(self) -> int:
        self.root.mainloop(); return 0


def main() -> None:
    raise SystemExit(TQSLauncher().run())


if __name__ == "__main__": main()
