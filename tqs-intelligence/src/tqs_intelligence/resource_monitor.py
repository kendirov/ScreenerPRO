from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import psutil


class ResourceMonitor:
    """Small in-process observability sampler for the owner dashboard.

    It intentionally exposes operational metadata only. It does not provide an
    arbitrary process-kill or shell surface.
    """

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self._lock = threading.RLock()
        self._prev_proc_cpu: dict[int, tuple[float, float]] = {}
        self._prev_disk: tuple[float, int, int] | None = None
        self._prev_net: tuple[float, int, int] | None = None

    @staticmethod
    def _category(cmd: str, name: str) -> str:
        low = f"{name} {cmd}".lower()
        if "tqs_intelligence.supervisor" in low:
            return "supervisor"
        if "uvicorn" in low and "tqs_intelligence" in low:
            return "backend"
        if "tqs_intelligence.launcher" in low:
            return "launcher"
        if "ai-bridge-windows.ps1" in low:
            return "ai-bridge"
        if "tailscale" in low:
            return "tailscale"
        return "other"

    def _proc_rows(self, now: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        rows: list[dict[str, Any]] = []
        current_pids: set[int] = set()
        for proc in psutil.process_iter(["pid", "name", "cmdline", "memory_info", "num_threads", "status"]):
            try:
                pid = int(proc.info["pid"])
                current_pids.add(pid)
                name = str(proc.info.get("name") or "")
                cmd = " ".join(proc.info.get("cmdline") or [])
                times = proc.cpu_times()
                cpu_total = float(times.user + times.system)
                previous = self._prev_proc_cpu.get(pid)
                cpu_percent = 0.0
                if previous is not None:
                    prev_cpu, prev_ts = previous
                    elapsed = max(0.001, now - prev_ts)
                    cpu_percent = max(0.0, (cpu_total - prev_cpu) / elapsed * 100.0)
                self._prev_proc_cpu[pid] = (cpu_total, now)
                rss = getattr(proc.info.get("memory_info"), "rss", 0) or 0
                category = self._category(cmd, name)
                rows.append(
                    {
                        "pid": pid,
                        "name": name,
                        "category": category,
                        "cpu_percent": round(cpu_percent, 1),
                        "memory_mb": round(float(rss) / (1024**2), 1),
                        "threads": int(proc.info.get("num_threads") or 0),
                        "status": str(proc.info.get("status") or ""),
                        "command": cmd[:300],
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception:
                continue

        for pid in list(self._prev_proc_cpu):
            if pid not in current_pids:
                self._prev_proc_cpu.pop(pid, None)

        tqs = [
            x
            for x in rows
            if x["category"] != "other"
            or "tqs" in x["command"].lower()
            or "tqs" in x["name"].lower()
        ]
        tqs.sort(key=lambda x: (x["cpu_percent"], x["memory_mb"]), reverse=True)

        top = sorted(rows, key=lambda x: (x["cpu_percent"], x["memory_mb"]), reverse=True)[:12]
        return tqs[:30], top

    def _io_rates(self, now: float) -> tuple[dict[str, Any], dict[str, Any]]:
        disk = psutil.disk_io_counters()
        net = psutil.net_io_counters()
        disk_rate = {"read_mb_s": 0.0, "write_mb_s": 0.0}
        net_rate = {"recv_mb_s": 0.0, "sent_mb_s": 0.0}

        if disk is not None:
            if self._prev_disk is not None:
                ts, read_b, write_b = self._prev_disk
                dt = max(0.001, now - ts)
                disk_rate = {
                    "read_mb_s": round(max(0, int(disk.read_bytes) - read_b) / dt / (1024**2), 2),
                    "write_mb_s": round(max(0, int(disk.write_bytes) - write_b) / dt / (1024**2), 2),
                }
            self._prev_disk = (now, int(disk.read_bytes), int(disk.write_bytes))

        if net is not None:
            if self._prev_net is not None:
                ts, recv_b, sent_b = self._prev_net
                dt = max(0.001, now - ts)
                net_rate = {
                    "recv_mb_s": round(max(0, int(net.bytes_recv) - recv_b) / dt / (1024**2), 2),
                    "sent_mb_s": round(max(0, int(net.bytes_sent) - sent_b) / dt / (1024**2), 2),
                }
            self._prev_net = (now, int(net.bytes_recv), int(net.bytes_sent))
        return disk_rate, net_rate

    def snapshot(
        self,
        *,
        control: Any,
        research_runtime: Any,
        service: Any,
        data_root: str | Path,
    ) -> dict[str, Any]:
        with self._lock:
            now = time.time()
            tqs_processes, top_processes = self._proc_rows(now)
            disk_rate, net_rate = self._io_rates(now)
            vm = psutil.virtual_memory()
            swap = psutil.swap_memory()
            cpu_per_core = psutil.cpu_percent(interval=None, percpu=True)
            try:
                disk = psutil.disk_usage(str(Path(data_root).expanduser()))
            except Exception:
                disk = None

            state = control.get()
            research = research_runtime.quick_status()
            live = service.runtime_status()

            heartbeat: dict[str, Any] = {}
            heartbeat_path = self.root / "data" / "supervisor-heartbeat.json"
            try:
                payload = json.loads(heartbeat_path.read_text(encoding="utf-8-sig"))
                if isinstance(payload, dict):
                    heartbeat = payload
            except Exception:
                pass

            try:
                resolved_data_root = str(Path(data_root).expanduser().resolve())
                resolved_repo_root = str(self.root.resolve())
                data_root_inside_repo = Path(resolved_data_root).is_relative_to(Path(resolved_repo_root))
            except Exception:
                resolved_data_root = str(data_root)
                data_root_inside_repo = False

            return {
                "generated_at_ms": int(now * 1000),
                "data_root": {
                    "path": resolved_data_root,
                    "inside_tqs_repo": data_root_inside_repo,
                    "warning": "Data Lake is inside the Git checkout; move it to a dedicated data drive." if data_root_inside_repo else "",
                },
                "system": {
                    "cpu_percent": round(float(psutil.cpu_percent(interval=None)), 1),
                    "cpu_per_core": [round(float(x), 1) for x in cpu_per_core],
                    "logical_cores": int(psutil.cpu_count(logical=True) or 0),
                    "physical_cores": int(psutil.cpu_count(logical=False) or 0),
                    "ram_percent": round(float(vm.percent), 1),
                    "ram_used_gb": round(float(vm.total - vm.available) / (1024**3), 2),
                    "ram_total_gb": round(float(vm.total) / (1024**3), 2),
                    "swap_percent": round(float(swap.percent), 1),
                    "disk_free_gb": round(float(disk.free) / (1024**3), 2) if disk else None,
                    "disk_total_gb": round(float(disk.total) / (1024**3), 2) if disk else None,
                    "disk_io": disk_rate,
                    "network_io": net_rate,
                },
                "policy": {
                    "mode": state.mode,
                    "heavy_workers": state.heavy_workers,
                    "history_batch_size": state.history_batch_size,
                    "metric_batch_size": state.metric_batch_size,
                    "refresh_seconds_override": state.refresh_seconds_override,
                    "cpu_soft_limit_pct": state.cpu_soft_limit_pct,
                    "ram_soft_limit_pct": state.ram_soft_limit_pct,
                    "auto_update": state.auto_update,
                },
                "effective": {
                    "live_refresh_seconds": live.get("effective_refresh_seconds"),
                    "research_desired_workers": research.get("desired_workers"),
                    "research_active_jobs": len(research.get("active_jobs") or []),
                    "research_throttled": bool((research.get("resource_snapshot") or {}).get("throttled")),
                    "research_throttle_reason": (research.get("resource_snapshot") or {}).get("reason") or "",
                },
                "research": research,
                "tqs_processes": tqs_processes,
                "top_processes": top_processes,
                "supervisor": heartbeat,
                "safety": {
                    "arbitrary_process_kill_enabled": False,
                    "arbitrary_shell_enabled": False,
                    "note": "Resource controls adjust TQS policy; they do not expose a remote shell.",
                },
            }
