from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

from . import __version__
from .account_intelligence import AccountIntelStore
from .control import ControlCenter
from .lab_store import LabStore
from .lake import DataLake
from .storage import DuckStore


_ACCOUNT_RE = re.compile(r"0x[a-fA-F0-9]{40}")
_SECRET_KEYS = ("secret", "token", "password", "passphrase", "api_key", "apikey", "cookie", "authorization")


def _dump(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def _redact_account_id(source: str, account_id: str) -> str:
    digest = hashlib.sha256(f"{source}:{account_id.lower()}".encode("utf-8")).hexdigest()[:8]
    return f"{source}:acct-{digest}"


def _redact_value(value: Any, key: str = "") -> Any:
    key_lower = key.lower()
    if any(marker in key_lower for marker in _SECRET_KEYS):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): _redact_value(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_value(v) for v in value]
    if isinstance(value, tuple):
        return [_redact_value(v) for v in value]
    if isinstance(value, str):
        return _ACCOUNT_RE.sub("0x[REDACTED_ACCOUNT]", value)
    return value


def _git_identity(root: Path) -> dict[str, Any]:
    def run(*args: str) -> str:
        try:
            return subprocess.check_output(
                ["git", "-C", str(root), *args], stderr=subprocess.DEVNULL, text=True, timeout=5
            ).strip()
        except Exception:
            return ""

    return {
        "branch": run("branch", "--show-current") or None,
        "commit": run("rev-parse", "HEAD") or None,
        "dirty": bool(run("status", "--porcelain")),
    }


def _runtime_identity(control: ControlCenter, repo_root: Path) -> dict[str, Any]:
    state = control.get()
    started = int(ps_start_time_ms())
    return {
        "platform": "TQS",
        "module": "TQS Intelligence",
        "version": __version__,
        "git": _git_identity(repo_root),
        "runtime_instance_id": f"{started}-{os.getpid()}",
        "pid": os.getpid(),
        "process_started_at_ms": started,
        "mode": state.mode,
        "python": sys.version.split()[0],
        "os": platform.platform(),
    }


def ps_start_time_ms() -> int:
    try:
        import psutil

        return int(psutil.Process().create_time() * 1000)
    except Exception:
        return int(time.time() * 1000)


def _source_rows(snapshot: Any) -> list[dict[str, Any]]:
    if snapshot is None:
        return []
    rows = []
    for item in getattr(snapshot, "source_health", []) or []:
        try:
            rows.append(item.model_dump(mode="json"))
        except Exception:
            rows.append(dict(item) if isinstance(item, dict) else {"value": str(item)})
    return rows


def _diagnose(runtime: dict[str, Any], research_runtime: dict[str, Any], snapshot: Any) -> dict[str, Any]:
    alerts: list[dict[str, str]] = []
    now_ms = int(time.time() * 1000)
    if not runtime.get("running"):
        alerts.append({"severity": "error", "component": "market-runtime", "message_ru": "Основной market runtime не сообщает RUNNING."})
    if runtime.get("last_error"):
        alerts.append({"severity": "error", "component": "market-runtime", "message_ru": f"Последняя ошибка рынка: {str(runtime['last_error'])[:500]}"})
    if research_runtime.get("last_error"):
        alerts.append({"severity": "warning", "component": "research", "message_ru": f"Последняя ошибка Research: {str(research_runtime['last_error'])[:500]}"})

    generated = getattr(snapshot, "generated_at_ms", None) if snapshot is not None else None
    refresh_s = int(runtime.get("effective_refresh_seconds") or runtime.get("refresh_seconds") or 60)
    stale_after_ms = max(300_000, refresh_s * 4_000)
    stale = generated is None or now_ms - int(generated) > stale_after_ms
    if generated is None:
        alerts.append({"severity": "warning", "component": "market-data", "message_ru": "Свежего market snapshot ещё нет."})
    elif stale:
        age_s = max(0, (now_ms - int(generated)) // 1000)
        alerts.append({"severity": "warning", "component": "market-data", "message_ru": f"Market snapshot выглядит устаревшим: возраст ~{age_s} сек."})

    sources = _source_rows(snapshot)
    bad_sources = [row for row in sources if str(row.get("status") or "").lower() not in {"ok", "degraded"}]
    if bad_sources:
        alerts.append({"severity": "warning", "component": "sources", "message_ru": f"Не в нормальном состоянии источников: {len(bad_sources)}/{len(sources)}."})

    queued = int(research_runtime.get("queued_jobs") or research_runtime.get("queued") or 0)
    running_jobs = int(research_runtime.get("running_jobs") or 0)
    if str(research_runtime.get("mode") or "").lower() == "max" and not queued and not running_jobs:
        auto_history = research_runtime.get("auto_history") or {}
        remaining = int(auto_history.get("remaining") or 0)
        if remaining > 0:
            alerts.append({"severity": "warning", "component": "research", "message_ru": f"MAX: очередь пуста, но автоистория показывает ещё {remaining} целей. Проверить планировщик, если состояние сохраняется."})

    overall = "ERROR" if any(x["severity"] == "error" for x in alerts) else "DEGRADED" if alerts else "OK"
    next_actions = []
    if overall == "ERROR":
        next_actions.append("Сначала проверить runtime.log, supervisor heartbeat и первый конкретный exception; не делать циклические ручные рестарты.")
    if stale:
        next_actions.append("Проверить последний успешный collector cycle и source health; отделять сохранённый snapshot от LIVE состояния.")
    if research_runtime.get("last_error"):
        next_actions.append("Открыть failed research job и проверить его payload/error до повторного запуска.")
    if not next_actions:
        next_actions.append("Критических симптомов по snapshot heuristics не найдено; анализировать прогресс/результаты, а не CPU/RAM.")

    return {
        "overall": overall,
        "snapshot_stale": stale,
        "alerts": alerts,
        "next_actions_ru": next_actions,
        "note_ru": "Это детерминированная диагностика по доступному состоянию, не окончательный root-cause вывод AI.",
    }


def _redacted_profiles(store: AccountIntelStore) -> list[dict[str, Any]]:
    rows = []
    for profile in store.profiles():
        safe = {k: v for k, v in profile.items() if k not in {"account_id"}}
        safe["account_ref"] = _redact_account_id(str(profile.get("source") or "account"), str(profile.get("account_id") or ""))
        rows.append(_redact_value(safe))
    return rows


class SnapshotExporter:
    def __init__(
        self,
        store: DuckStore,
        lab: LabStore,
        control: ControlCenter,
        lake: DataLake,
        db_path: str,
        account_store: AccountIntelStore | None = None,
    ) -> None:
        self.store = store
        self.lab = lab
        self.control = control
        self.lake = lake
        self.db_path = Path(db_path)
        self.account_store = account_store
        self.repo_root = Path(__file__).resolve().parents[3]

    def export(
        self,
        *,
        runtime: dict[str, Any],
        research_runtime: dict[str, Any],
        snapshot: Any,
        relationships: list[Any],
        full: bool = False,
    ) -> dict[str, Any]:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        package = self.lake.exports_root / f"TQS-SNAPSHOT-{stamp}"
        package.mkdir(parents=True, exist_ok=False)

        identity = _runtime_identity(self.control, self.repo_root)
        lake_state = self.lake.verify()
        account_stats = self.account_store.stats() if self.account_store else None
        sources = _source_rows(snapshot)
        diagnosis = _diagnose(runtime, research_runtime, snapshot)
        manifest = {
            "format": "TQS_SNAPSHOT_V3",
            "created_at_ms": int(time.time() * 1000),
            "snapshot_level": "FULL_PRIVATE" if full else "SUPPORT_REDACTED",
            "full": full,
            "identity": identity,
            "control": self.control.status(),
            "runtime": runtime,
            "research_runtime": research_runtime,
            "sources": sources,
            "storage": self.store.stats(),
            "lab": self.lab.stats(),
            "data_lake": lake_state,
            "account_intelligence": account_stats,
            "purpose_ru": "Переносимый снимок состояния TQS для диагностики, анализа AI и воспроизводимости. SUPPORT по умолчанию редактирует account identity; FULL_PRIVATE может содержать чувствительные данные.",
        }
        _dump(package / "manifest.json", _redact_value(manifest) if not full else manifest)
        _dump(package / "diagnosis.json", diagnosis)

        if snapshot is not None:
            payload = snapshot.model_dump(mode="json")
            _dump(package / "market_snapshot.json", _redact_value(payload) if not full else payload)
        _dump(package / "episodes.json", [x.model_dump(mode="json") for x in self.store.list_episodes(limit=10000)])
        _dump(package / "research_findings.json", [x.model_dump(mode="json") for x in self.store.list_findings(limit=5000)])
        _dump(package / "hypotheses.json", [x.model_dump(mode="json") for x in self.store.list_hypotheses(limit=5000)])
        _dump(package / "ideas.json", self.lab.list_ideas(limit=10000))
        _dump(package / "jobs.json", [_redact_value(x.model_dump(mode="json")) for x in self.lab.list_jobs(limit=5000)])
        _dump(package / "strategies.json", [x.model_dump(mode="json") for x in self.lab.list_strategies(limit=5000)])
        _dump(package / "strategy_runs.json", [x.model_dump(mode="json") for x in self.lab.list_strategy_runs(limit=5000)])
        _dump(
            package / "relationships.json",
            [x.model_dump(mode="json") if hasattr(x, "model_dump") else x for x in relationships],
        )
        logs = [x.model_dump(mode="json") for x in self.store.list_logs(limit=5000)]
        _dump(package / "runtime_logs.json", logs if full else _redact_value(logs))

        if self.account_store:
            if full:
                _dump(package / "tracked_accounts.json", [x.model_dump(mode="json") for x in self.account_store.list_tracked()])
                _dump(package / "account_profiles.json", self.account_store.profiles())
                _dump(package / "open_positions.json", self.account_store.current_positions(limit=5000))
                fills = {}
                for acct in self.account_store.list_tracked():
                    fills[f"{acct.source}:{acct.account_id}"] = self.account_store.recent_fills(acct.source, acct.account_id, 2000)
                _dump(package / "account_recent_fills.json", fills)
            else:
                _dump(package / "account_profiles_redacted.json", _redacted_profiles(self.account_store))
                _dump(package / "account_summary.json", {"stats": account_stats, "raw_accounts_included": False})

        _dump(
            package / "AI_READ_ME.json",
            {
                "role_ru": "Ты — исследователь/архитектор TQS. Этот пакет содержит фактическое состояние локальной TQS Intelligence машины.",
                "snapshot_level": "FULL_PRIVATE" if full else "SUPPORT_REDACTED",
                "read_first_ru": ["manifest.json", "diagnosis.json", "runtime_logs.json", "jobs.json"],
                "rules_ru": [
                    "Отделяй FACT / AUTHOR OBSERVATION / AI HYPOTHESIS / PATTERN / RULE / UNKNOWN.",
                    "Сначала различи LIVE runtime и сохранённые данные: cached snapshot не доказывает, что машина работает сейчас.",
                    "Не называй найденную корреляцию торговым edge без control, OOS, walk-forward, costs и достаточного N.",
                    "Не приписывай публичному счёту мотив или стоп как факт: сначала синхронизируй fills/positions с рыночной историей.",
                    "Ищи root cause по первой конкретной ошибке; не предлагай циклические рестарты как диагностику.",
                    "Предлагай улучшения программы, источников, аномалий, StrategySpec, графиков и briefing как проверяемые изменения.",
                    "Сначала ищи дефекты данных и альтернативные объяснения; отрицательный результат сохраняй как знание.",
                ],
                "questions_ru": [
                    "Жива ли машина и совпадает ли runtime identity/version с ожидаемой?",
                    "Что система делает сейчас и что реально завершилось за последние циклы?",
                    "Какая первая конкретная ошибка/деградация видна?",
                    "Что система нашла действительно необычного?",
                    "Какие аномалии похожи на места потенциального начала движения?",
                    "Какие стратегии/исследования поставить в очередь следующими?",
                    "Какие источники, признаки, графики и интерфейсные поверхности отсутствуют?",
                    "Что можно сделать дешевле, быстрее, надёжнее и автономнее?",
                ],
            },
        )

        if full and self.db_path.exists():
            try:
                with self.store._lock:
                    self.store._con.execute("CHECKPOINT")
                    shutil.copy2(self.db_path, package / self.db_path.name)
            except Exception as exc:
                _dump(package / "database_copy_warning.json", {"warning": str(exc)})

        zip_path = package.with_suffix(".zip")
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for path in package.rglob("*"):
                if path.is_file():
                    zf.write(path, path.relative_to(package.parent))

        drive_copy = None
        drive_root = self.control.get().drive_export_root
        if drive_root:
            target = Path(drive_root).expanduser()
            target.mkdir(parents=True, exist_ok=True)
            drive_copy = target / zip_path.name
            shutil.copy2(zip_path, drive_copy)

        return {
            "ok": True,
            "format": "TQS_SNAPSHOT_V3",
            "snapshot_level": "FULL_PRIVATE" if full else "SUPPORT_REDACTED",
            "diagnosis": diagnosis["overall"],
            "package_dir": str(package.resolve()),
            "zip_path": str(zip_path.resolve()),
            "drive_copy": str(drive_copy.resolve()) if drive_copy else None,
            "files": len(list(package.iterdir())),
        }
