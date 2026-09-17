from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class StrategySpec(BaseModel):
    id: str
    name_ru: str
    version: int = 1
    status: Literal['draft','exploratory','candidate','validated','rejected'] = 'exploratory'
    origin: str = 'artem'
    idea: str
    universe: list[str] = Field(default_factory=list)
    interval: str = '5m'
    event: dict[str, Any] = Field(default_factory=dict)
    entry: dict[str, Any] = Field(default_factory=dict)
    exit: dict[str, Any] = Field(default_factory=dict)
    filters: dict[str, Any] = Field(default_factory=dict)
    costs: dict[str, float] = Field(default_factory=lambda: {'round_trip_bps': 8.0})
    validation: dict[str, Any] = Field(default_factory=lambda: {
        'exploration_fraction': 0.60,
        'validation_fraction': 0.20,
        'holdout_fraction': 0.20,
        'walk_forward_folds': 4,
        'min_events': 40,
    })
    notes: list[str] = Field(default_factory=list)


class StrategyRunResult(BaseModel):
    run_id: str
    strategy_id: str
    canonical_id: str
    interval: str
    generated_at_ms: int
    status: str
    events: int
    round_events: int
    control_events: int
    metrics: dict[str, Any]
    splits: dict[str, Any]
    robustness: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)


class ResearchJob(BaseModel):
    id: str
    kind: str
    created_at_ms: int
    status: str = 'queued'
    progress: float = 0.0
    title_ru: str
    payload: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
