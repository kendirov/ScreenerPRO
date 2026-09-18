from __future__ import annotations

import asyncio
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

from . import __version__
from .account_intelligence import AccountIntelStore, AccountIntelligenceService
from .ai_control import AiControlBridge
from .briefing import BriefingBuilder
from .control import ControlCenter
from .historical import HistoricalBackfiller
from .http import JsonHttp
from .instrument_lab import InstrumentLab
from .lab_store import LabStore
from .lake import DataLake
from .lchi_public import LchiPublicService, LchiPublicStore
from .lchi_deals import LchiDealsCollector
from .models import AssetClass, HypothesisCreate
from .moex_lab import MoexLab
from .moex_features import MoexFeatureEngine
from .metric_lake import MetricLake
from .news import NewsCollector
from .pulse_public import PulsePublicService, PulsePublicStore
from .relationships import mine_relationships
from .research_runtime import ResearchRuntime
from .remote_node import remote_node_status, repair_server_contract
from .resource_monitor import ResourceMonitor
from .runtime_audit import build_runtime_audit, audit_text
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
    accounts_db_path: str = './data/tqs-accounts.sqlite3'
    lchi_db_path: str = './data/tqs-lchi.sqlite3'
    pulse_db_path: str = './data/tqs-pulse.sqlite3'
    control_path: str = './data/control.json'
    data_lake_root: str = './data-lake'
    drive_export_root: str = ''
    mode: str = 'light'
    heavy_workers: int = 2
    history_batch_size: int = 4
    metric_batch_size: int = 2
    refresh_seconds_override: int = 0
    cpu_soft_limit_pct: int = 90
    ram_soft_limit_pct: int = 92
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
    account_refresh_seconds: int = 60
    account_history_days: int = 30
    hyperliquid_wallets: str = ''
    pulse_handles: str = ''
    pulse_refresh_seconds: int = 300
    ai_control_url: str = 'https://raw.githubusercontent.com/kendirov/ScreenerPRO/tqs-control/tqs-intelligence/control/remote-command.json'
    ai_control_poll_seconds: int = 30


class ControlPatch(BaseModel):
    mode: Literal['stop','light','max'] | None = None
    data_lake_root: str | None = None
    drive_export_root: str | None = None
    auto_update: bool | None = None
    heavy_workers: int | None = Field(default=None, ge=1, le=4)
    history_batch_size: int | None = Field(default=None, ge=1, le=16)
    metric_batch_size: int | None = Field(default=None, ge=1, le=8)
    refresh_seconds_override: int | None = Field(default=None, ge=0, le=900)
    cpu_soft_limit_pct: int | None = Field(default=None, ge=50, le=99)
    ram_soft_limit_pct: int | None = Field(default=None, ge=50, le=99)


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


class AccountTrackCreate(BaseModel):
    source: Literal['hyperliquid'] = 'hyperliquid'
    account_id: str
    label: str = ''


settings = Settings()
control_path = Path(settings.control_path)
control_preexisting = control_path.exists()
control = ControlCenter(settings.control_path)
if not control_preexisting:
    control.update(
        mode=settings.mode,
        data_lake_root=settings.data_lake_root,
        drive_export_root=settings.drive_export_root,
        auto_update=settings.auto_update,
        heavy_workers=settings.heavy_workers,
        history_batch_size=settings.history_batch_size,
        metric_batch_size=settings.metric_batch_size,
        refresh_seconds_override=settings.refresh_seconds_override,
        cpu_soft_limit_pct=settings.cpu_soft_limit_pct,
        ram_soft_limit_pct=settings.ram_soft_limit_pct,
        changed_by='env-initial',
    )
else:
    # Repair the v0.12 service-context regression without overriding durable
    # owner controls. If control.json was accidentally moved to the default
    # local ./data-lake but .env explicitly names a real data root (for example
    # D:\\TQS_DATA), restore that path. Other runtime policy stays untouched.
    current_control = control.get()
    explicit = set(getattr(settings, 'model_fields_set', set()) or set())
    path_repair: dict[str, Any] = {}
    current_root = str(current_control.data_lake_root or '').strip()
    configured_root = str(settings.data_lake_root or '').strip()
    if (
        'data_lake_root' in explicit
        and configured_root
        and configured_root not in {'./data-lake', '.\\data-lake'}
        and current_root in {'', './data-lake', '.\\data-lake'}
    ):
        path_repair['data_lake_root'] = configured_root
    if (
        'drive_export_root' in explicit
        and str(settings.drive_export_root or '').strip()
        and not str(current_control.drive_export_root or '').strip()
    ):
        path_repair['drive_export_root'] = settings.drive_export_root
    if path_repair:
        control.update(**path_repair, changed_by='env-path-repair')

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
account_store = AccountIntelStore(settings.accounts_db_path)
lchi_store = LchiPublicStore(settings.lchi_db_path)
lchi_deals = LchiDealsCollector(lchi_store, http)
lchi_service = LchiPublicService(control, lchi_store, http, deals_collector=lchi_deals)
pulse_store = PulsePublicStore(settings.pulse_db_path)
pulse_service = PulsePublicService(
    control, pulse_store, http,
    [x.strip() for x in settings.pulse_handles.split(',') if x.strip()],
    settings.pulse_refresh_seconds,
)
lake = DataLake(control.get().data_lake_root)
metric_lake = MetricLake(lake.root)
backfiller = HistoricalBackfiller(http, lake)
strategy_machine = StrategyMachine()
research_runtime = ResearchRuntime(control, lab, backfiller, lake, strategy_machine)
resource_monitor = ResourceMonitor(Path(__file__).resolve().parents[2])
account_service = AccountIntelligenceService(control, account_store, http, settings.account_refresh_seconds, settings.account_history_days)
moex_feature_engine = MoexFeatureEngine(store, lchi_store=lchi_store, metric_lake=metric_lake)
service = IntelligenceService(
    sources, news, store, settings.refresh_seconds, settings.episode_threshold,
    settings.episode_close_grace_seconds, settings.history_backfill_max,
    settings.history_refresh_every, settings.research_every_refreshes, control=control,
    moex_feature_engine=moex_feature_engine,
)
briefing_builder = BriefingBuilder(store)
moex_lab = MoexLab(store)
instrument_lab = InstrumentLab(store, lake, lab, metric_lake=metric_lake)
exporter = SnapshotExporter(store, lab, control, lake, settings.db_path, account_store=account_store)
updater = UpdateManager('./data/update-request.json')
ai_control = AiControlBridge(
    url=settings.ai_control_url,
    control=control,
    updater=updater,
    service=service,
    poll_seconds=settings.ai_control_poll_seconds,
)
RUNTIME_STARTED_AT_MS = int(time.time() * 1000)
RUNTIME_INSTANCE_ID = f'{RUNTIME_STARTED_AT_MS}-{os.getpid()}'


@asynccontextmanager
async def lifespan(_: FastAPI):
    if lab.get_strategy('TQS-STRAT-ROUND-BUFFER-001') is None:
        lab.save_strategy(default_round_buffer_spec())
    for wallet in [x.strip() for x in settings.hyperliquid_wallets.split(',') if x.strip()]:
        account_store.track('hyperliquid', wallet, 'env')
    service.start(); research_runtime.start(); account_service.start(); lchi_service.start(); pulse_service.start(); ai_control.start()

    async def repair_remote_contract() -> None:
        try:
            result = await asyncio.to_thread(repair_server_contract)
            if result.get("needed"):
                service.log(
                    "info" if result.get("ok") else "warning",
                    "remote-node",
                    "Post-update server contract repair completed" if result.get("ok") else "Post-update server contract repair failed",
                    result=result,
                )
        except Exception as exc:
            service.log("warning", "remote-node", "Post-update server contract repair error", error=str(exc)[:500])

    repair_task = asyncio.create_task(repair_remote_contract(), name="tqs-remote-contract-repair")
    yield
    if not repair_task.done():
        repair_task.cancel()
    await ai_control.stop(); await pulse_service.stop(); await lchi_service.stop(); await account_service.stop(); await research_runtime.stop(); await service.stop(); await http.aclose()


STATIC = Path(__file__).with_name('static')
app = FastAPI(title='TQS Intelligence & Strategy Machine', version=__version__, lifespan=lifespan)
app.mount('/static', StaticFiles(directory=str(STATIC)), name='static')


@app.middleware('http')
async def disable_stale_ui_cache(request, call_next):
    response = await call_next(request)
    if request.url.path == '/' or request.url.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


def _snapshot(): return service.state.snapshot


def _identity() -> dict[str, Any]:
    return {
        'platform': 'TQS',
        'module': 'TQS Intelligence',
        'version': app.version,
        'runtime_instance_id': RUNTIME_INSTANCE_ID,
        'pid': os.getpid(),
        'started_at_ms': RUNTIME_STARTED_AT_MS,
    }


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
        {'provider':'accounts','name':'Account / Position Intelligence','enabled':True,'markets':['Hyperliquid public accounts','MOEX participant aggregates later'],'asset_classes':[],
         'data_fields':['open positions','fills','PnL samples','long/short bias','instrument concentration','execution style'],'access':'Публичные данные / разрешённые feeds',
         'description':'Публичные счета анализируются описательно; мотив/стоп/логика не объявляются фактами без синхронизации с рыночными данными.'},
        {'provider':'pulse-public','name':'T-Bank Pulse public profiles','enabled':True,'markets':['MOEX / Russian retail context'],'asset_classes':[],
         'data_fields':['public profile','public trade markers when present in SSR','side/time/price','size_known=false'],'access':'Public profile pages; client-side/auth-only operations remain unavailable',
         'description':'Public profile evidence only. Exact operation quantity is never estimated when hidden by Pulse.'},
        {'provider':'instrument-lab','name':'Universal Instrument Lab','enabled':True,'markets':['Все подключённые рынки'],'asset_classes':[],
         'data_fields':['candles','live snapshots','anomaly overlay','OI','funding','episodes','news','strategy runs','related instruments'],'access':'Локальный terminal',
         'description':'Один инструмент → максимум накопленного контекста и дозагрузка истории из того же интерфейса.'},
        {'provider':'lake','name':'Historical Parquet Data Lake','enabled':True,'markets':['MOEX','Crypto','Global later'],'asset_classes':[],
         'data_fields':['2021–2026+ history','partitioning','zstd','verification'],'access':control.get().data_lake_root,
         'description':'Тяжёлая история живёт на большом диске, а не в системном каталоге.'},
        {'provider':'strategy','name':'Strategy Machine v2','enabled':True,'markets':['Все с историей'],'asset_classes':[],
         'data_fields':['StrategySpec','parameter sweeps','controls','OOS','walk-forward','costs','profit/loss diagnostics'],'access':'MAX mode',
         'description':'Round/buffer + buy-the-dip grids; новые идеи добавляются как воспроизводимые StrategySpec.'},
        {'provider':'moex-premium','name':'MOEX Premium / participant positions','enabled':settings.moex_premium_enabled,'markets':['MOEX derivatives'],'asset_classes':['future','option'],
         'data_fields':['OI','физлица long/short','юрлица long/short','число участников','intraday deltas'],'access':'Подписка/credentials позже',
         'description':'Агрегированные participant данные будут частью общей feature machine; не подменяются индивидуальными счетами.'},
    ])
    return rows


@app.get('/', include_in_schema=False)
async def dashboard(): return FileResponse(STATIC / 'index.html', headers={'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0'})


@app.get('/api/health')
async def health():
    # Liveness must never wait for analytical COUNT(*) queries or Parquet work.
    snapshot=_snapshot()
    return {'ok':True,'initializing':snapshot is None,'version':app.version,'identity':_identity(),'runtime':service.runtime_status(),
            'research_runtime':research_runtime.quick_status(),'account_intelligence':account_service.quick_status(),'lchi_public':lchi_service.quick_status(),'pulse_public':pulse_service.status(),'ai_control':ai_control.status(),
            'control':control.status(),'resources':_resources(),'generated_at_ms':snapshot.generated_at_ms if snapshot else None,
            'sources':[x.model_dump(mode='json') for x in service.current_health()],
            'storage':{'deferred':True},'lab':{'deferred':True}}


@app.get('/api/control')
def get_control(): return {'control':control.status(),'resources':_resources(),'research_runtime':research_runtime.status(),'account_intelligence':account_service.status(),'update':updater.status(False),'ai_control':ai_control.status()}

@app.get('/api/resources')
def get_resources():
    return resource_monitor.snapshot(
        control=control,
        research_runtime=research_runtime,
        service=service,
        data_root=control.get().data_lake_root,
    )



@app.post('/api/control')
def set_control(request: ControlPatch):
    old=control.get(); changes=request.model_dump(exclude_none=True); changes['changed_by']='ui'
    state=control.update(**changes); restart_required=state.data_lake_root!=old.data_lake_root
    service.log('info','control',f'Режим/настройки изменены: {state.mode.upper()}',restart_required=restart_required)
    return {'ok':True,'control':control.status(),'restart_required':restart_required,
            'message':'Путь Data Lake изменён; нажми Обновить/перезапусти TQS, чтобы тяжёлые workers использовали новый путь.' if restart_required else 'Применено сразу.'}


@app.post('/api/refresh')
async def refresh():
    accepted=service.request_refresh(); return {'ok':True,'accepted':accepted,'message':'Сбор запущен' if accepted else 'Сбор уже выполняется'}


@app.get('/api/overview')
def overview():
    snapshot=_snapshot(); classes={}
    if snapshot:
        for quote in snapshot.quotes: classes[quote.asset_class.value]=classes.get(quote.asset_class.value,0)+1
    stats=store.stats()
    return {'initializing':snapshot is None,'version':app.version,'identity':_identity(),'generated_at_ms':snapshot.generated_at_ms if snapshot else None,
            'quote_count':len(snapshot.quotes) if snapshot else 0,'anomaly_count':len(snapshot.anomalies) if snapshot else 0,
            'active_episode_count':stats.get('active_episodes',0),'episode_count':stats.get('anomaly_episodes',0),
            'news_count':len(snapshot.news) if snapshot else 0,'asset_classes':classes,
            'sources':[x.model_dump(mode='json') for x in service.current_health()],'runtime':service.runtime_status(),
            'research_runtime':research_runtime.status(),'account_intelligence':account_service.status(),'pulse_public':pulse_service.status(),
            'control':control.status(),'resources':_resources(),'storage':stats,'lab':lab.stats(),
            'top_anomalies':[x.model_dump(mode='json') for x in snapshot.anomalies[:30]] if snapshot else []}


@app.get('/api/system')
async def system():
    data_lake, storage_stats, lab_stats, research_status_full, account_status_full, remote_status_full = await asyncio.gather(
        asyncio.to_thread(lake.quick_stats),
        asyncio.to_thread(store.stats),
        asyncio.to_thread(lab.stats),
        asyncio.to_thread(research_runtime.status),
        asyncio.to_thread(account_service.status),
        asyncio.to_thread(remote_node_status),
    )
    return {'version':app.version,'identity':_identity(),'runtime':service.runtime_status(),'research_runtime':research_status_full,
            'account_intelligence':account_status_full,'control':control.status(),'resources':_resources(),'remote_node':remote_status_full,
            'storage':storage_stats,'lab':lab_stats,'data_lake':data_lake,
            'config':{'refresh_seconds':settings.refresh_seconds,'db_path':settings.db_path,'rss_feeds':len(news.rss_urls),
                      'twelve_data_enabled':bool(settings.twelve_data_api_key),'episode_threshold':settings.episode_threshold,
                      'moex_premium_enabled':settings.moex_premium_enabled,'telegram_news_enabled':settings.telegram_news_enabled},
            'pipeline':['collect','normalize','persist','anomaly','episode lifecycle','account/position intelligence','historical lake',
                        'strategy/event study','control/OOS/walk-forward/costs','relationship mining','briefing snapshot','portable AI snapshot']}


@app.get('/api/node/remote')
def node_remote_status():
    return remote_node_status()


@app.get('/api/ai-control')
def ai_control_status():
    return ai_control.status()


async def _build_audit_payload() -> dict[str, Any]:
    runtime = service.runtime_status()
    snapshot = _snapshot()
    storage, lake_state, lab_state, lchi_state, pulse_state, remote_state, update_state, logs = await asyncio.gather(
        asyncio.to_thread(store.stats),
        asyncio.to_thread(lake.verify),
        asyncio.to_thread(lab.stats),
        asyncio.to_thread(lchi_service.status),
        asyncio.to_thread(pulse_service.status),
        asyncio.to_thread(remote_node_status),
        asyncio.to_thread(updater.status, False),
        asyncio.to_thread(store.list_logs, 300),
    )
    resource_base = _resources()
    control_state = control.get()
    research_state = research_runtime.quick_status()
    resources_state = {
        "system": {
            "cpu_percent": resource_base.get("cpu_percent"),
            "ram_percent": resource_base.get("memory_percent"),
            "ram_used_gb": resource_base.get("memory_used_gb"),
            "ram_total_gb": resource_base.get("memory_total_gb"),
            "disk_free_gb": resource_base.get("data_disk_free_gb"),
            "disk_total_gb": resource_base.get("data_disk_total_gb"),
        },
        "policy": {
            "mode": control_state.mode,
            "heavy_workers": control_state.heavy_workers,
            "cpu_soft_limit_pct": control_state.cpu_soft_limit_pct,
            "ram_soft_limit_pct": control_state.ram_soft_limit_pct,
        },
        "effective": {
            "research_active_jobs": len(research_state.get("active_jobs") or []),
            "research_throttled": bool((research_state.get("resource_snapshot") or {}).get("throttled")),
            "research_throttle_reason": (research_state.get("resource_snapshot") or {}).get("reason") or "",
        },
        "tqs_processes": [],
        "stats_mode": "quick",
    }
    return await asyncio.to_thread(
        build_runtime_audit,
        version=app.version,
        runtime=runtime,
        snapshot=snapshot,
        storage=storage,
        lake=lake_state,
        lab=lab_state,
        lchi=lchi_state,
        pulse=pulse_state,
        remote=remote_state,
        update=update_state,
        recent_logs=logs,
        ai_control=ai_control.status(),
        resources=resources_state,
    )


@app.get('/api/audit')
async def runtime_audit():
    return await _build_audit_payload()


@app.get('/api/audit/text')
async def runtime_audit_text():
    payload = await _build_audit_payload()
    return {"text": audit_text(payload), "generated_at_ms": payload.get("generated_at_ms"), "overall": payload.get("overall")}


@app.get('/api/system/update')
def update_status(fetch: bool=False): return updater.status(fetch)


@app.post('/api/system/update')
def request_update(): return updater.request(False)


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


@app.get('/api/instrument/{canonical_id:path}')
async def universal_instrument(canonical_id:str):
    snapshot = _snapshot()
    return await asyncio.to_thread(instrument_lab.build, canonical_id, snapshot)


@app.get('/api/moex')
def moex():
    payload = moex_lab.overview(_snapshot())
    payload['lchi_public'] = lchi_service.status()
    payload['pulse_public'] = pulse_service.status()
    return payload


@app.get('/api/moex/intelligence')
def moex_intelligence(limit:int=Query(200,ge=1,le=1000)):
    return moex_feature_engine.snapshot(limit=limit)


@app.get('/api/moex/lab')
def moex_market_lab():
    payload = moex_lab.overview(_snapshot())
    payload['lchi_public'] = lchi_service.status()
    payload['pulse_public'] = pulse_service.status()
    return payload


@app.get('/api/moex/lab/{canonical_id:path}')
def moex_instrument_lab(canonical_id:str):
    snapshot=_snapshot(); quote=next((q for q in (snapshot.quotes if snapshot else []) if q.canonical_id==canonical_id),None)
    if quote is None: raise HTTPException(404,'instrument not found in current snapshot')
    return {'instrument':moex_lab.enrich_quote(quote),'history_stats':moex_lab.instrument_history_stats(canonical_id)}


@app.get('/api/moex/participants/lchi/status')
def lchi_status():
    return lchi_service.status()


@app.get('/api/moex/participants/lchi')
def lchi_participants(q:str='', limit:int=Query(200,ge=1,le=2000)):
    return lchi_store.participants(limit=limit, q=q)


@app.get('/api/moex/participants/lchi/account/{user_id}')
def lchi_account(user_id:str):
    payload = lchi_store.account(user_id)
    if payload is None:
        raise HTTPException(404, 'LCHI participant not found in local catalog')
    return payload


@app.get('/api/moex/participants/lchi/positions')
def lchi_positions(symbol:str='', limit:int=Query(500,ge=1,le=5000)):
    return lchi_store.current_positions(symbol=symbol, limit=limit)


@app.get('/api/moex/participants/lchi/events')
def lchi_events(symbol:str='', limit:int=Query(500,ge=1,le=5000)):
    return lchi_store.events(symbol=symbol, limit=limit)


@app.get('/api/moex/participants/lchi/trades')
def lchi_trades(symbol:str='', user_id:str='', limit:int=Query(1000,ge=1,le=10000)):
    return lchi_deals.trades(symbol=symbol, user_id=user_id, limit=limit)


@app.post('/api/moex/participants/lchi/account/{user_id}/trades/sync')
async def lchi_trades_sync(user_id:str):
    try:
        return await lchi_deals.sync(user_id)
    except Exception as exc:
        raise HTTPException(502, f'LCHI public trade snapshot failed: {exc}')


class PulseTrackCreate(BaseModel):
    handle: str


@app.get('/api/moex/participants/pulse/status')
def pulse_status():
    return pulse_service.status()


@app.get('/api/moex/participants/pulse')
def pulse_profiles(limit:int=Query(200,ge=1,le=2000)):
    return pulse_store.profiles(limit=limit)


@app.get('/api/moex/participants/pulse/events')
def pulse_events(symbol:str='', limit:int=Query(500,ge=1,le=5000)):
    return pulse_store.events(symbol=symbol, limit=limit)


@app.post('/api/moex/participants/pulse/track')
async def pulse_track(request:PulseTrackCreate):
    handle=request.handle.strip().lstrip('@')
    if not handle:
        raise HTTPException(400,'Pulse handle is required')
    return await pulse_service.sync(handle)


@app.get('/api/episodes')
def episodes(limit:int=Query(200,ge=1,le=2000),status:str='',provider:str='',q:str=''):
    return [x.model_dump(mode='json') for x in store.list_episodes(limit,status,provider,q)]


@app.get('/api/episodes/{episode_id}')
def episode_detail(episode_id:str,before_hours:int=Query(24,ge=1,le=168),after_hours:int=Query(24,ge=1,le=168)):
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
def research_findings(limit:int=Query(100,ge=1,le=1000)):
    return [x.model_dump(mode='json') for x in store.list_findings(limit)]


@app.get('/api/research/runtime')
def research_status(): return research_runtime.status()


@app.get('/api/news')
async def news_items(limit:int=Query(100,ge=1,le=500),symbol:str=''):
    snapshot=_snapshot(); rows=snapshot.news if snapshot else []
    if symbol: rows=[x for x in rows if symbol.upper() in {s.upper() for s in x.symbols}]
    return [x.model_dump(mode='json') for x in rows[:limit]]


@app.get('/api/relationships')
async def relationships(limit:int=Query(50,ge=1,le=500),min_samples:int=Query(20,ge=5,le=1000)):
    def build_relationships():
        return [x.model_dump(mode='json') for x in mine_relationships(store.price_series(),min_samples=min_samples)[:limit]]
    return await asyncio.to_thread(build_relationships)


@app.get('/api/logs')
def logs(limit:int=Query(200,ge=1,le=2000),level:str='',component:str=''):
    return [x.model_dump(mode='json') for x in store.list_logs(limit,level,component)]


@app.post('/api/hypotheses')
def create_hypothesis(request:HypothesisCreate): return store.create_hypothesis(request,int(time.time()*1000)).model_dump(mode='json')


@app.get('/api/hypotheses')
def list_hypotheses(limit:int=Query(100,ge=1,le=500)): return [x.model_dump(mode='json') for x in store.list_hypotheses(limit)]


@app.post('/api/ideas')
def create_idea(request:IdeaCreate): return lab.add_idea(request.title,request.text,'artem',request.kind,request.priority,request.tags)


@app.get('/api/ideas')
def ideas(limit:int=Query(300,ge=1,le=2000),status:str=''): return lab.list_ideas(limit,status)


@app.post('/api/accounts/track')
async def track_account(request:AccountTrackCreate):
    aid=request.account_id.strip()
    if request.source=='hyperliquid' and (len(aid)!=42 or not aid.startswith('0x')):
        raise HTTPException(400,'Hyperliquid address must be a 42-character 0x address')
    tracked=account_store.track(request.source,aid,request.label)
    try: sync=await account_service.sync_account(request.source,aid)
    except Exception as exc: sync={'ok':False,'error':str(exc)}
    return {'tracked':tracked.model_dump(mode='json'),'sync':sync}


@app.get('/api/accounts')
def accounts(): return {'status':account_service.status(),'profiles':account_store.profiles()}


@app.get('/api/accounts/positions')
def account_positions(source:str='',account_id:str='',limit:int=Query(500,ge=1,le=5000)):
    return account_store.current_positions(source,account_id,limit)


@app.get('/api/accounts/{source}/{account_id}/profile')
def account_profile(source:str,account_id:str):
    profile=account_store.profile(source,account_id)
    if profile is None: raise HTTPException(404,'tracked account not found')
    return {'profile':profile,'positions':account_store.current_positions(source,account_id,500),'fills':account_store.recent_fills(source,account_id,500)}


@app.post('/api/accounts/{source}/{account_id}/sync')
async def sync_account(source:str,account_id:str):
    try: return await account_service.sync_account(source,account_id)
    except ValueError as exc: raise HTTPException(400,str(exc))


@app.post('/api/backfill')
def create_backfill(request:BackfillCreate):
    payload=request.model_dump(exclude_none=True)
    if request.provider=='moex':
        payload.setdefault('engine','futures' if 'future' in request.market_type or request.market_type=='forts' else 'stock')
        payload.setdefault('market','forts' if payload['engine']=='futures' else 'shares')
        if request.interval=='5m': payload['interval']='10m'
    job=lab.enqueue_job('historical_backfill',f"История {request.provider.upper()} {request.symbol}",payload)
    return job.model_dump(mode='json')


@app.get('/api/jobs')
def jobs(limit:int=Query(300,ge=1,le=2000)): return [x.model_dump(mode='json') for x in lab.list_jobs(limit)]


def _metric_points_from_result(result: dict[str, Any]) -> int:
    written = result.get('points_written')
    if isinstance(written, dict):
        return int(sum(float(v or 0) for v in written.values()))
    if isinstance(written, (int, float)):
        return int(written)
    return int(result.get('points') or 0)


@app.get('/api/activity-summary')
def activity_summary(hours:int=Query(24,ge=1,le=168)):
    since_ms = int(time.time()*1000) - int(hours)*3_600_000
    rows = lab.recent_job_activity(since_ms, 5000)
    status_counts = {key: 0 for key in ('queued','running','done','failed','cancelled')}
    kind_counts: dict[str, int] = {}
    candles = metric_points = replay_runs = strategy_runs = 0
    recent_errors = []
    for row in rows:
        status = str(row.get('status') or '')
        status_counts[status] = status_counts.get(status, 0) + 1
        kind = str(row.get('kind') or '')
        kind_counts[kind] = kind_counts.get(kind, 0) + 1
        result = row.get('result') or {}
        if status == 'done' and kind == 'historical_backfill':
            candles += int(result.get('rows') or 0)
            nested = result.get('derivative_metrics') or {}
            if isinstance(nested, dict):
                metric_points += _metric_points_from_result(nested)
        elif status == 'done' and kind == 'derivative_metric_backfill':
            metric_points += _metric_points_from_result(result)
        elif status == 'done' and kind == 'historical_replay':
            replay_runs += 1
        elif status == 'done' and kind == 'strategy_run':
            strategy_runs += 1
        if status == 'failed':
            recent_errors.append({
                'id': row.get('id'), 'title_ru': row.get('title_ru'),
                'error': str(row.get('error') or '').splitlines()[0][:500],
                'finished_at_ms': row.get('finished_at_ms') or row.get('updated_at_ms'),
            })
    current = [row for row in rows if row.get('status') in {'queued','running'}][:30]
    recent_done = [row for row in rows if row.get('status') == 'done'][:20]
    return {
        'window_hours': hours, 'since_ms': since_ms, 'generated_at_ms': int(time.time()*1000),
        'jobs_touched': len(rows), 'status': status_counts, 'kinds': kind_counts,
        'candles_added': candles, 'metric_points_added': metric_points,
        'replay_runs_done': replay_runs, 'strategy_runs_done': strategy_runs,
        'unfinished': status_counts.get('queued',0) + status_counts.get('running',0),
        'failed': status_counts.get('failed',0),
        'current': current, 'recent_done': recent_done, 'recent_errors': recent_errors[:10],
    }


@app.get('/api/strategies')
def strategies(): return [x.model_dump(mode='json') for x in lab.list_strategies()]


@app.post('/api/strategies')
def save_strategy(spec:StrategySpec): return lab.save_strategy(spec).model_dump(mode='json')


@app.get('/api/strategies/runs')
def strategy_runs(strategy_id:str='',limit:int=Query(200,ge=1,le=2000)):
    return [x.model_dump(mode='json') for x in lab.list_strategy_runs(strategy_id,limit)]


@app.post('/api/strategies/{strategy_id}/run')
def run_strategy(strategy_id:str,request:StrategyRunCreate):
    spec=lab.get_strategy(strategy_id)
    if spec is None: raise HTTPException(404,'strategy not found')
    job=lab.enqueue_job('strategy_run',f"Стратегия: {spec.name_ru} / {request.canonical_id}",{'strategy_id':strategy_id,'canonical_id':request.canonical_id})
    return job.model_dump(mode='json')


@app.get('/api/data-lake')
async def data_lake_status():
    return await asyncio.to_thread(lake.verify)


@app.post('/api/data-lake/verify')
def verify_data_lake(): return lab.enqueue_job('verify_lake','Проверка Data Lake',{}).model_dump(mode='json')


@app.get('/api/briefing')
async def briefing():
    snapshot = _snapshot()
    return await asyncio.to_thread(briefing_builder.build, snapshot)


@app.post('/api/export/snapshot')
async def export_snapshot(request:SnapshotExportRequest):
    snapshot = _snapshot()
    runtime = service.runtime_status()
    research = research_runtime.status()
    def build_export():
        rels = mine_relationships(store.price_series(), min_samples=20)[:200]
        return exporter.export(runtime=runtime, research_runtime=research, snapshot=snapshot, relationships=rels, full=request.full)
    return await asyncio.to_thread(build_export)


def main()->None:
    uvicorn.run('tqs_intelligence.api:app',host=os.getenv('TQS_HOST','127.0.0.1'),port=int(os.getenv('TQS_PORT','8787')),reload=False)


if __name__=='__main__': main()
