from __future__ import annotations

import asyncio
import time
import traceback
from typing import Any

from .control import ControlCenter
from .historical import HistoricalBackfiller
from .history_autopilot import build_history_plan, history_title
from .lab_store import LabStore
from .lake import DataLake
from .replay import HistoricalReplayEngine
from .sources import BinanceSource, MoexSource
from .strategy_extensions import default_buy_dip_bps_spec, default_buy_dip_points_spec, run_buy_dip_grid
from .strategy_machine import StrategyMachine, default_round_buffer_spec


class ResearchRuntime:
    def __init__(self, control: ControlCenter, lab: LabStore, backfiller: HistoricalBackfiller,
                 lake: DataLake, machine: StrategyMachine) -> None:
        self.control=control; self.lab=lab; self.backfiller=backfiller; self.lake=lake; self.machine=machine
        self.replay=HistoricalReplayEngine(lake)
        self._task: asyncio.Task|None=None; self._running=False; self.last_action='Ожидание'; self.last_error: str|None=None
        self._last_auto_plan_s=0.0
        self._auto_history: dict[str,Any] = {
            'enabled': True, 'target_total': 0, 'known_total': 0, 'done': 0,
            'queued_running': 0, 'failed': 0, 'remaining': 0,
            'scope': 'ожидаем первый MAX discovery',
        }
        # Planner uses the same cheap public market adapters as the live service.
        # It only runs while MAX is idle, so it does not compete continuously with
        # the live collector.
        self._planner_sources = [BinanceSource(backfiller.http), MoexSource(backfiller.http)]
        try:
            with self.lab._lock:
                self.lab._con.execute("update research_jobs set status='queued',progress=0,error=coalesce(error,'')||' [recovered after restart]' where status='running'")
                self.lab._con.commit()
        except Exception:
            pass
        base=default_round_buffer_spec()
        if self.lab.get_strategy(base.id) is None:
            self.lab.save_strategy(base)
        crypto=base.model_copy(deep=True)
        crypto.id='TQS-STRAT-ROUND-BUFFER-CRYPTO-001'; crypto.name_ru='Крипто: отскок от круглых / буферных зон'; crypto.interval='5m'; crypto.costs={'round_trip_bps':10.0}
        crypto.notes=list(crypto.notes)+['Отдельная 5m версия для crypto perpetuals; репликация между биржами обязательна перед promotion.']
        if self.lab.get_strategy(crypto.id) is None:
            self.lab.save_strategy(crypto)
        for spec in (default_buy_dip_bps_spec(), default_buy_dip_points_spec()):
            if self.lab.get_strategy(spec.id) is None:
                self.lab.save_strategy(spec)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task=asyncio.create_task(self._loop(),name='tqs-research-runtime')

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def status(self) -> dict[str,Any]:
        return {
            'running':self._running,'mode':self.control.get().mode,
            'last_action':self.last_action,'last_error':self.last_error,
            'auto_history':dict(self._auto_history),
            **self.lab.stats(),
        }

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
            if spec is None:
                raise KeyError(f'strategy {strategy_id} not found')
            await progress(.1,f'Загрузка истории {canonical_id}')
            frame=self.lake.read_candles(canonical_id,spec.interval)
            await progress(.35,f'Поиск событий, параметров и controls: {canonical_id}')
            if str(spec.event.get('type'))=='buy_dip_grid':
                result=await asyncio.to_thread(run_buy_dip_grid,spec,canonical_id,frame)
            else:
                result=await asyncio.to_thread(self.machine.run,spec,canonical_id,frame)
            self.lab.save_strategy_run(result)
            if result.status=='candidate':
                title=f'Кандидат стратегии: {spec.name_ru} / {canonical_id}'
                if not any(x['title']==title for x in self.lab.list_ideas(3000)):
                    self.lab.add_idea(title,
                        f"Strategy Machine получил candidate после validation/holdout/walk-forward. Это ещё не live signal: требуется replication, data-quality и execution stress. Run={result.run_id}",
                        origin='machine',kind='strategy',priority=85,tags=['strategy-candidate',spec.id])
            diag=result.diagnostics or {}
            if diag.get('best_cell') or diag.get('worst_cell'):
                result.warnings.append('Диагностика прибыльных/убыточных режимов сохранена; использовать её как новую гипотезу, а не как постфактум-фильтр holdout.')
                self.lab.save_strategy_run(result)
            await progress(1,f'Стратегия {spec.name_ru}: расчёт завершён / {result.status}')
            return result.model_dump(mode='json')
        raise ValueError(f'unknown research job kind: {job.kind}')

    async def _autoplan_history(self) -> int:
        now=time.time()
        if now-self._last_auto_plan_s < 30:
            return 0
        self._last_auto_plan_s=now
        self.last_action='MAX: ищу пробелы истории Binance/MOEX'
        collected=await asyncio.gather(*(source.collect() for source in self._planner_sources),return_exceptions=True)
        quotes=[]; source_errors=[]
        for row in collected:
            if isinstance(row,BaseException):
                source_errors.append(str(row)[:300]); continue
            chunk,health=row
            quotes.extend(chunk)
            if getattr(health,'error',None): source_errors.append(str(health.error)[:300])
        jobs=self.lab.list_jobs(5000)
        payloads,stats=build_history_plan(quotes,jobs,batch_size=4)
        stats['last_plan_at_ms']=int(time.time()*1000)
        stats['discovered_quotes']=len(quotes)
        stats['source_errors']=source_errors[:4]
        self._auto_history=stats
        for payload in payloads:
            self.lab.enqueue_job('historical_backfill',history_title(payload),payload)
        if payloads:
            self.last_action=(
                f"Автоистория: +{len(payloads)} задач · покрытие {stats.get('done',0)}/{stats.get('target_total',0)} · "
                f"осталось {stats.get('remaining',0)}"
            )
        elif stats.get('target_total',0):
            self.last_action=(
                f"Автоистория: приоритетное покрытие {stats.get('known_total',0)}/{stats.get('target_total',0)} · "
                f"готово {stats.get('done',0)} · ошибок {stats.get('failed',0)}"
            )
        else:
            self.last_action='MAX: автоистория ждёт доступный Binance/MOEX universe'
        return len(payloads)

    async def _loop(self) -> None:
        self._running=True
        try:
            while True:
                state=self.control.get()
                if not state.heavy_allowed:
                    self.last_action='Тяжёлые расчёты на паузе — включи МАКС'; await asyncio.sleep(2); continue
                job=self.lab.claim_next_job()
                if job is None:
                    try:
                        queued=await self._autoplan_history()
                    except asyncio.CancelledError:
                        raise
                    except Exception as exc:
                        self.last_error=f'auto-history planner: {exc}'
                        self.last_action=f'Автоистория: ошибка планировщика — {str(exc)[:180]}'
                        await asyncio.sleep(10)
                        continue
                    if queued:
                        await asyncio.sleep(.2)
                        continue
                    await asyncio.sleep(2)
                    continue
                self.last_error=None; self.last_action=f'{job.title_ru} — запуск'
                try:
                    result=await self._execute(job); self.lab.update_job(job.id,status='done',progress=1,result=result,error='')
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    self.last_error=str(exc); self.lab.update_job(job.id,status='failed',error=f'{exc}\n{traceback.format_exc()[-3000:]}')
                await asyncio.sleep(.2)
        finally:
            self._running=False
