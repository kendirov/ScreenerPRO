from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from threading import Lock


VALID_MODES = {'stop', 'light', 'max'}


@dataclass
class ControlState:
    mode: str = 'light'
    data_lake_root: str = './data-lake'
    drive_export_root: str = ''
    auto_update: bool = True
    heavy_workers: int = 2
    changed_by: str = 'default'

    @property
    def heavy_allowed(self) -> bool:
        return self.mode == 'max'

    @property
    def live_allowed(self) -> bool:
        return self.mode != 'stop'


class ControlCenter:
    def __init__(self, config_path: str = './data/control.json') -> None:
        self.path = Path(config_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock(); self._mtime_ns = 0
        self._state = self._load(); self._sync_mtime()

    def _default(self) -> ControlState:
        return ControlState(
            mode=os.getenv('TQS_MODE', 'light').lower(),
            data_lake_root=os.getenv('TQS_DATA_LAKE_ROOT', './data-lake'),
            drive_export_root=os.getenv('TQS_DRIVE_EXPORT_ROOT', ''),
            auto_update=os.getenv('TQS_AUTO_UPDATE', 'true').lower() in {'1','true','yes','on'},
            heavy_workers=max(1, int(os.getenv('TQS_HEAVY_WORKERS', '2'))),
        )

    def _sync_mtime(self) -> None:
        try: self._mtime_ns = self.path.stat().st_mtime_ns
        except FileNotFoundError: self._mtime_ns = 0

    def _load(self) -> ControlState:
        base = self._default()
        if not self.path.exists():
            if base.mode not in VALID_MODES: base.mode = 'light'
            return base
        try:
            raw = json.loads(self.path.read_text(encoding='utf-8'))
            data = asdict(base); data.update({k: v for k, v in raw.items() if k in data})
            state = ControlState(**data)
            if state.mode not in VALID_MODES: state.mode = 'light'
            state.heavy_workers = max(1, min(int(state.heavy_workers), 16))
            return state
        except Exception:
            return base

    def _reload_if_changed(self) -> None:
        try: mtime = self.path.stat().st_mtime_ns
        except FileNotFoundError: mtime = 0
        if mtime and mtime != self._mtime_ns:
            self._state = self._load(); self._mtime_ns = mtime

    def get(self) -> ControlState:
        with self._lock:
            self._reload_if_changed()
            return ControlState(**asdict(self._state))

    def update(self, **changes: object) -> ControlState:
        with self._lock:
            self._reload_if_changed(); data = asdict(self._state)
            for key, value in changes.items():
                if key in data and value is not None: data[key] = value
            state = ControlState(**data); state.mode = str(state.mode).lower()
            if state.mode not in VALID_MODES: raise ValueError(f'unsupported mode: {state.mode}')
            state.heavy_workers = max(1, min(int(state.heavy_workers), 16))
            Path(state.data_lake_root).expanduser().mkdir(parents=True, exist_ok=True)
            if state.drive_export_root: Path(state.drive_export_root).expanduser().mkdir(parents=True, exist_ok=True)
            self._state = state
            self.path.write_text(json.dumps(asdict(state), ensure_ascii=False, indent=2), encoding='utf-8')
            self._sync_mtime()
            return ControlState(**asdict(state))

    def status(self) -> dict[str, object]:
        state = self.get(); lake = Path(state.data_lake_root).expanduser(); drive = Path(state.drive_export_root).expanduser() if state.drive_export_root else None
        return {**asdict(state),'live_allowed':state.live_allowed,'heavy_allowed':state.heavy_allowed,
                'data_lake_exists':lake.exists(),'drive_export_exists':bool(drive and drive.exists())}
