from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Query
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


settings = Settings(); http = JsonHttp(); sources = []
if settings.enable_bitget: sources.append(BitgetSource(http))
if settings.enable_binance: sources.append(BinanceSource(http))
if settings.enable_bybit: sources.append(BybitSource(http))
if settings.enable_okx: sources.append(OkxSource(http))
if settings.enable_moex: sources.append(MoexSource(http))
if settings.twelve_data_api_key:
    sources.append(TwelveDataSource(http, settings.twelve_data_api_key, [x.strip() for x in settings.twelve_data_symbols.split(",") if x.strip()]))
news = NewsCollector(http, [x.strip() for x in settings.rss_urls.split(",") if x.strip()])
store = DuckStore(settings.db_path); service = IntelligenceService(sources, news, store, settings.refresh_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.start(); yield; await service.stop(); await http.aclose()


app = FastAPI(title="TQS Intelligence Engine", version="0.1.0", lifespan=lifespan)
STATIC = Path(__file__).with_name("static")


@app.get("/", include_in_schema=False)
async def dashboard(): return FileResponse(STATIC / "index.html")


@app.get("/api/health")
async def health():
    snapshot = service.state.snapshot
    return {"ok": True, "running": service.state.running, "generated_at_ms": snapshot.generated_at_ms if snapshot else None,
            "sources": [x.model_dump() for x in snapshot.source_health] if snapshot else [], "storage": store.stats()}


@app.post("/api/refresh")
async def refresh():
    snapshot = await service.refresh(); return {"ok": True, "quotes": len(snapshot.quotes), "anomalies": len(snapshot.anomalies), "news": len(snapshot.news)}


@app.get("/api/overview")
async def overview():
    snapshot = service.state.snapshot or await service.refresh(); classes: dict[str, int] = {}
    for quote in snapshot.quotes: classes[quote.asset_class.value] = classes.get(quote.asset_class.value, 0) + 1
    return {"generated_at_ms": snapshot.generated_at_ms, "quote_count": len(snapshot.quotes), "anomaly_count": len(snapshot.anomalies),
            "news_count": len(snapshot.news), "asset_classes": classes, "sources": [x.model_dump() for x in snapshot.source_health],
            "top_anomalies": [x.model_dump(mode="json") for x in snapshot.anomalies[:20]]}


@app.get("/api/anomalies")
async def anomalies(limit: int = Query(100, ge=1, le=1000), asset_class: AssetClass | None = None,
                    provider: str | None = None, min_score: float = Query(50, ge=0, le=100)):
    snapshot = service.state.snapshot or await service.refresh(); rows = snapshot.anomalies
    if asset_class: rows = [x for x in rows if x.asset_class == asset_class]
    if provider: rows = [x for x in rows if x.provider == provider]
    return [x.model_dump(mode="json") for x in rows if x.score >= min_score][:limit]


@app.get("/api/quotes")
async def quotes(q: str = "", limit: int = Query(200, ge=1, le=5000)):
    snapshot = service.state.snapshot or await service.refresh(); needle = q.lower().strip(); rows = snapshot.quotes
    if needle: rows = [x for x in rows if needle in x.symbol.lower() or needle in x.provider.lower() or needle in x.venue.lower()]
    return [x.model_dump(mode="json") for x in rows[:limit]]


@app.get("/api/news")
async def news_items(limit: int = Query(100, ge=1, le=200), symbol: str = ""):
    snapshot = service.state.snapshot or await service.refresh(); rows = snapshot.news
    if symbol: rows = [x for x in rows if symbol.upper() in {s.upper() for s in x.symbols}]
    return [x.model_dump(mode="json") for x in rows[:limit]]


@app.get("/api/relationships")
async def relationships(limit: int = Query(50, ge=1, le=500), min_samples: int = Query(20, ge=5, le=1000)):
    return [x.model_dump(mode="json") for x in mine_relationships(store.price_series(), min_samples=min_samples)[:limit]]


@app.post("/api/hypotheses")
async def create_hypothesis(request: HypothesisCreate): return store.create_hypothesis(request, int(time.time() * 1000)).model_dump(mode="json")


@app.get("/api/hypotheses")
async def list_hypotheses(limit: int = Query(100, ge=1, le=500)): return [x.model_dump(mode="json") for x in store.list_hypotheses(limit)]


def main() -> None:
    uvicorn.run("tqs_intelligence.api:app", host=os.getenv("TQS_HOST", "127.0.0.1"), port=int(os.getenv("TQS_PORT", "8787")), reload=False)


if __name__ == "__main__": main()
