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
    round_events: int = 0
    control_events: int = 0
    metrics: dict[str, Any] = Field(default_factory=dict)
    splits: dict[str, Any] = Field(default_factory=dict)
    robustness: dict[str, Any] = Field(default_factory=dict)
    diagnostics: dict[str, Any] = Field(default_factory=dict)
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


class ResearchProject(BaseModel):
    id: str
    title: str
    version: int = 1
    hypothesis: str
    origin: str = 'artem'
    status: Literal['idea','exploratory','validation','oos','confirmed','rejected','insufficient_data'] = 'exploratory'
    market: str = 'multi'
    instruments: list[str] = Field(default_factory=list)
    data_requirements: list[str] = Field(default_factory=list)
    event: dict[str, Any] = Field(default_factory=dict)
    controls: list[str] = Field(default_factory=list)
    regimes: list[str] = Field(default_factory=list)
    horizons: list[str] = Field(default_factory=lambda: ['5m','1h','1d'])
    metrics: list[str] = Field(default_factory=lambda: ['forward_return','mfe','mae','hit_rate'])
    validation: dict[str, Any] = Field(default_factory=lambda: {
        'multiple_testing': True,
        'oos_required': True,
        'walk_forward': True,
        'min_events': 40,
        'status_note': 'exploratory until independent OOS/replication',
    })
    linked_job_ids: list[str] = Field(default_factory=list)
    linked_strategy_ids: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    created_at_ms: int
    updated_at_ms: int


class ResearchRunResult(BaseModel):
    run_id: str
    research_id: str
    canonical_id: str
    family: str
    interval: str
    generated_at_ms: int
    status: str
    sample_count: int = 0
    control_count: int = 0
    coverage: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    splits: dict[str, Any] = Field(default_factory=dict)
    regimes: dict[str, Any] = Field(default_factory=dict)
    conclusion: str = ""
    next_action: str = ""
    strategy_id: str | None = None
    warnings: list[str] = Field(default_factory=list)
