from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic_settings import BaseSettings, SettingsConfigDict

from .http import JsonHttp
from .models import AssetClass, HypothesisCreate
from .news import NewsCollector
from .relationships import mine_relationships
from .service import IntelligenceService
from .sources import BinanceSource, BitgetSource, BybitSource, MoexSource, OkxSource, TwelveDataSource
from .storage import DuckStore


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TQS_", extra="ignore")
    db_path: str = "./data/tqs-intelligence.duckdb"
    refresh_seconds: int = 60
    enable_binance: bool = True
    enable_bitget: bool = True
    enable_bybit: bool = True
    enable_okx: bool = True
    enable_moex: bool = True
    twelve_data_api_key: str = ""
    twelve_data_symbols: str = "AAPL,MSFT,NVDA,SPY,QQQ"
    rss_urls: str = ""
    episode_threshold: float = 70.0
    episode_close_grace_seconds: int = 180
    history_backfill_max: int = 8
    history_refresh_every: int = 5
    research_every_refreshes: int = 15


settings = Settings(); http = JsonHttp(); sources = []
if settings.enable_bitget: sources.append(BitgetSource(http))
if settings.enable_binance: sources.append(BinanceSource(http))
if settings.enable_bybit: sources.append(BybitSource(http))
if settings.enable_okx: sources.append(OkxSource(http))
if settings.enable_moex: sources.append(MoexSource(http))
twelve = TwelveDataSource(http, settings.twelve_data_api_key, [x.strip() for x in settings.twelve_data_symbols.split(",") if x.strip()])
if settings.twelve_data_api_key: sources.append(twelve)
news = NewsCollector(http, [x.strip() for x in settings.rss_urls.split(",") if x.strip()])
store = DuckStore(settings.db_path)
service = IntelligenceService(
    sources, news, store, settings.refresh_seconds, settings.episode_threshold,
    settings.episode_close_grace_seconds, settings.history_backfill_max,
    settings.history_refresh_every, settings.research_every_refreshes,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.start(); yield; await service.stop(); await http.aclose()


app = FastAPI(title="TQS Intelligence Engine", version="0.3.0", lifespan=lifespan)
STATIC = Path(__file__).with_name("static")


def _snapshot(): return service.state.snapshot


def _capabilities() -> list[dict[str, object]]:
    enabled = {s.provider: s for s in sources}; rows = [s.capability(True) for s in sources]
    if "twelvedata" not in enabled: rows.append(twelve.capability(False))
    rows.append({"provider":"news","name":"Новости: GDELT + RSS","enabled":True,"markets":["Крипто","Мосбиржа","рубль","нефть","макро"],"asset_classes":[],"data_fields":["заголовки","ссылки","время","тикеры","темы"],"access":"GDELT без ключа; RSS настраивается в .env","description":"Новостной контекст хранится отдельно от рыночных фактов и связывается с тикерами/темами."})
    rows.append({"provider":"episodes","name":"Anomaly Episode Engine","enabled":True,"markets":["Все подключённые рынки"],"asset_classes":[],"data_fields":["жизненный цикл аномалии","график до/после","MFE/MAE","5м/15м/1ч/4ч/24ч","похожие случаи"],"access":"Локальный вычислительный слой","description":"Превращает повторяющиеся строки аномалий в отдельные сохраняемые рыночные события."})
    rows.append({"provider":"research","name":"Autonomous Research Loop","enabled":True,"markets":["Все накопленные эпизоды"],"asset_classes":[],"data_fields":["группировка паттернов","медиана продолжения","win-rate","кандидаты для проверки"],"access":"Локальный DuckDB / CPU","description":"Периодически пересчитывает статистику по закрытым эпизодам без LLM."})
    return rows


@app.get("/", include_in_schema=False)
async def dashboard(): return FileResponse(STATIC / "index.html")


@app.get("/api/health")
async def health():
    snapshot=_snapshot()
    return {"ok":True,"initializing":snapshot is None,"runtime":service.runtime_status(),"generated_at_ms":snapshot.generated_at_ms if snapshot else None,"sources":[x.model_dump(mode="json") for x in service.current_health()],"storage":store.stats()}


@app.post("/api/refresh")
async def refresh():
    accepted=service.request_refresh(); return {"ok":True,"accepted":accepted,"message":"Сбор запущен" if accepted else "Сбор уже выполняется"}


@app.get("/api/overview")
async def overview():
    snapshot=_snapshot(); classes={}
    if snapshot:
        for quote in snapshot.quotes: classes[quote.asset_class.value]=classes.get(quote.asset_class.value,0)+1
    stats=store.stats()
    return {"initializing":snapshot is None,"generated_at_ms":snapshot.generated_at_ms if snapshot else None,"quote_count":len(snapshot.quotes) if snapshot else 0,"anomaly_count":len(snapshot.anomalies) if snapshot else 0,"active_episode_count":stats.get("active_episodes",0),"episode_count":stats.get("anomaly_episodes",0),"news_count":len(snapshot.news) if snapshot else 0,"asset_classes":classes,"sources":[x.model_dump(mode="json") for x in service.current_health()],"runtime":service.runtime_status(),"storage":stats,"top_anomalies":[x.model_dump(mode="json") for x in snapshot.anomalies[:30]] if snapshot else []}


@app.get("/api/system")
async def system():
    return {"version":app.version,"runtime":service.runtime_status(),"storage":store.stats(),"config":{"refresh_seconds":settings.refresh_seconds,"db_path":settings.db_path,"rss_feeds":len(news.rss_urls),"twelve_data_enabled":bool(settings.twelve_data_api_key),"episode_threshold":settings.episode_threshold,"history_refresh_every":settings.history_refresh_every,"research_every_refreshes":settings.research_every_refreshes},"pipeline":["collect","normalize","persist","anomaly","episode lifecycle","history backfill","outcome tracking","relationship mining","autonomous research","briefing-ready API"]}


@app.get("/api/capabilities")
async def capabilities(): return _capabilities()


@app.get("/api/anomalies")
async def anomalies(limit:int=Query(100,ge=1,le=1000),asset_class:AssetClass|None=None,provider:str|None=None,min_score:float=Query(50,ge=0,le=100)):
    snapshot=_snapshot(); rows=snapshot.anomalies if snapshot else []
    if asset_class: rows=[x for x in rows if x.asset_class==asset_class]
    if provider: rows=[x for x in rows if x.provider==provider]
    return [x.model_dump(mode="json") for x in rows if x.score>=min_score][:limit]


@app.get("/api/quotes")
async def quotes(q:str="",provider:str="",market_type:str="",asset_class:AssetClass|None=None,limit:int=Query(500,ge=1,le=10000)):
    snapshot=_snapshot(); rows=snapshot.quotes if snapshot else []; needle=q.lower().strip()
    if provider: rows=[x for x in rows if x.provider==provider]
    if market_type: rows=[x for x in rows if x.market_type==market_type]
    if asset_class: rows=[x for x in rows if x.asset_class==asset_class]
    if needle: rows=[x for x in rows if needle in x.symbol.lower() or needle in (x.display_symbol or "").lower() or needle in x.venue.lower()]
    rows=sorted(rows,key=lambda x:(x.turnover_24h or 0,abs(x.change_24h_pct or 0)),reverse=True)
    return [x.model_dump(mode="json") for x in rows[:limit]]


@app.get("/api/moex")
async def moex():
    snapshot=_snapshot(); rows=[x for x in (snapshot.quotes if snapshot else []) if x.provider=="moex"]; segments={}
    for quote in rows: segments[quote.asset_class.value]=segments.get(quote.asset_class.value,0)+1
    source_health=next((x for x in service.current_health() if x.provider=="moex"),None)
    return {"initializing":snapshot is None,"count":len(rows),"segments":segments,"health":source_health.model_dump(mode="json") if source_health else None,"top":[x.model_dump(mode="json") for x in sorted(rows,key=lambda q:q.turnover_24h or 0,reverse=True)[:30]]}


@app.get("/api/episodes")
async def episodes(limit:int=Query(200,ge=1,le=2000),status:str="",provider:str="",q:str=""):
    return [x.model_dump(mode="json") for x in store.list_episodes(limit,status,provider,q)]


@app.get("/api/episodes/{episode_id}")
async def episode_detail(episode_id:str,before_hours:int=Query(24,ge=1,le=168),after_hours:int=Query(24,ge=1,le=168)):
    episode=store.get_episode(episode_id)
    if episode is None: raise HTTPException(status_code=404,detail="episode not found")
    outcome=store.episode_outcome(episode_id); series=store.episode_series(episode_id,before_hours*3600_000,after_hours*3600_000)
    similar=[]
    for item in store.similar_episodes(episode,20):
        try: out=store.episode_outcome(item.id).model_dump(mode="json")
        except Exception: out=None
        similar.append({"episode":item.model_dump(mode="json"),"outcome":out})
    return {"episode":episode.model_dump(mode="json"),"outcome":outcome.model_dump(mode="json"),"series":series,"similar":similar}


@app.get("/api/research/findings")
async def research_findings(limit:int=Query(100,ge=1,le=1000)):
    return [x.model_dump(mode="json") for x in store.list_findings(limit)]


@app.get("/api/news")
async def news_items(limit:int=Query(100,ge=1,le=500),symbol:str=""):
    snapshot=_snapshot(); rows=snapshot.news if snapshot else []
    if symbol: rows=[x for x in rows if symbol.upper() in {s.upper() for s in x.symbols}]
    return [x.model_dump(mode="json") for x in rows[:limit]]


@app.get("/api/relationships")
async def relationships(limit:int=Query(50,ge=1,le=500),min_samples:int=Query(20,ge=5,le=1000)):
    return [x.model_dump(mode="json") for x in mine_relationships(store.price_series(),min_samples=min_samples)[:limit]]


@app.get("/api/logs")
async def logs(limit:int=Query(200,ge=1,le=2000),level:str="",component:str=""):
    return [x.model_dump(mode="json") for x in store.list_logs(limit,level,component)]


@app.post("/api/hypotheses")
async def create_hypothesis(request:HypothesisCreate): return store.create_hypothesis(request,int(time.time()*1000)).model_dump(mode="json")


@app.get("/api/hypotheses")
async def list_hypotheses(limit:int=Query(100,ge=1,le=500)): return [x.model_dump(mode="json") for x in store.list_hypotheses(limit)]


def main()->None:
    uvicorn.run("tqs_intelligence.api:app",host=os.getenv("TQS_HOST","127.0.0.1"),port=int(os.getenv("TQS_PORT","8787")),reload=False)


if __name__=="__main__": main()
