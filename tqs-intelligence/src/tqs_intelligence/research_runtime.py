from __future__ import annotations

import asyncio
import traceback
from typing import Any

from .control import ControlCenter
from .historical import HistoricalBackfiller
from .lab_store import LabStore
from .lake import DataLake
from .replay import HistoricalReplayEngine
from .strategy_machine import StrategyMachine


class ResearchRuntime:
    def __init__(self, control: ControlCenter, lab: LabStore, backfiller: HistoricalBackfiller,
                 lake: DataLake, machine: StrategyMachine) -> None:
        self.control=control; self.lab=lab; self.backfiller=backfiller; self.lake=lake; self.machine=machine
        self.replay=HistoricalReplayEngine(lake)
        self._task: asyncio.Task|None=None; self._running=False; self.last_action='Ожидание'; self.last_error: str|None=None

    def start(self) -> None:
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name='tqs-research-runtime')

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass

    def status(self) -> dict[str,Any]:
        return {'running':self._running,'mode':self.control.get().mode,'last_action':self.last_action,'last_error':self.last_error,**self.lab.stats()}

    def _enqueue_matching_strategies(self, canonical_id:str, interval:str) -> int:
        count=0
        existing={(j.kind,str(j.payload.get('strategy_id')),str(j.payload.get('canonical_id'))) for j in self.lab.list_jobs(1000) if j.status in {'queued','running'}}
        for spec in self.lab.list_strategies():
            key=('strategy_run',spec.id,canonical_id)
            if spec.interval==interval and key not in existing:
                self.lab.enqueue_job('strategy_run',f'Автотест: {spec.name_ru} / {canonical_id}',{'strategy_id':spec.id,'canonical_id':canonical_id}); count+=1
        return count

    async def _execute(self, job) -> dict[str,Any]:
        async def progress(value: float, message: str) -> None:
            self.last_action=message; self.lab.update_job(job.id,progress=value)
        if job.kind=='historical_backfill':
            result=await self.backfiller.backfill(job.payload,progress)
            if int(result.get('rows') or 0)>0:
                cid=str(result['canonical_id']); interval=str(result['interval'])
                self.lab.enqueue_job('historical_replay',f'Historical Replay: {cid}',{'canonical_id':cid,'interval':interval,'threshold':70.0})
                result['next']='historical_replay queued'
            return result
        if job.kind=='historical_replay':
            cid=str(job.payload['canonical_id']); interval=str(job.payload.get('interval','10m')); threshold=float(job.payload.get('threshold',70))
            await progress(.15,f'Historical Replay: признаки {cid}')
            result=await asyncio.to_thread(self.replay.run,cid,interval,threshold)
            await progress(.9,f'Historical Replay: OOS/control {cid}')
            if result.get('status')=='movement_candidate':
                title=f'Автонаходка движения: {cid} / {interval}'
                if not any(x['title']==title for x in self.lab.list_ideas(3000)):
                    self.lab.add_idea(title,
                        f"Historical Replay нашёл повышенное абсолютное движение после anomaly episodes. N={result.get('events')}. Проверить направление, режимы, ликвидность, новости и execution-cost layer.",
                        origin='machine',kind='anomaly',priority=75,tags=['auto-discovery','movement-candidate',interval])
            if int(result.get('events') or 0)>=40:
                result['strategy_jobs_queued']=self._enqueue_matching_strategies(cid,interval)
            await progress(1,f'Historical Replay завершён: {cid} / {result.get("status")}')
            return result
        if job.kind=='verify_lake':
            await progress(.5,'Проверка Parquet Data Lake'); result=self.lake.verify(); await progress(1,'Data Lake проверен'); return result
        if job.kind=='strategy_run':
            strategy_id=str(job.payload['strategy_id']); canonical_id=str(job.payload['canonical_id']); spec=self.lab.get_strategy(strategy_id)
            if spec is None: raise KeyError(f'strategy {strategy_id} not found')
            await progress(.1,f'Загрузка истории {canonical_id}'); frame=self.lake.read_candles(canonical_id,spec.interval)
            await progress(.35,f'Поиск событий и контрольных уровней: {canonical_id}')
            result=await asyncio.to_thread(self.machine.run,spec,canonical_id,frame); self.lab.save_strategy_run(result)
            if result.status=='candidate':
                title=f'Кандидат стратегии: {spec.name_ru} / {canonical_id}'
                if not any(x['title']==title for x in self.lab.list_ideas(3000)):
                    self.lab.add_idea(title,
                        f"Strategy Machine получил candidate после validation/holdout/walk-forward. Это ещё не live signal: требуется replication, data-quality и execution stress. Run={result.run_id}",
                        origin='machine',kind='strategy',priority=85,tags=['strategy-candidate',spec.id])
            await progress(1,f'Стратегия {spec.name_ru}: расчёт завершён / {result.status}'); return result.model_dump(mode='json')
        raise ValueError(f'unknown research job kind: {job.kind}')

    async def _loop(self) -> None:
        self._running=True
        try:
            while True:
                state=self.control.get()
                if not state.heavy_allowed:
                    self.last_action='Тяжёлые расчёты на паузе — включи МАКС'; await asyncio.sleep(2); continue
                job=self.lab.claim_next_job()
                if job is None:
                    self.last_action='MAX: очередь исследований пуста'; await asyncio.sleep(2); continue
                self.last_error=None; self.last_action=f'{job.title_ru} — запуск'
                try:
                    result=await self._execute(job); self.lab.update_job(job.id,status='done',progress=1,result=result,error='')
                except asyncio.CancelledError: raise
                except Exception as exc:
                    self.last_error=str(exc); self.lab.update_job(job.id,status='failed',error=f'{exc}\n{traceback.format_exc()[-3000:]}')
                await asyncio.sleep(.2)
        finally: self._running=False
