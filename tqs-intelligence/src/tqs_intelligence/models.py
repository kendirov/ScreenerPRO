from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, computed_field


class AssetClass(StrEnum):
    CRYPTO = "crypto"
    STOCK = "stock"
    FUTURE = "future"
    OPTION = "option"
    FX = "fx"
    INDEX = "index"
    COMMODITY = "commodity"
    ETF = "etf"
    OTHER = "other"


class SourceStatus(StrEnum):
    OK = "ok"
    DEGRADED = "degraded"
    ERROR = "error"
    DISABLED = "disabled"


class Quote(BaseModel):
    provider: str
    venue: str
    symbol: str
    display_symbol: str | None = None
    asset_class: AssetClass
    market_type: str
    currency: str | None = None
    last: float | None = None
    bid: float | None = None
    ask: float | None = None
    open_24h: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    volume_24h: float | None = None
    turnover_24h: float | None = None
    change_24h_pct: float | None = None
    open_interest: float | None = None
    funding_rate: float | None = None
    ts_ms: int
    observed_at_ms: int
    meta: dict[str, Any] = Field(default_factory=dict)

    @computed_field
    @property
    def canonical_id(self) -> str:
        return f"{self.provider}:{self.market_type}:{self.symbol}"

    @computed_field
    @property
    def spread_bps(self) -> float | None:
        if not self.bid or not self.ask or self.bid <= 0 or self.ask <= 0:
            return None
        mid = (self.bid + self.ask) / 2
        return (self.ask - self.bid) / mid * 10_000 if mid else None


class SourceHealth(BaseModel):
    name: str
    status: SourceStatus
    instruments: int = 0
    latency_ms: int | None = None
    last_success_ms: int | None = None
    error: str | None = None


class MarketState(BaseModel):
    canonical_id: str
    regime: str
    direction: str
    activity: str
    liquidity: str
    score: float
    reasons: list[str]


class Anomaly(BaseModel):
    canonical_id: str
    provider: str
    symbol: str
    asset_class: AssetClass
    market_type: str
    score: float = Field(ge=0, le=100)
    severity: str
    reasons: list[str]
    state: MarketState
    quote: Quote


class NewsItem(BaseModel):
    source: str
    title: str
    url: str
    published_at_ms: int | None = None
    language: str | None = None
    symbols: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    summary: str | None = None


class HypothesisCreate(BaseModel):
    title: str
    idea: str
    universe: str = "all"
    horizon: str = "4h"
    tags: list[str] = Field(default_factory=list)


class Hypothesis(BaseModel):
    id: str
    created_at_ms: int
    title: str
    idea: str
    universe: str
    horizon: str
    tags: list[str]
    status: str = "queued"


class Snapshot(BaseModel):
    generated_at_ms: int
    quotes: list[Quote]
    anomalies: list[Anomaly]
    source_health: list[SourceHealth]
    news: list[NewsItem]


class Relationship(BaseModel):
    left_id: str
    right_id: str
    relation: str
    coefficient: float
    samples: int
    lag_buckets: int = 0
    confidence: str
