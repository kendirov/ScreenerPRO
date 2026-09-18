from __future__ import annotations

import asyncio
import time
import traceback

import psutil
from typing import Any

from .bybit_metrics import BybitLongHistoryBackfiller
from .control import ControlCenter
from .historical import HistoricalBackfiller
from .history_autopilot import build_history_plan, history_title
from .lab_store import LabStore
from .lake import DataLake
from .metric_autopilot import build_metric_plan, metric_title
from .replay import HistoricalReplayEngine
from .research_experiments import ResearchExperimentEngine
from .sources import BinanceSource, BybitSource, MoexSource
from .strategy_extensions import default_buy_dip_bps_spec, default_buy_dip_points_spec, run_buy_dip_grid
from .strategy_machine import StrategyMachine, default_round_buffer_spec
from .strategy_models import ResearchProject


class ResearchPaused(RuntimeError):
    """Cooperative pause requested by LIGHT/STOP; job must be re-queued, not failed."""


class ResearchRuntime:
    def __init__(self, control: ControlCenter, lab: LabStore, backfiller: HistoricalBackfiller,
                 lake: DataLake, machine: StrategyMachine) -> None:
        self.control=control; self.lab=lab; self.backfiller=backfiller; self.lake=lake; self.machine=machine
        self.replay=HistoricalReplayEngine(lake)
        self.experiments=ResearchExperimentEngine(lake, backfiller.metric_lake, lab, machine)
        self.bybit_metrics=BybitLongHistoryBackfiller(backfiller.http, backfiller.metric_lake)
        self._task: asyncio.Task|None=None; self._running=False; self.last_action='Ожидание'; self.last_error: str|None=None
        self._last_auto_plan_s=0.0
        self._max_worker_slots=4
        self._worker_tasks: list[asyncio.Task] = []
        self._worker_states: dict[int,dict[str,Any]] = {}
        self._active_jobs: dict[int,dict[str,Any]] = {}
        self._planner_lock: asyncio.Lock | None = None
        self._resource_snapshot: dict[str,Any] = {'cpu_percent':0.0,'ram_percent':0.0,'throttled':False}
        self._auto_history: dict[str,Any] = {
            'enabled': True, 'target_total': 0, 'known_total': 0, 'done': 0,
            'queued_running': 0, 'failed': 0, 'remaining': 0,
            'scope': 'ожидаем первый MAX discovery',
        }
        self._auto_metrics: dict[str,Any] = {
            'enabled': True, 'target_total': 0, 'known_total': 0, 'done': 0,
            'queued_running': 0, 'failed': 0, 'remaining': 0,
            'scope': 'Binance/Bybit derivatives + MOEX FUTOI ждут MAX',
        }
        self._planner_sources = [BinanceSource(backfiller.http), MoexSource(backfiller.http), BybitSource(backfiller.http)]
        try:
            with self.lab._lock:
                self.lab._con.execute("update research_jobs set status='queued',progress=0,error=coalesce(error,'')||' [recovered after restart]' where status='running'")
                self.lab._con.commit()
        except Exception:
            pass
        base=default_round_buffer_spec()
        if self.lab.get_strategy(base.id) is None: self.lab.save_strategy(base)
        crypto=base.model_copy(deep=True)
        crypto.id='TQS-STRAT-ROUND-BUFFER-CRYPTO-001'; crypto.name_ru='Крипто: отскок от круглых / буферных зон'; crypto.interval='5m'; crypto.costs={'round_trip_bps':10.0}
        crypto.notes=list(crypto.notes)+['Отдельная 5m версия для crypto perpetuals; репликация между биржами обязательна перед promotion.']
        if self.lab.get_strategy(crypto.id) is None: self.lab.save_strategy(crypto)
        for spec in (default_buy_dip_bps_spec(), default_buy_dip_points_spec()):
            if self.lab.get_strategy(spec.id) is None: self.lab.save_strategy(spec)
        self._seed_research_projects()

    def _seed_research_projects(self) -> None:
        now=int(time.time()*1000)
        seeds=[
            ResearchProject(
                id='TQS-RESEARCH-ROUND-LEVELS-001',
                title='Круглые уровни: clustering / barrier / breakout',
                hypothesis='Круглые цены меняют поведение рынка относительно matched pseudo-level controls; эффект зависит от first touch, acceptance, режима и ликвидности.',
                origin='artem+drive',status='exploratory',market='multi',
                data_requirements=['OHLCV','tick size','spread','volume','session','volatility','matched pseudo-level controls'],
                event={'family':'round_level','states':['approach','touch','rejection','acceptance','breakout','retest']},
                controls=['matched pseudo-level','same session','same volatility','same direction'],
                regimes=['trend/range','high/low vol','session','liquidity','news/no-news'],
                horizons=['1m','5m','15m','1h','1d'],
                notes=['Drive evidence base exists; do not equate price clustering with tradable barrier effect.'],
                created_at_ms=now,updated_at_ms=now,
            ),
            ResearchProject(
                id='TQS-RESEARCH-PRICE-OI-DIVERGENCE-001',
                title='Цена стоит, OI растёт',
                version=2,
                hypothesis='Рост OI при слабом движении цены формирует состояния накопления/борьбы, после которых распределение будущего движения отличается от matched controls.',
                origin='artem',status='exploratory',market='multi',
                data_requirements=['price','open_interest','delta OI','volume','spread','FUTOI where available'],
                event={'family':'price_oi_divergence','price_abs_return_max_bps':20,'oi_change_percentile':0.80,'lookback_bars':3,'reset_bars':3},
                controls=['same volatility','same session','similar volume without OI shock'],
                regimes=['trend/range','pre-expiry/normal','high/low vol','participant context'],
                horizons=['5m','15m','1h','4h','1d'],
                notes=['Never infer long/short direction from aggregate OI alone.'],
                created_at_ms=now,updated_at_ms=now,
            ),
            ResearchProject(
                id='TQS-RESEARCH-MOEX-EXPIRY-001',
                title='MOEX квартальная экспирация и ролловер',
                hypothesis='Вблизи квартальной экспирации меняются ликвидность, basis, OI split и intraday response; эффекты должны измеряться относительно non-expiry controls.',
                origin='artem+drive',status='exploratory',market='MOEX',
                data_requirements=['current/next futures','expiry metadata','OI','volume','basis','underlying/index','FUTOI when available'],
                event={'family':'expiry','windows':['T-10','T-5','T-3','T-1','T0','T+1']},
                controls=['same weekday non-expiry','same volatility','same contract age'],
                regimes=['roll intensity','market trend','high/low vol','index/commodity/currency future'],
                horizons=['30m','1h','session','1d','3d'],
                notes=['Settlement/expiry time must come from versioned contract metadata, not hardcoded historical assumptions.'],
                created_at_ms=now,updated_at_ms=now,
            ),
        ]
        defaults={
            'TQS-RESEARCH-ROUND-LEVELS-001': ['binance:usdt-futures:BTCUSDT','binance:usdt-futures:ETHUSDT','binance:usdt-futures:ZECUSDT'],
            'TQS-RESEARCH-PRICE-OI-DIVERGENCE-001': ['binance:usdt-futures:BTCUSDT','binance:usdt-futures:ETHUSDT'],
            'TQS-RESEARCH-MOEX-EXPIRY-001': [],
        }
        for project in seeds:
            existing=self.lab.get_research_project(project.id)
            if existing is None:
                project.instruments=list(defaults.get(project.id,[]))
                if project.id=='TQS-RESEARCH-ROUND-LEVELS-001':
                    project.linked_strategy_ids=['TQS-STRAT-ROUND-BUFFER-001','TQS-STRAT-ROUND-BUFFER-CRYPTO-001']
                self.lab.save_research_project(project)
                continue
            changed=False
            if not existing.instruments and defaults.get(project.id):
                existing.instruments=list(defaults[project.id]); changed=True
            if project.id=='TQS-RESEARCH-ROUND-LEVELS-001':
                for sid in ('TQS-STRAT-ROUND-BUFFER-001','TQS-STRAT-ROUND-BUFFER-CRYPTO-001'):
                    if sid not in existing.linked_strategy_ids:
                        existing.linked_strategy_ids.append(sid); changed=True
            if project.id=='TQS-RESEARCH-PRICE-OI-DIVERGENCE-001' and int(existing.version or 1)<2:
                existing.version=2
                existing.event=dict(project.event)
                existing.notes=list(existing.notes)+[
                    'v1 fixed +1% OI / 15m produced no usable sample; v2 preregisters the OI threshold as an exploration-only percentile, frozen for validation/holdout.'
                ]
                existing.status='exploratory'
                changed=True
            if changed:
                self.lab.save_research_project(existing)

    def start(self) -> None:
        if self._task is None or self._task.done(): self._task=asyncio.create_task(self._loop(),name='tqs-research-runtime')

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass

    def quick_status(self) -> dict[str,Any]:
        state=self.control.get()
        return {
            'running':self._running,'mode':state.mode,
            'last_action':self.last_action,'last_error':self.last_error,
            'desired_workers':state.heavy_workers,'max_worker_slots':self._max_worker_slots,
            'workers':[dict({'worker_id':i}, **self._worker_states.get(i, {'state':'starting'})) for i in range(self._max_worker_slots)],
            'active_jobs':list(self._active_jobs.values()),
            'resource_policy':{
                'cpu_soft_limit_pct':state.cpu_soft_limit_pct,
                'ram_soft_limit_pct':state.ram_soft_limit_pct,
                'history_batch_size':state.history_batch_size,
                'metric_batch_size':state.metric_batch_size,
            },
            'resource_snapshot':dict(self._resource_snapshot),
            'auto_history':dict(self._auto_history),'auto_metrics':dict(self._auto_metrics),
        }

    def status(self) -> dict[str,Any]:
        return {**self.quick_status(), **self.lab.stats()}

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
            # Finish a result that is already complete, but pause long-running I/O
            # at the next progress checkpoint when the owner switches to LIGHT/STOP.
            if float(value) < 0.999 and not self.control.get().heavy_allowed:
                raise ResearchPaused(f"режим {self.control.get().mode.upper()}")
            self.last_action=message; self.lab.update_job(job.id,progress=value)
        if job.kind=='research_project_run':
            project_id=str(job.payload.get('research_project_id') or '')
            canonical_id=str(job.payload.get('canonical_id') or '')
            attempt=int(job.payload.get('attempt') or 0)
            project=self.lab.get_research_project(project_id)
            if project is None:
                raise KeyError(f'research project {project_id} not found')
            await progress(.08,f'Research {project_id}: loading {canonical_id}')
            result=await asyncio.to_thread(self.experiments.run,project,canonical_id)
            self.lab.save_research_run(result)
            if result.strategy_id and result.strategy_id not in project.linked_strategy_ids:
                project.linked_strategy_ids.append(result.strategy_id)
            if job.id not in project.linked_job_ids:
                project.linked_job_ids.append(job.id)
            latest={}
            for row in self.lab.list_research_runs(project.id,'',1000):
                if row.canonical_id not in latest:
                    latest[row.canonical_id]=row
            statuses=[latest[cid].status for cid in project.instruments if cid in latest]
            complete=bool(project.instruments) and len(statuses)==len(project.instruments)
            if any(x=='candidate' for x in statuses):
                project.status='validation'
            elif complete and statuses and all(x=='rejected' for x in statuses):
                project.status='rejected'
            elif complete and statuses and all(x=='insufficient_data' for x in statuses):
                project.status='insufficient_data'
            else:
                project.status='exploratory'
            self.lab.save_research_project(project)
            coverage=result.coverage or {}
            queued=[]
            parts=canonical_id.split(':',2)
            if attempt < 1 and coverage.get('need_history') and len(parts)==3:
                provider,market_type,symbol=parts
                if provider in {'binance','moex'}:
                    payload={'provider':provider,'symbol':symbol,'market_type':market_type,'interval':result.interval,
                             'research_project_id':project_id,'research_canonical_id':canonical_id,'research_attempt':attempt+1}
                    if provider=='moex':
                        payload['engine']='futures' if market_type=='forts' else 'stock'; payload['market']='forts' if market_type=='forts' else 'shares'
                    child=self.lab.enqueue_job('historical_backfill',f'Research data: {project_id} / {symbol}',payload)
                    queued.append(child.id)
            elif attempt < 1 and coverage.get('need_open_interest') and len(parts)==3:
                provider,market_type,symbol=parts
                if provider in {'binance','bybit'}:
                    child=self.lab.enqueue_job('derivative_metric_backfill',f'Research OI: {project_id} / {symbol}',{
                        'provider':provider,'symbol':symbol,'market_type':market_type,
                        'start_ms':int(time.time()*1000)-29*86_400_000,
                        'research_project_id':project_id,'research_canonical_id':canonical_id,'research_attempt':attempt+1})
                    queued.append(child.id)
            payload=result.model_dump(mode='json')
            payload['followup_jobs']=queued
            await progress(1,f'Research {project_id}: {result.status}')
            return payload
        if job.kind=='historical_backfill':
            result=await self.backfiller.backfill(job.payload,progress)
            if int(result.get('rows') or 0)>0:
                cid=str(result['canonical_id']); interval=str(result['interval'])
                self.lab.enqueue_job('historical_replay',f'Historical Replay: {cid}',{'canonical_id':cid,'interval':interval,'threshold':70.0})
                result['next']='historical_replay queued'
            project_id=str(job.payload.get('research_project_id') or '')
            research_cid=str(job.payload.get('research_canonical_id') or result.get('canonical_id') or '')
            if project_id and research_cid:
                child=self.lab.enqueue_job('research_project_run',f'Resume research: {project_id} / {research_cid}',{
                    'research_project_id':project_id,'canonical_id':research_cid,
                    'attempt':int(job.payload.get('research_attempt') or 1)})
                result['research_resume_job']=child.id
            return result
        if job.kind=='derivative_metric_backfill':
            payload=dict(job.payload); provider=str(payload.get('provider') or '').lower(); symbol=str(payload.get('symbol') or '')
            await progress(.02,f"Derivative metrics: {provider or '?'} {symbol or '?'}")
            if provider=='bybit':
                result=await self.bybit_metrics.backfill(
                    symbol=symbol,
                    start_ms=int(payload.get('start_ms') or 1609459200000),
                    end_ms=int(payload.get('end_ms') or int(time.time()*1000)),
                    progress=progress,
                )
            else:
                result=await self.backfiller.derivative_metrics.backfill(payload,progress)
            result['metric_lake']=await asyncio.to_thread(self.backfiller.metric_lake.stats)
            project_id=str(job.payload.get('research_project_id') or '')
            research_cid=str(job.payload.get('research_canonical_id') or result.get('canonical_id') or '')
            if project_id and research_cid:
                child=self.lab.enqueue_job('research_project_run',f'Resume research: {project_id} / {research_cid}',{
                    'research_project_id':project_id,'canonical_id':research_cid,
                    'attempt':int(job.payload.get('research_attempt') or 1)})
                result['research_resume_job']=child.id
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
            if int(result.get('events') or 0)>=40: result['strategy_jobs_queued']=self._enqueue_matching_strategies(cid,interval)
            await progress(1,f'Historical Replay завершён: {cid} / {result.get("status")}')
            return result
        if job.kind=='verify_lake':
            await progress(.5,'Проверка Parquet Data Lake')
            result=await asyncio.to_thread(self.lake.verify)
            await progress(1,'Data Lake проверен')
            return result
        if job.kind=='strategy_run':
            strategy_id=str(job.payload['strategy_id']); canonical_id=str(job.payload['canonical_id']); spec=self.lab.get_strategy(strategy_id)
            if spec is None: raise KeyError(f'strategy {strategy_id} not found')
            await progress(.1,f'Загрузка истории {canonical_id}')
            frame=await asyncio.to_thread(self.lake.read_candles,canonical_id,spec.interval)
            await progress(.35,f'Поиск событий, параметров и controls: {canonical_id}')
            if str(spec.event.get('type'))=='buy_dip_grid': result=await asyncio.to_thread(run_buy_dip_grid,spec,canonical_id,frame)
            else: result=await asyncio.to_thread(self.machine.run,spec,canonical_id,frame)
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

    async def _collect_planner_quotes(self) -> tuple[list[Any], list[str]]:
        collected=await asyncio.gather(*(source.collect() for source in self._planner_sources),return_exceptions=True)
        quotes=[]; source_errors=[]
        for row in collected:
            if isinstance(row,BaseException): source_errors.append(str(row)[:300]); continue
            chunk,health=row; quotes.extend(chunk)
            if getattr(health,'error',None): source_errors.append(str(health.error)[:300])
        return quotes,source_errors

    async def _autoplan_idle(self) -> int:
        now=time.time()
        if now-self._last_auto_plan_s < 30: return 0
        self._last_auto_plan_s=now; self.last_action='MAX: ищу пробелы истории и derivative metrics'
        quotes,source_errors=await self._collect_planner_quotes(); jobs=self.lab.list_jobs(8000); now_ms=int(time.time()*1000)

        policy=self.control.get()
        history_payloads,history_stats=build_history_plan(quotes,jobs,batch_size=policy.history_batch_size)
        history_stats.update({'last_plan_at_ms':now_ms,'discovered_quotes':len(quotes),'source_errors':source_errors[:4]})
        self._auto_history=history_stats
        for payload in history_payloads: self.lab.enqueue_job('historical_backfill',history_title(payload),payload)

        metric_payloads=[]; metric_stats=self._auto_metrics
        if len(history_payloads)<=max(1,policy.history_batch_size//2):
            metric_payloads,metric_stats=build_metric_plan(quotes,jobs,batch_size=policy.metric_batch_size)
            metric_stats.update({'last_plan_at_ms':now_ms,'discovered_quotes':len(quotes),'source_errors':source_errors[:4]})
            for payload in metric_payloads: self.lab.enqueue_job('derivative_metric_backfill',metric_title(payload),payload)
        else:
            _,metric_stats=build_metric_plan(quotes,jobs,batch_size=0)
            metric_stats.update({'last_plan_at_ms':now_ms,'discovered_quotes':len(quotes),'deferred_for_history':True,'source_errors':source_errors[:4]})
        self._auto_metrics=metric_stats

        total=len(history_payloads)+len(metric_payloads)
        if total:
            self.last_action=(f"Автопилот: +{len(history_payloads)} history · +{len(metric_payloads)} metrics · "
                              f"history {history_stats.get('known_total',0)}/{history_stats.get('target_total',0)} · "
                              f"metrics {metric_stats.get('known_total',0)}/{metric_stats.get('target_total',0)}")
        elif history_stats.get('target_total',0) or metric_stats.get('target_total',0):
            self.last_action=(f"Автопилот: history готово {history_stats.get('done',0)}/{history_stats.get('target_total',0)} · "
                              f"metrics готово {metric_stats.get('done',0)}/{metric_stats.get('target_total',0)} · "
                              f"ошибок {history_stats.get('failed',0)+metric_stats.get('failed',0)}")
        else:
            self.last_action='MAX: ждём доступный market universe для автоплана'
        return total

    def _refresh_resource_snapshot(self) -> None:
        state=self.control.get()
        try:
            cpu=float(psutil.cpu_percent(interval=None))
            ram=float(psutil.virtual_memory().percent)
        except Exception:
            cpu=0.0; ram=0.0
        reasons=[]
        if cpu >= float(state.cpu_soft_limit_pct):
            reasons.append(f'CPU {cpu:.0f}% ≥ {state.cpu_soft_limit_pct}%')
        if ram >= float(state.ram_soft_limit_pct):
            reasons.append(f'RAM {ram:.0f}% ≥ {state.ram_soft_limit_pct}%')
        self._resource_snapshot={
            'cpu_percent':round(cpu,1),
            'ram_percent':round(ram,1),
            'cpu_soft_limit_pct':state.cpu_soft_limit_pct,
            'ram_soft_limit_pct':state.ram_soft_limit_pct,
            'throttled':bool(reasons),
            'reason':' · '.join(reasons),
            'ts_ms':int(time.time()*1000),
        }

    async def _worker_loop(self, worker_id: int) -> None:
        while True:
            state=self.control.get()
            desired=max(1,min(int(state.heavy_workers),self._max_worker_slots))
            if not state.heavy_allowed:
                self._worker_states[worker_id]={'state':'paused','reason':f'mode {state.mode.upper()}'}
                if worker_id==0:
                    self.last_action='Тяжёлые расчёты на паузе — включи МАКС'
                await asyncio.sleep(1.5)
                continue
            if worker_id >= desired:
                self._worker_states[worker_id]={'state':'standby','reason':f'workers={desired}'}
                await asyncio.sleep(1.5)
                continue
            if bool(self._resource_snapshot.get('throttled')):
                reason=str(self._resource_snapshot.get('reason') or 'resource soft limit')
                self._worker_states[worker_id]={'state':'throttled','reason':reason}
                if worker_id==0:
                    self.last_action=f'Ресурсный governor: новые heavy jobs на паузе · {reason}'
                await asyncio.sleep(2)
                continue

            job=self.lab.claim_next_job()
            if job is None:
                self._worker_states[worker_id]={'state':'idle','reason':'queue empty'}
                if worker_id==0:
                    try:
                        assert self._planner_lock is not None
                        async with self._planner_lock:
                            queued=await self._autoplan_idle()
                    except asyncio.CancelledError:
                        raise
                    except Exception as exc:
                        self.last_error=f'auto planner: {exc}'
                        self.last_action=f'Автопилот: ошибка планировщика — {str(exc)[:180]}'
                        await asyncio.sleep(10)
                        continue
                    if queued:
                        await asyncio.sleep(.2)
                        continue
                await asyncio.sleep(1)
                continue

            self.last_error=None
            self._active_jobs[worker_id]={
                'worker_id':worker_id,'job_id':job.id,'kind':job.kind,'title':job.title_ru,
                'started_at_ms':int(time.time()*1000),
            }
            self._worker_states[worker_id]={'state':'running','job_id':job.id,'kind':job.kind,'title':job.title_ru}
            self.last_action=f'W{worker_id+1}: {job.title_ru} — запуск'
            try:
                result=await self._execute(job)
                self.lab.update_job(job.id,status='done',progress=1,result=result,error='')
            except asyncio.CancelledError:
                raise
            except ResearchPaused:
                mode=self.control.get().mode.upper()
                self.last_error=None
                self.last_action=f'W{worker_id+1}: {job.title_ru} — пауза {mode}; продолжится в МАКС'
                self.lab.update_job(job.id,status='queued',progress=0,error='')
            except Exception as exc:
                self.last_error=str(exc)
                self.lab.update_job(job.id,status='failed',error=f'{exc}\n{traceback.format_exc()[-3000:]}')
            finally:
                self._active_jobs.pop(worker_id,None)
                self._worker_states[worker_id]={'state':'idle','reason':'job finished'}
            await asyncio.sleep(.1)

    async def _loop(self) -> None:
        self._running=True
        self._planner_lock=asyncio.Lock()
        self._worker_tasks=[
            asyncio.create_task(self._worker_loop(i),name=f'tqs-research-worker-{i+1}')
            for i in range(self._max_worker_slots)
        ]
        try:
            while True:
                self._refresh_resource_snapshot()
                await asyncio.sleep(2)
        finally:
            for task in self._worker_tasks:
                if not task.done():
                    task.cancel()
            for task in self._worker_tasks:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception:
                    pass
            self._worker_tasks=[]
            self._active_jobs.clear()
            self._running=False
