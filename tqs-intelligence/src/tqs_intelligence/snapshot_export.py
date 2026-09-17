from __future__ import annotations

import json
import shutil
import time
import zipfile
from pathlib import Path
from typing import Any

from .control import ControlCenter
from .lab_store import LabStore
from .lake import DataLake
from .storage import DuckStore


def _dump(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding='utf-8')


class SnapshotExporter:
    def __init__(self, store: DuckStore, lab: LabStore, control: ControlCenter, lake: DataLake, db_path: str) -> None:
        self.store=store; self.lab=lab; self.control=control; self.lake=lake; self.db_path=Path(db_path)

    def export(self, *, runtime: dict[str,Any], research_runtime: dict[str,Any], snapshot: Any,
               relationships: list[Any], full: bool=False) -> dict[str,Any]:
        stamp=time.strftime('%Y%m%d-%H%M%S'); package=self.lake.exports_root/f'TQS-SNAPSHOT-{stamp}'
        package.mkdir(parents=True,exist_ok=False)
        manifest={
            'format':'TQS_SNAPSHOT_V1','created_at_ms':int(time.time()*1000),'full':full,
            'control':self.control.status(),'runtime':runtime,'research_runtime':research_runtime,
            'storage':self.store.stats(),'lab':self.lab.stats(),'data_lake':self.lake.verify(),
            'purpose_ru':'Переносимый снимок TQS: резервная копия, анализ ChatGPT/Work и воспроизводимость решений.',
        }
        _dump(package/'manifest.json',manifest)
        if snapshot is not None: _dump(package/'market_snapshot.json',snapshot.model_dump(mode='json'))
        _dump(package/'episodes.json',[x.model_dump(mode='json') for x in self.store.list_episodes(limit=10000)])
        _dump(package/'research_findings.json',[x.model_dump(mode='json') for x in self.store.list_findings(limit=5000)])
        _dump(package/'hypotheses.json',[x.model_dump(mode='json') for x in self.store.list_hypotheses(limit=5000)])
        _dump(package/'ideas.json',self.lab.list_ideas(limit=10000))
        _dump(package/'jobs.json',[x.model_dump(mode='json') for x in self.lab.list_jobs(limit=5000)])
        _dump(package/'strategies.json',[x.model_dump(mode='json') for x in self.lab.list_strategies(limit=5000)])
        _dump(package/'strategy_runs.json',[x.model_dump(mode='json') for x in self.lab.list_strategy_runs(limit=5000)])
        _dump(package/'relationships.json',[x.model_dump(mode='json') if hasattr(x,'model_dump') else x for x in relationships])
        _dump(package/'runtime_logs.json',[x.model_dump(mode='json') for x in self.store.list_logs(limit=5000)])
        _dump(package/'AI_READ_ME.json',{
            'role_ru':'Ты — исследователь/архитектор Trading QS. Этот пакет содержит фактическое состояние локальной TQS-машины.',
            'rules_ru':[
                'Отделяй FACT / AUTHOR OBSERVATION / AI HYPOTHESIS / PATTERN / RULE / UNKNOWN.',
                'Не называй найденную корреляцию торговым edge без control, OOS, walk-forward, costs и достаточного N.',
                'Предлагай улучшения программы, источников, аномалий, StrategySpec, графиков и briefing как проверяемые изменения.',
                'Сначала ищи дефекты данных и альтернативные объяснения; отрицательный результат сохраняй как знание.',
            ],
            'questions_ru':[
                'Что система нашла действительно необычного?',
                'Какие аномалии похожи на места потенциального начала движения?',
                'Какие дополнительные признаки усиливают или ослабляют эти эффекты?',
                'Какие стратегии/исследования поставить в очередь следующими?',
                'Какие источники, признаки, графики и интерфейсные поверхности отсутствуют?',
                'Что можно сделать дешевле, быстрее, надёжнее и автономнее?'
            ]
        })
        if full and self.db_path.exists():
            try:
                with self.store._lock:
                    self.store._con.execute('CHECKPOINT')
                    shutil.copy2(self.db_path,package/self.db_path.name)
            except Exception as exc:
                _dump(package/'database_copy_warning.json',{'warning':str(exc)})
        zip_path=package.with_suffix('.zip')
        with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as zf:
            for path in package.rglob('*'):
                if path.is_file(): zf.write(path,path.relative_to(package.parent))
        drive_copy=None; drive_root=self.control.get().drive_export_root
        if drive_root:
            target=Path(drive_root).expanduser(); target.mkdir(parents=True,exist_ok=True)
            drive_copy=target/zip_path.name; shutil.copy2(zip_path,drive_copy)
        return {'ok':True,'package_dir':str(package.resolve()),'zip_path':str(zip_path.resolve()),
                'drive_copy':str(drive_copy.resolve()) if drive_copy else None,'files':len(list(package.iterdir()))}
