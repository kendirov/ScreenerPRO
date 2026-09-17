from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

import psutil
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .briefing import BriefingBuilder
from .control import ControlCenter
from .historical import HistoricalBackfiller
from .http import JsonHttp
from .lab_store import LabStore
from .lake import DataLake
from .models import AssetClass, HypothesisCreate
from .moex_lab import MoexLab
from .news import NewsCollector
from .relationships import mine_relationships
from .research_runtime import ResearchRuntime
from .service import IntelligenceService
from .snapshot_export import SnapshotExporter
from .sources import BinanceSource, BitgetSource, BybitSource, MoexSource, OkxSource, TwelveDataSource
from .storage import DuckStore
from .strategy_machine import StrategyMachine, default_round_buffer_spec
from .strategy_models import StrategySpec
from .update_manager import UpdateManager


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_prefix='TQS_', extra='ignore')
    db_path: str = './data/tqs-intelligence.duckdb'
    lab_db_path: str = './data/tqs-lab.sqlite3'
    control_path: str = './data/control.json'
    data_lake_root: str = './data-lake'
    drive_export_root: str = ''
    mode: str = 'light'
    heavy_workers: int = 2
    auto_update: bool = True
    refresh_seconds: int = 60
    enable_binance: bool = True
    enable_bitget: bool = True
    enable_bybit: bool = True
    enable_okx: bool = True
    enable_moex: bool = True
    twelve_data_api_key: str = ''
    twelve_data_symbols: str = 'AAPL,MSFT,NVDA,SPY,QQQ'
    rss_urls: str = ''
    episode_threshold: float = 70.0
    episode_close_grace_seconds: int = 180
    history_backfill_max: int = 8
    history_refresh_every: int = 5
    research_every_refreshes: int = 15
    moex_premium_enabled: bool = False
    telegram_news_enabled: bool = False


class ControlPatch(BaseModel):
    mode: Literal['stop','light','max'] | None = None
    data_lake_root: str | None = None
    drive_export_root: str | None = None
    auto_update: bool | None = None
    heavy_workers: int | None = Field(default=None, ge=1, le=16)


class IdeaCreate(BaseModel):
    title: str
    text: str
    kind: str = 'research'
    priority: int = Field(default=50, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)


class BackfillCreate(BaseModel):
    provider: Literal['binance','moex']
    symbol: str
    market_type: str = 'usdt-futures'
    interval: str = '5m'
    start_ms: int | None = None
    end_ms: int | None = None
    engine: str | None = None
    market: str | None = None


class StrategyRunCreate(BaseModel):
    canonical_id: str


class SnapshotExportRequest(BaseModel):
    full: bool = False


settings = Settings()
control_path = Path(settings.control_path)
control = ControlCenter(settings.control_path)
if not control_path.exists():
    control.update(mode=settings.mode, data_lake_root=settings.data_lake_root,
                   drive_export_root=settings.drive_export_root, auto_update=settings.auto_update,
                   heavy_workers=settings.heavy_workers, changed_by='env')

http = JsonHttp(); sources = []
if settings.enable_bitget: sources.append(BitgetSource(http))
if settings.enable_binance: sources.append(BinanceSource(http))
if settings.enable_bybit: sources.append(BybitSource(http))
if settings.enable_okx: sources.append(OkxSource(http))
if settings.enable_moex: sources.append(MoexSource(http))
twelve = TwelveDataSource(http, settings.twelve_data_api_key, [x.strip() for x in settings.twelve_data_symbols.split(',') if x.strip()])
if settings.twelve_data_api_key: sources.append(twelve)
news = NewsCollector(http, [x.strip() for x in settings.rss_urls.split(',') if x.strip()])
store = DuckStore(settings.db_path)
lab = LabStore(settings.lab_db_path)
lake = DataLake(control.get().data_lake_root)
backfiller = HistoricalBackfiller(http, lake)
strategy_machine = StrategyMachine()
research_runtime = ResearchRuntime(control, lab, backfiller, lake, strategy_machine)
service = IntelligenceService(
    sources, news, store, settings.refresh_seconds, settings.episode_threshold,
    settings.episode_close_grace_seconds, settings.history_backfill_max,
    settings.history_refresh_every, settings.research_every_refreshes, control=control,
)
briefing_builder = BriefingBuilder(store)
moex_lab = MoexLab(store)
exporter = SnapshotExporter(store, lab, control, lake, settings.db_path)
updater = UpdateManager('./data/update-request.json')


@asynccontextmanager
async def lifespan(_: FastAPI):
    if lab.get_strategy('TQS-STRAT-ROUND-BUFFER-001') is None:
        lab.save_strategy(default_round_buffer_spec())
    service.start(); research_runtime.start()
    yield
    await research_runtime.stop(); await service.stop(); await http.aclose()


STATIC = Path(__file__).with_name('static')
app = FastAPI(title='TQS Intelligence & Strategy Machine', version='0.4.0', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=str(STATIC)), name='static')


def _snapshot(): return service.state.snapshot


def _resources() -> dict[str, Any]:
    vm=psutil.virtual_memory(); proc=psutil.Process()
    try: disk=psutil.disk_usage(str(Path(control.get().data_lake_root).expanduser()))
    except Exception: disk=None
    return {
        'cpu_percent':psutil.cpu_percent(interval=None),'memory_percent':vm.percent,
        'memory_used_gb':round((vm.total-vm.available)/(1024**3),2),'memory_total_gb':round(vm.total/(1024**3),2),
        'process_memory_mb':round(proc.memory_info().rss/(1024**2),1),'process_threads':proc.num_threads(),
        'data_disk_free_gb':round(disk.free/(1024**3),2) if disk else None,'data_disk_total_gb':round(disk.total/(1024**3),2) if disk else None,
    }


def _capabilities() -> list[dict[str, object]]:
    enabled = {s.provider: s for s in sources}; rows = [s.capability(True) for s in sources]
    if 'twelvedata' not in enabled: rows.append(twelve.capability(False))
    rows.extend([
        {'provider':'news','name':'Новости: GDELT + RSS + future Telegram','enabled':True,'markets':['Все'],'asset_classes':[],
         'data_fields':['заголовки','ссылки','время','тикеры','темы','реакция рынка'],'access':'GDELT без ключа; RSS настраивается; Telegram adapter зарезервирован',
         'description':'Новость — отдельное событие; совпадение по времени не считается доказанной причиной движения.'},
        {'provider':'episodes','name':'Anomaly Episode Engine','enabled':True,'markets':['Все подключённые рынки'],'asset_classes':[],
         'data_fields':['жизненный цикл','график до/после','MFE/MAE','5м/15м/1ч/4ч/24ч','похожие случаи'],'access':'Локальный CPU',
         'description':'Аномалия хранится как воспроизводимый эпизод и рассматривается как кандидат места потенциального движения.'},
        {'provider':'lake','name':'Historical Parquet Data Lake','enabled':True,'markets':['MOEX','Crypto','Global later'],'asset_classes':[],
         'data_fields':['2021–2026+ history','partitioning','zstd','verification'],'access':control.get().data_lake_root,
         'description':'Тяжёлая история живёт на большом диске, а не в системном каталоге.'},
        {'provider':'strategy','name':'Strategy Machine','enabled':True,'markets':['Все с историей'],'asset_classes':[],
         'data_fields':['StrategySpec','controls','OOS','walk-forward','costs','robustness'],'access':'MAX mode',
         'description':'Первая стратегия — round/buffer bounce; новые идеи добавляются модулями без переписывания ядра.'},
        {'provider':'moex-premium','name':'MOEX Premium / participant positions','enabled':settings.moex_premium_enabled,'markets':['MOEX derivatives'],'asset_classes':['future','option'],
         'data_fields':['OI','физлица long/short','юрлица long/short','число участников','5m deltas'],'access':'Подписка/credentials позже',
         'description':'Контракт уже заложен; credentials включат дополнительные признаки в общую машину.'},
    ])
    return rows


@app.get('/', include_in_schema=False)
async def dashboard(): return FileResponse(STATIC / 'index.html')


@app.get('/api/health')
async def health():
    snapshot=_snapshot()
    return {'ok':True,'initializing':snapshot is None,'version':app.version,'runtime':service.runtime_status(),
            'research_runtime':research_runtime.status(),'control':control.status(),'resources':_resources(),
            'generated_at_ms':snapshot.generated_at_ms if snapshot else None,
            'sources':[x.model_dump(mode='json') for x in service.current_health()],'storage':store.stats(),'lab':lab.stats()}


@app.get('/api/control')
async def get_control(): return {'control':control.status(),'resources':_resources(),'research_runtime':research_runtime.status(),'update':updater.status(False)}


@app.post('/api/control')
async def set_control(request: ControlPatch):
    old=control.get(); changes=request.model_dump(exclude_none=True); changes['changed_by']='ui'
    state=control.update(**changes); restart_required=state.data_lake_root!=old.data_lake_root
    service.log('info','control',f'Режим/настройки изменены: {state.mode.upper()}',restart_required=restart_required)
    return {'ok':True,'control':control.status(),'restart_required':restart_required,
            'message':'Путь Data Lake изменён; нажми Обновить/перезапусти TQS, чтобы тяжёлые workers использовали новый путь.' if restart_required else 'Применено сразу.'}


@app.post('/api/refresh')
async def refresh():
    accepted=service.request_refresh(); return {'ok':True,'accepted':accepted,'message':'Сбор запущен' if accepted else 'Сбор уже выполняется'}


@app.get('/api/overview')
async def overview():
    snapshot=_snapshot(); classes={}
    if snapshot:
        for quote in snapshot.quotes: classes[quote.asset_class.value]=classes.get(quote.asset_class.value,0)+1
    stats=store.stats()
    return {'initializing':snapshot is None,'version':app.version,'generated_at_ms':snapshot.generated_at_ms if snapshot else None,
            'quote_count':len(snapshot.quotes) if snapshot else 0,'anomaly_count':len(snapshot.anomalies) if snapshot else 0,
            'active_episode_count':stats.get('active_episodes',0),'episode_count':stats.get('anomaly_episodes',0),
            'news_count':len(snapshot.news) if snapshot else 0,'asset_classes':classes,
            'sources':[x.model_dump(mode='json') for x in service.current_health()],'runtime':service.runtime_status(),
            'research_runtime':research_runtime.status(),'control':control.status(),'resources':_resources(),'storage':stats,'lab':lab.stats(),
            'top_anomalies':[x.model_dump(mode='json') for x in snapshot.anomalies[:30]] if snapshot else []}


@app.get('/api/system')
async def system():
    return {'version':app.version,'runtime':service.runtime_status(),'research_runtime':research_runtime.status(),
            'control':control.status(),'resources':_resources(),'storage':store.stats(),'lab':lab.stats(),'data_lake':lake.verify(),
            'config':{'refresh_seconds':settings.refresh_seconds,'db_path':settings.db_path,'rss_feeds':len(news.rss_urls),
                      'twelve_data_enabled':bool(settings.twelve_data_api_key),'episode_threshold':settings.episode_threshold,
                      'moex_premium_enabled':settings.moex_premium_enabled,'telegram_news_enabled':settings.telegram_news_enabled},
            'pipeline':['collect','normalize','persist','anomaly','episode lifecycle','historical lake','strategy/event study',
                        'control/OOS/walk-forward/costs','relationship mining','briefing snapshot','portable AI snapshot']}


@app.get('/api/system/update')
async def update_status(fetch: bool=False): return updater.status(fetch)


@app.post('/api/system/update')
async def request_update(): return updater.request(False)


@app.get('/api/capabilities')
async def capabilities(): return _capabilities()


@app.get('/api/anomalies')
async def anomalies(limit:int=Query(100,ge=1,le=1000),asset_class:AssetClass|None=None,provider:str|None=None,min_score:float=Query(50,ge=0,le=100)):
    snapshot=_snapshot(); rows=snapshot.anomalies if snapshot else []
    if asset_class: rows=[x for x in rows if x.asset_class==asset_class]
    if provider: rows=[x for x in rows if x.provider==provider]
    return [x.model_dump(mode='json') for x in rows if x.score>=min_score][:limit]


@app.get('/api/quotes')
async def quotes(q:str='',provider:str='',market_type:str='',asset_class:AssetClass|None=None,limit:int=Query(500,ge=1,le=10000)):
    snapshot=_snapshot(); rows=snapshot.quotes if snapshot else []; needle=q.lower().strip()
    if provider: rows=[x for x in rows if x.provider==provider]
    if market_type: rows=[x for x in rows if x.market_type==market_type]
    if asset_class: rows=[x for x in rows if x.asset_class==asset_class]
    if needle: rows=[x for x in rows if needle in x.symbol.lower() or needle in (x.display_symbol or '').lower() or needle in x.venue.lower()]
    rows=sorted(rows,key=lambda x:(x.turnover_24h or 0,abs(x.change_24h_pct or 0)),reverse=True)
    return [x.model_dump(mode='json') for x in rows[:limit]]


@app.get('/api/moex')
async def moex(): return moex_lab.overview(_snapshot())


@app.get('/api/moex/lab')
async def moex_market_lab(): return moex_lab.overview(_snapshot())


@app.get('/api/moex/lab/{canonical_id:path}')
async def moex_instrument_lab(canonical_id:str):
    snapshot=_snapshot(); quote=next((q for q in (snapshot.quotes if snapshot else []) if q.canonical_id==canonical_id),None)
    if quote is None: raise HTTPException(404,'instrument not found in current snapshot')
    return {'instrument':moex_lab.enrich_quote(quote),'history_stats':moex_lab.instrument_history_stats(canonical_id)}


@app.get('/api/episodes')
async def episodes(limit:int=Query(200,ge=1,le=2000),status:str='',provider:str='',q:str=''):
    return [x.model_dump(mode='json') for x in store.list_episodes(limit,status,provider,q)]


@app.get('/api/episodes/{episode_id}')
async def episode_detail(episode_id:str,before_hours:int=Query(24,ge=1,le=168),after_hours:int=Query(24,ge=1,le=168)):
    episode=store.get_episode(episode_id)
    if episode is None: raise HTTPException(status_code=404,detail='episode not found')
    outcome=store.episode_outcome(episode_id); series=store.episode_series(episode_id,before_hours*3600_000,after_hours*3600_000)
    similar=[]
    for item in store.similar_episodes(episode,20):
        try: out=store.episode_outcome(item.id).model_dump(mode='json')
        except Exception: out=None
        similar.append({'episode':item.model_dump(mode='json'),'outcome':out})
    return {'episode':episode.model_dump(mode='json'),'outcome':outcome.model_dump(mode='json'),'series':series,'similar':similar}


@app.get('/api/research/findings')
async def research_findings(limit:int=Query(100,ge=1,le=1000)):
    return [x.model_dump(mode='json') for x in store.list_findings(limit)]


@app.get('/api/research/runtime')
async def research_status(): return research_runtime.status()


@app.get('/api/news')
async def news_items(limit:int=Query(100,ge=1,le=500),symbol:str=''):
    snapshot=_snapshot(); rows=snapshot.news if snapshot else []
    if symbol: rows=[x for x in rows if symbol.upper() in {s.upper() for s in x.symbols}]
    return [x.model_dump(mode='json') for x in rows[:limit]]


@app.get('/api/relationships')
async def relationships(limit:int=Query(50,ge=1,le=500),min_samples:int=Query(20,ge=5,le=1000)):
    return [x.model_dump(mode='json') for x in mine_relationships(store.price_series(),min_samples=min_samples)[:limit]]


@app.get('/api/logs')
async def logs(limit:int=Query(200,ge=1,le=2000),level:str='',component:str=''):
    return [x.model_dump(mode='json') for x in store.list_logs(limit,level,component)]


@app.post('/api/hypotheses')
async def create_hypothesis(request:HypothesisCreate): return store.create_hypothesis(request,int(time.time()*1000)).model_dump(mode='json')


@app.get('/api/hypotheses')
async def list_hypotheses(limit:int=Query(100,ge=1,le=500)): return [x.model_dump(mode='json') for x in store.list_hypotheses(limit)]


@app.post('/api/ideas')
async def create_idea(request:IdeaCreate): return lab.add_idea(request.title,request.text,'artem',request.kind,request.priority,request.tags)


@app.get('/api/ideas')
async def ideas(limit:int=Query(300,ge=1,le=2000),status:str=''): return lab.list_ideas(limit,status)


@app.post('/api/backfill')
async def create_backfill(request:BackfillCreate):
    payload=request.model_dump(exclude_none=True)
    if request.provider=='moex':
        payload.setdefault('engine','futures' if 'future' in request.market_type or request.market_type=='forts' else 'stock')
        payload.setdefault('market','forts' if payload['engine']=='futures' else 'shares')
        if request.interval=='5m': payload['interval']='10m'
    job=lab.enqueue_job('historical_backfill',f"История {request.provider.upper()} {request.symbol}",payload)
    return job.model_dump(mode='json')


@app.get('/api/jobs')
async def jobs(limit:int=Query(300,ge=1,le=2000)): return [x.model_dump(mode='json') for x in lab.list_jobs(limit)]


@app.get('/api/strategies')
async def strategies(): return [x.model_dump(mode='json') for x in lab.list_strategies()]


@app.post('/api/strategies')
async def save_strategy(spec:StrategySpec): return lab.save_strategy(spec).model_dump(mode='json')


@app.get('/api/strategies/runs')
async def strategy_runs(strategy_id:str='',limit:int=Query(200,ge=1,le=2000)):
    return [x.model_dump(mode='json') for x in lab.list_strategy_runs(strategy_id,limit)]


@app.post('/api/strategies/{strategy_id}/run')
async def run_strategy(strategy_id:str,request:StrategyRunCreate):
    spec=lab.get_strategy(strategy_id)
    if spec is None: raise HTTPException(404,'strategy not found')
    job=lab.enqueue_job('strategy_run',f"Стратегия: {spec.name_ru} / {request.canonical_id}",{'strategy_id':strategy_id,'canonical_id':request.canonical_id})
    return job.model_dump(mode='json')


@app.get('/api/data-lake')
async def data_lake_status(): return lake.verify()


@app.post('/api/data-lake/verify')
async def verify_data_lake(): return lab.enqueue_job('verify_lake','Проверка Data Lake',{}).model_dump(mode='json')


@app.get('/api/briefing')
async def briefing(): return briefing_builder.build(_snapshot())


@app.post('/api/export/snapshot')
async def export_snapshot(request:SnapshotExportRequest):
    rels=mine_relationships(store.price_series(),min_samples=20)[:200]
    return exporter.export(runtime=service.runtime_status(),research_runtime=research_runtime.status(),snapshot=_snapshot(),relationships=rels,full=request.full)


def main()->None:
    uvicorn.run('tqs_intelligence.api:app',host=os.getenv('TQS_HOST','127.0.0.1'),port=int(os.getenv('TQS_PORT','8787')),reload=False)


if __name__=='__main__': main()
