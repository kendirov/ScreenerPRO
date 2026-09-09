# TraderQuest Crypto architecture

Статус: approved foundation; TQ-004 реализует public REST snapshot boundary. Это topology и boundaries, не persistent collector specification.

Implemented TQ-003/TQ-004 paths: `traderquest/market`, `traderquest/adapters/bitget`, `traderquest/runtime/snapshot.py`.
Canonical contracts, pure Bitget normalizer, public REST adapter и one-shot snapshot runtime реализованы.
Не реализованы: persistent collector, WebSocket, storage, 24x7 service, execution, MCP и AI.

```text
Trading Workspace / Next.js
            |
       TraderQuest API
   /       |        |        \
market  research  execution   MCP (later)
   |
ExchangeAdapter → Bitget UTA v3 (first adapter)
```

Целевые runtime boundaries: `tq-api`, `tq-market`, `tq-research`, `tq-execution`. Разделение runtime выполняется только при доказанной разнице uptime/failure/security characteristics.

Storage boundaries:

- Postgres/Supabase — operational transactional truth.
- ClickHouse — provisional hot analytical market store; окончательный выбор только после ingestion/storage benchmark.
- Parquet + S3-compatible object storage — raw, historical и replay archive.
- DuckDB/Polars — research поверх archive.
- Kafka/Redpanda/NATS и Kubernetes — не MVP.

## Boundaries

- `ExchangeAdapter` — provider-specific market/account boundary; не смешивать Bitget execution truth с reference data.
- `EventEnvelope` — нормализованное событие с source, observed_at, event_time, freshness и quality.
- `Feature Registry` — именованные verified features с источником, периодом и ограничениями.
- `Radar` — deterministic selection over verified features; не прогноз.
- `MarketSnapshot` — point-in-time market state с provenance.
- `EventContext` — future first-class context: announcements, listings/delistings, margin/collateral, official exchange events, macro/news, authoritative source, observed_at, event_time, confidence/provenance. Event не является причиной движения без evidence.
- `AlertSpec` / Alert Engine — future deterministic alerts over verified features/radars: unusual volume, OI acceleration, breakout, funding extreme, liquidity deterioration, In Play, strategy setup.
- `MarketCase` — first-class case tying instrument, evidence, context, risk and decision state.
- `StrategySpec` — primary strategy representation, shared by backtest/paper/Bitget Demo/live.
- `Backtest` — consumes the same semantics; not part of TQ-001.
- `Execution` — isolated from AI; no order operations in TQ-001.
- `Risk` — deterministic and independent from AI.
- `BriefingBlueprint` — one representation for web/PPTX/PDF/lesson/video later.
- `MCP` — later interface, not implemented.

## Non-negotiable data rules

Missing data is NULL/`—`; no fake baseline, score or market evidence. Raw tick/order-book stream never goes directly to LLM. LLM explains already verified evidence and never sits in a millisecond execution loop. Production collector/execution must not depend on a home Windows/Mac machine.

Existing Next.js/React shell is retained. TQ-001 does not install ClickHouse, create migrations, add dependencies, change env, or add runtime code.
