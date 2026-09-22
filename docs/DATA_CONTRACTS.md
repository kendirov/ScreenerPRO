# Data contracts

**Дата:** 2026-08-13

## Instrument Master

`instrument_id`, `symbol`, `isin`, `venue`, `asset_class`, `currency`, `tick_size`, `lot_size`, `trading_status`, `session`, `base_key`, `source`, `resolved_at`, `quality`, `limitations`.

## Source Registry

`provider`, `capability`, `endpoint/adapter`, `auth_class`, `license`, `rate_limit`, `latency_sla`, `freshness_sla`, `fallback_policy`, `quality_status`, `owner`, `last_verified`.

## Snapshot

`instrument_id, event_time, received_at, source, source_version, last_price, turnover, num_trades, bid, ask, volume, open_interest, quality, missing_fields`

`event_time` — время рынка; `received_at` — время приёма. Никогда не подменять одно другим.

## Baseline

`instrument_id, bucket_10m, sessions_available, sessions_required, same_time, coverage_pct, last_sample_at, quality`.

Боевой статус: `coverage_pct >= 80%`, минимум 20 сессий, текущий bucket без пропуска; иначе `partial/missing`.

## NUMTRADES

Хранить cumulative `NUMTRADES` snapshot каждые 10 минут; delta между соседними snapshots не смешивать с cumulative count. Reset и late-arrival фиксировать quality flags.

## Provider policy

Live, delayed, snapshot, fixture и fallback — разные статусы. Fixture/mock запрещено смешивать с live без явной маркировки.
