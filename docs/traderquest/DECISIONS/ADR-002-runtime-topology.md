# ADR-002: Runtime topology and evidence boundaries

- Status: accepted
- Date: 2026-09-09

## Decision

Use a modular monorepo with future logical runtimes `tq-api`, `tq-market`, `tq-research`, and `tq-execution`. Keep the existing frontend as the workspace shell. Split runtime deployment only when uptime, failure or security characteristics justify it.

Approved storage boundaries: Supabase/Postgres for operational truth; ClickHouse provisional for hot analytical data pending benchmark; Parquet plus S3-compatible object storage for raw/history/replay; DuckDB/Polars for research. Kafka/Redpanda/NATS and Kubernetes are not MVP.

Bitget UTA v3 is the first adapter. Risk is deterministic and independent from AI; LLM is outside the millisecond execution loop and never receives raw tick/order-book streams.

## Consequences

- Provider data must retain source, observed time/freshness and quality.
- Missing data remains NULL/`—`; no fake baseline, score or evidence.
- EventContext and Alert Engine are first-class future domains but are not implemented here.
- No migrations, storage installation, secrets, infrastructure or execution endpoints are part of TQ-001.
