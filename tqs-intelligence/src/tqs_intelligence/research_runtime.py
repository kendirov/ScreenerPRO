from __future__ import annotations

import asyncio
import traceback
from typing import Any

from .control import ControlCenter
from .historical import HistoricalBackfiller
from .lab_store import LabStore
from .lake import DataLake
from .strategy_machine import StrategyMachine


class ResearchRuntime:
    def __init__(self, control: ControlCenter, lab: LabStore, backfiller: HistoricalBackfiller,
                 lake: DataLake, machine: StrategyMachine) -> None:
        self.control=control; self.lab=lab; self.backfiller=backfiller; self.lake=lake; self.machine=machine
        self._task: asyncio.Task|None=None; self._running=False; self.last_action='Ожидание'; self.last_error: str|None=None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task=asyncio.create_task(self._loop(),name='tqs-research-runtime')

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass

    def status(self) -> dict[str,Any]:
        return {'running':self._running,'mode':self.control.get().mode,'last_action':self.last_action,'last_error':self.last_error,**self.lab.stats()}

    async def _execute(self, job) -> dict[str,Any]:
        async def progress(value: float, message: str) -> None:
            self.last_action=message; self.lab.update_job(job.id,progress=value)
        if job.kind=='historical_backfill':
            return await self.backfiller.backfill(job.payload,progress)
        if job.kind=='verify_lake':
            await progress(.5,'Проверка Parquet Data Lake')
            result=self.lake.verify(); await progress(1,'Data Lake проверен'); return result
        if job.kind=='strategy_run':
            strategy_id=str(job.payload['strategy_id']); canonical_id=str(job.payload['canonical_id'])
            spec=self.lab.get_strategy(strategy_id)
            if spec is None: raise KeyError(f'strategy {strategy_id} not found')
            await progress(.1,f'Загрузка истории {canonical_id}')
            frame=self.lake.read_candles(canonical_id,spec.interval)
            await progress(.35,f'Поиск событий и контрольных уровней: {canonical_id}')
            result=await asyncio.to_thread(self.machine.run,spec,canonical_id,frame)
            self.lab.save_strategy_run(result)
            await progress(1,f'Стратегия {spec.name_ru}: расчёт завершён')
            return result.model_dump(mode='json')
        raise ValueError(f'unknown research job kind: {job.kind}')

    async def _loop(self) -> None:
        self._running=True
        try:
            while True:
                state=self.control.get()
                if not state.heavy_allowed:
                    self.last_action='Тяжёлые расчёты на паузе — включи МАКС'
                    await asyncio.sleep(2); continue
                job=self.lab.claim_next_job()
                if job is None:
                    self.last_action='MAX: очередь исследований пуста'
                    await asyncio.sleep(2); continue
                self.last_error=None; self.last_action=f'{job.title_ru} — запуск'
                try:
                    result=await self._execute(job)
                    self.lab.update_job(job.id,status='done',progress=1,result=result,error='')
                except asyncio.CancelledError: raise
                except Exception as exc:
                    self.last_error=str(exc)
                    self.lab.update_job(job.id,status='failed',error=f'{exc}\n{traceback.format_exc()[-3000:]}')
                await asyncio.sleep(.2)
        finally:
            self._running=False
