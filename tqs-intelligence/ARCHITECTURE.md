# TQS Intelligence architecture v0.1

```text
Public/Premium Sources
  Bitget | Binance | Bybit | OKX | MOEX | Twelve Data | GDELT | RSS
                         |
                         v
                  Source adapters
                         |
                         v
                 Canonical Quote/Event
                         |
              +----------+----------+
              |                     |
              v                     v
         DuckDB snapshots      Intelligence Engine
         (later Parquet/CH)     state + anomaly
              |                     |
              +----------+----------+
                         v
                    FastAPI API
                         |
          +--------------+-------------+
          v              v             v
      Russian UI      Research      Briefing/API
                      Queue
```

## Non-negotiable boundaries

- Raw high-frequency stream is not an LLM input.
- Every provider retains provenance and canonical ID.
- External source failure is isolated and observable.
- Research discoveries become hypotheses, never automatic trading rules.
- A statistical relation is not promoted until OOS/walk-forward/stability/cost checks pass.
- Local Windows execution remains a first-class deployment target.

## Storage evolution

v0.1 uses DuckDB for zero-admin local startup. Historical bulk data should move to partitioned Parquet; ClickHouse is the scale-up path for hot analytical queries. Supabase/Postgres remains a future control-plane/knowledge store, not the intended warehouse for every market tick.
