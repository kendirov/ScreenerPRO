# ADR-003 — Canonical market contracts

**Status:** accepted and implemented in TQ-003 (2026-09-09)

- Canonical market core is provider-neutral; Bitget names stay at the adapter boundary.
- The domain layer uses Python standard library, immutable dataclasses, and `Decimal` for financial values.
- Percentage-like values are ratios. Timestamps are UTC Unix epoch milliseconds.
- `event_time_ms` is provider event time; `observed_at_ms` is local observation time. Missing data is `None`.
- `EventEnvelope` owns provenance, sequence/pseq boundary, quality and freshness.
- Adapters normalize provider truth only; no scoring, signals, features or AI explanations.
- Raw provider events are not canonical events. Execution is a separate domain.
- Frontend migration, persistent streaming and storage are deferred.
