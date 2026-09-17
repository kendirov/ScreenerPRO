from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

from .strategy_models import ResearchJob, StrategyRunResult, StrategySpec


def _now_ms() -> int:
    return int(time.time() * 1000)


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


class LabStore:
    def __init__(self, path: str = './data/tqs-lab.sqlite3') -> None:
        db = Path(path)
        db.parent.mkdir(parents=True, exist_ok=True)
        self.path = db
        self._lock = threading.RLock()
        self._con = sqlite3.connect(str(db), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        with self._lock:
            self._con.executescript('''
                pragma journal_mode=WAL;
                create table if not exists ideas (
                    id text primary key, created_at_ms integer, updated_at_ms integer,
                    origin text, title text, text text, kind text, status text, priority integer,
                    tags_json text, links_json text, result_json text
                );
                create table if not exists research_jobs (
                    id text primary key, kind text, created_at_ms integer, updated_at_ms integer,
                    status text, progress real, title_ru text, payload_json text,
                    result_json text, error text, started_at_ms integer, finished_at_ms integer
                );
                create table if not exists strategy_specs (
                    id text primary key, created_at_ms integer, updated_at_ms integer,
                    name_ru text, status text, version integer, spec_json text
                );
                create table if not exists strategy_runs (
                    run_id text primary key, strategy_id text, canonical_id text,
                    created_at_ms integer, status text, result_json text
                );
            ''')
            self._con.commit()

    def add_idea(self, title: str, text: str, origin: str = 'artem', kind: str = 'research',
                 priority: int = 50, tags: list[str] | None = None) -> dict[str, Any]:
        now = _now_ms()
        item = {
            'id': f'I-{uuid4().hex[:10].upper()}', 'created_at_ms': now, 'updated_at_ms': now,
            'origin': origin, 'title': title.strip() or 'Новая идея', 'text': text.strip(),
            'kind': kind, 'status': 'inbox', 'priority': max(0, min(int(priority), 100)),
            'tags': tags or [], 'links': [], 'result': {},
        }
        with self._lock:
            self._con.execute(
                'insert into ideas values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [item['id'], now, now, item['origin'], item['title'], item['text'], item['kind'], item['status'],
                 item['priority'], json.dumps(item['tags'], ensure_ascii=False), '[]', '{}'],
            )
            self._con.commit()
        return item

    def list_ideas(self, limit: int = 500, status: str = '') -> list[dict[str, Any]]:
        sql = 'select * from ideas'
        params: list[Any] = []
        if status:
            sql += ' where status=?'; params.append(status)
        sql += ' order by priority desc, created_at_ms desc limit ?'; params.append(limit)
        with self._lock:
            rows = self._con.execute(sql, params).fetchall()
        return [{
            'id': r['id'], 'created_at_ms': r['created_at_ms'], 'updated_at_ms': r['updated_at_ms'],
            'origin': r['origin'], 'title': r['title'], 'text': r['text'], 'kind': r['kind'],
            'status': r['status'], 'priority': r['priority'], 'tags': _loads(r['tags_json'], []),
            'links': _loads(r['links_json'], []), 'result': _loads(r['result_json'], {}),
        } for r in rows]

    def update_idea(self, idea_id: str, **changes: Any) -> dict[str, Any] | None:
        rows = self.list_ideas(10000)
        current = next((x for x in rows if x['id'] == idea_id), None)
        if current is None: return None
        current.update({k: v for k, v in changes.items() if k in {'title','text','kind','status','priority','tags','links','result'}})
        current['updated_at_ms'] = _now_ms()
        with self._lock:
            self._con.execute(
                '''update ideas set updated_at_ms=?,title=?,text=?,kind=?,status=?,priority=?,tags_json=?,links_json=?,result_json=? where id=?''',
                [current['updated_at_ms'], current['title'], current['text'], current['kind'], current['status'],
                 int(current['priority']), json.dumps(current['tags'], ensure_ascii=False),
                 json.dumps(current['links'], ensure_ascii=False), json.dumps(current['result'], ensure_ascii=False), idea_id],
            )
            self._con.commit()
        return current

    def enqueue_job(self, kind: str, title_ru: str, payload: dict[str, Any]) -> ResearchJob:
        item = ResearchJob(id=f'J-{uuid4().hex[:10].upper()}', kind=kind, created_at_ms=_now_ms(), title_ru=title_ru, payload=payload)
        with self._lock:
            self._con.execute(
                'insert into research_jobs values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [item.id, item.kind, item.created_at_ms, item.created_at_ms, item.status, item.progress, item.title_ru,
                 json.dumps(item.payload, ensure_ascii=False), '{}', None, None, None],
            )
            self._con.commit()
        return item

    def _job_from_row(self, r: sqlite3.Row) -> ResearchJob:
        return ResearchJob(id=r['id'], kind=r['kind'], created_at_ms=r['created_at_ms'], status=r['status'],
                           progress=float(r['progress'] or 0), title_ru=r['title_ru'], payload=_loads(r['payload_json'], {}),
                           result=_loads(r['result_json'], {}), error=r['error'])

    def list_jobs(self, limit: int = 300) -> list[ResearchJob]:
        with self._lock:
            rows = self._con.execute('select * from research_jobs order by created_at_ms desc limit ?', [limit]).fetchall()
        return [self._job_from_row(r) for r in rows]

    def claim_next_job(self) -> ResearchJob | None:
        with self._lock:
            row = self._con.execute("select * from research_jobs where status='queued' order by created_at_ms limit 1").fetchone()
            if row is None: return None
            now = _now_ms()
            self._con.execute("update research_jobs set status='running',progress=0.01,started_at_ms=?,updated_at_ms=? where id=?", [now, now, row['id']])
            self._con.commit()
            row = self._con.execute('select * from research_jobs where id=?', [row['id']]).fetchone()
        return self._job_from_row(row)

    def update_job(self, job_id: str, *, status: str | None = None, progress: float | None = None,
                   result: dict[str, Any] | None = None, error: str | None = None) -> None:
        fields = ['updated_at_ms=?']; params: list[Any] = [_now_ms()]
        if status is not None: fields.append('status=?'); params.append(status)
        if progress is not None: fields.append('progress=?'); params.append(max(0.0, min(float(progress), 1.0)))
        if result is not None: fields.append('result_json=?'); params.append(json.dumps(result, ensure_ascii=False, default=str))
        if error is not None: fields.append('error=?'); params.append(error[:4000])
        if status in {'done','failed','cancelled'}: fields.append('finished_at_ms=?'); params.append(_now_ms())
        params.append(job_id)
        with self._lock:
            self._con.execute(f"update research_jobs set {','.join(fields)} where id=?", params)
            self._con.commit()

    def save_strategy(self, spec: StrategySpec) -> StrategySpec:
        now = _now_ms()
        with self._lock:
            row = self._con.execute('select id from strategy_specs where id=?', [spec.id]).fetchone()
            if row:
                self._con.execute('update strategy_specs set updated_at_ms=?,name_ru=?,status=?,version=?,spec_json=? where id=?',
                                  [now, spec.name_ru, spec.status, spec.version, spec.model_dump_json(), spec.id])
            else:
                self._con.execute('insert into strategy_specs values (?, ?, ?, ?, ?, ?, ?)',
                                  [spec.id, now, now, spec.name_ru, spec.status, spec.version, spec.model_dump_json()])
            self._con.commit()
        return spec

    def list_strategies(self, limit: int = 500) -> list[StrategySpec]:
        with self._lock:
            rows = self._con.execute('select spec_json from strategy_specs order by updated_at_ms desc limit ?', [limit]).fetchall()
        return [StrategySpec.model_validate_json(r[0]) for r in rows]

    def get_strategy(self, strategy_id: str) -> StrategySpec | None:
        with self._lock:
            row = self._con.execute('select spec_json from strategy_specs where id=?', [strategy_id]).fetchone()
        return StrategySpec.model_validate_json(row[0]) if row else None

    def save_strategy_run(self, result: StrategyRunResult) -> None:
        with self._lock:
            self._con.execute('insert or replace into strategy_runs values (?, ?, ?, ?, ?, ?)',
                              [result.run_id, result.strategy_id, result.canonical_id, result.generated_at_ms, result.status, result.model_dump_json()])
            self._con.commit()

    def list_strategy_runs(self, strategy_id: str = '', limit: int = 300) -> list[StrategyRunResult]:
        sql = 'select result_json from strategy_runs'; params: list[Any] = []
        if strategy_id: sql += ' where strategy_id=?'; params.append(strategy_id)
        sql += ' order by created_at_ms desc limit ?'; params.append(limit)
        with self._lock:
            rows = self._con.execute(sql, params).fetchall()
        return [StrategyRunResult.model_validate_json(r[0]) for r in rows]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                'ideas': self._con.execute('select count(*) from ideas').fetchone()[0],
                'queued_jobs': self._con.execute("select count(*) from research_jobs where status='queued'").fetchone()[0],
                'running_jobs': self._con.execute("select count(*) from research_jobs where status='running'").fetchone()[0],
                'strategies': self._con.execute('select count(*) from strategy_specs').fetchone()[0],
                'strategy_runs': self._con.execute('select count(*) from strategy_runs').fetchone()[0],
            }
