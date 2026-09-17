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
        self.update_state = self.data_dir / "update-state.json"
        self.python = self.root_dir / ".venv" / "Scripts" / "python.exe"
        self.update_script = self.root_dir / "update-windows.ps1"
        self.url = "http://127.0.0.1:8787"
        self._busy = False
        self._last_log_text = ""
        self._events: deque[str] = deque(maxlen=100)

        self.root = tk.Tk()
        self.root.title("TQS Launcher")
        self.root.geometry("1040x760")
        self.root.minsize(900, 650)
        self.root.configure(bg=BG)
        self._setup_style()
        self._build_ui()
        self.root.after(250, self.refresh_all)
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
        ttk.Button(actions, text="Открыть TQS", style="Primary.TButton", command=lambda: webbrowser.open(self.url)).pack(side="left", padx=6)
        ttk.Separator(actions, orient="vertical").pack(side="left", fill="y", padx=10)
        ttk.Button(actions, text="Проверить обновление", command=lambda: self._thread(self.refresh_git, True)).pack(side="left", padx=6)
        ttk.Button(actions, text="⬆ Обновить", style="Primary.TButton", command=self.run_update).pack(side="left", padx=6)
        ttk.Button(actions, text="Сохранить TQS", command=self.export_snapshot).pack(side="right", padx=(6, 0))

        modes = ttk.Frame(outer); modes.pack(fill="x", pady=(0, 12))
        ttk.Label(modes, text="Нагрузка:", style="Muted.TLabel").pack(side="left", padx=(0, 8))
        ttk.Button(modes, text="СТОП", command=lambda: self.set_mode("stop")).pack(side="left", padx=4)
        ttk.Button(modes, text="ЛАЙТ", command=lambda: self.set_mode("light")).pack(side="left", padx=4)
        ttk.Button(modes, text="МАКС", command=lambda: self.set_mode("max")).pack(side="left", padx=4)
        self.resource_label = ttk.Label(modes, text="CPU — · RAM — · Data —", style="Muted.TLabel"); self.resource_label.pack(side="right")

        content = ttk.Frame(outer); content.pack(fill="both", expand=True); content.columnconfigure(0, weight=1); content.columnconfigure(1, weight=1); content.rowconfigure(0, weight=1)
        lp = tk.Frame(content, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); lp.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        rp = tk.Frame(content, bg=PANEL, highlightbackground=BORDER, highlightthickness=1); rp.grid(row=0, column=1, sticky="nsew", padx=(6, 0))
        tk.Label(lp, text="СОСТОЯНИЕ / ПОСЛЕДНИЕ ДЕЙСТВИЯ", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 9)).pack(anchor="w", padx=12, pady=(10, 4))
        self.activity = tk.Text(lp, bg="#0b0f12", fg="#cfd6dc", insertbackground=TEXT, relief="flat", font=("Cascadia Mono", 9), wrap="word"); self.activity.pack(fill="both", expand=True, padx=10, pady=(4, 10)); self.activity.configure(state="disabled")
        tk.Label(rp, text="RUNTIME LOG", bg=PANEL, fg=TEXT, font=("Segoe UI Semibold", 9)).pack(anchor="w", padx=12, pady=(10, 4))
        self.log = tk.Text(rp, bg="#070a0c", fg="#9bc4a9", insertbackground=TEXT, relief="flat", font=("Cascadia Mono", 8), wrap="none"); self.log.pack(fill="both", expand=True, padx=10, pady=(4, 10)); self.log.configure(state="disabled")

        foot = ttk.Frame(outer); foot.pack(fill="x", pady=(10, 0))
        self.branch_label = ttk.Label(foot, text="branch: —", style="Muted.TLabel"); self.branch_label.pack(side="left")
        ttk.Label(foot, text=str(self.root_dir), style="Muted.TLabel").pack(side="right")

    def _thread(self, fn, *args) -> None:
        if self._busy: return
        self._busy = True
        def run() -> None:
            try: fn(*args)
            except Exception as exc: self._event(f"ОШИБКА: {exc}")
            finally:
                self._busy = False
                self.root.after(0, self.refresh_all)
        threading.Thread(target=run, daemon=True).start()

    def _event(self, text: str) -> None:
        self._events.appendleft(f"[{time.strftime('%H:%M:%S')}] {text}")
        self.root.after(0, self._render_activity)

    def _render_activity(self) -> None:
        state = self._read_update_state(); lines = list(self._events)
        if state:
            lines.insert(0, "UPDATE: " + " · ".join(str(state.get(k) or "") for k in ("status", "step", "message") if state.get(k)))
            if state.get("error"): lines.insert(1, f"UPDATE ERROR: {state['error']}")
        self.activity.configure(state="normal"); self.activity.delete("1.0", "end"); self.activity.insert("1.0", "\n".join(lines[:80]) or "Launcher готов. Запусти TQS или проверь обновление."); self.activity.configure(state="disabled")

    def _run_git(self, *args: str, timeout: int = 45, allow_fail: bool = False) -> tuple[int, str]:
        p = subprocess.run(["git", "-C", str(self.repo_root), *args], text=True, capture_output=True, timeout=timeout)
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

    def health(self) -> dict[str, Any] | None:
        try: return self._api("/api/health", timeout=2)
        except Exception: return None

    def _product_version(self) -> str:
        try:
            import tomllib
            data = tomllib.loads((self.root_dir / "pyproject.toml").read_text(encoding="utf-8")); return str(data.get("project", {}).get("version") or "—")
        except Exception: return "—"

    def refresh_git(self, fetch: bool = False) -> None:
        if fetch: self._event("Проверяю GitHub…")
        state = self.git_state(fetch=fetch); self._git_cache = state
        if fetch: self._event(f"Есть обновление: +{state['behind']} commit(ов)" if state["behind"] > 0 else "Локальная версия совпадает с GitHub")

    def refresh_all(self) -> None:
        try:
            if not hasattr(self, "_git_cache"): self._git_cache = self.git_state(fetch=False)
        except Exception as exc: self._git_cache = {"branch":"?", "head":"", "remote_head":"", "ahead":0, "behind":0, "dirty":False, "error":str(exc)}
        g = self._git_cache; h = self.health(); version = self._product_version(); self.version_label.configure(text=f"product v{version}"); self.branch_label.configure(text=f"branch: {g.get('branch') or '—'}")
        local = (g.get("head") or "")[:8] or "—"; remote = (g.get("remote_head") or "")[:8] or "—"
        self.cards["local"][0].configure(text=local, fg=AMBER if g.get("dirty") else TEXT); self.cards["local"][1].configure(text="есть локальные изменения" if g.get("dirty") else "working tree clean")
        self.cards["remote"][0].configure(text=remote); self.cards["remote"][1].configure(text=f"behind {g.get('behind',0)} · ahead {g.get('ahead',0)}")
        if h:
            self.cards["backend"][0].configure(text="ONLINE", fg=GREEN); self.cards["backend"][1].configure(text="health OK")
            mode = str((h.get("control") or {}).get("mode") or "—").upper(); self.cards["mode"][0].configure(text=mode, fg=AMBER if mode == "MAX" else GREEN if mode == "LIGHT" else RED)
            self.cards["mode"][1].configure(text=str((h.get("research_runtime") or {}).get("last_action") or "")); res = h.get("resources") or {}; self.resource_label.configure(text=f"CPU {res.get('cpu_percent','—')}% · RAM {res.get('memory_percent','—')}% · Data {res.get('data_disk_free_gb','—')} GB free")
        else:
            self.cards["backend"][0].configure(text="OFFLINE", fg=RED); self.cards["backend"][1].configure(text="TQS не отвечает"); self.cards["mode"][0].configure(text="—"); self.cards["mode"][1].configure(text="backend offline"); vm = psutil.virtual_memory(); self.resource_label.configure(text=f"CPU {psutil.cpu_percent()}% · RAM {vm.percent}%")
        if g.get("error"): self._set_banner("Не удалось определить версию", MUTED, g["error"])
        elif g.get("dirty"): self._set_banner("Локальные изменения — автообновление заблокировано", AMBER, f"LOCAL {local} · REMOTE {remote}")
        elif g.get("behind", 0) > 0: self._set_banner("ЕСТЬ ОБНОВЛЕНИЕ", AMBER, f"LOCAL {local} → REMOTE {remote} · +{g['behind']} commit")
        elif remote != "—" and local == remote: self._set_banner("АКТУАЛЬНАЯ ВЕРСИЯ", GREEN, f"v{version} · commit {local}")
        else: self._set_banner("Версия не проверена по сети", MUTED, f"LOCAL {local} · нажми «Проверить обновление»")
        self._render_activity(); self._refresh_log()

    def _set_banner(self, title: str, color: str, detail: str) -> None:
        self.status_dot.configure(fg=color); self.status_title.configure(text=title); self.status_detail.configure(text=detail)

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

    def start_backend(self) -> None: self._thread(self._start_backend)
    def _start_backend(self) -> None:
        if self.health(): self._event("TQS уже запущен"); return
        if not self.python.exists(): raise RuntimeError(".venv не найден. Один раз запусти install-windows.cmd")
        self._event("Запускаю TQS backend…"); log_handle = self.runtime_log.open("a", encoding="utf-8"); flags = 0
        if os.name == "nt": flags = int(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)) | int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
        subprocess.Popen([str(self.python), "-m", "tqs_intelligence.supervisor"], cwd=str(self.root_dir), stdout=log_handle, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, creationflags=flags, close_fds=True)
        for _ in range(60):
            if self.health(): self._event("TQS ONLINE"); return
            time.sleep(1)
        raise RuntimeError("TQS не прошёл healthcheck за 60 секунд")

    def stop_backend(self) -> None: self._thread(self._stop_backend)
    def _stop_backend(self) -> None:
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
        self._thread(work)

    def run_update(self) -> None: self._thread(self._run_update)
    def _run_update(self) -> None:
        g = self.git_state(fetch=True); self._git_cache = g
        if g["dirty"]: raise RuntimeError("Есть незакоммиченные локальные изменения. Обновление остановлено для защиты файлов.")
        if g["behind"] <= 0: self._event("Обновление не требуется — локальный commit последний"); return
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
        self._event("Обновление завершено. Версия перечитана из Git.")

    def set_mode(self, mode: str) -> None:
        def work(): self._api("/api/control", method="POST", payload={"mode": mode}, timeout=5); self._event(f"Режим: {mode.upper()}")
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
