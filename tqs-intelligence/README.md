# TQS Intelligence Engine v0.1

Локальное ядро TraderQuest для непрерывного сбора рынков, унификации инструментов, поиска аномалий, новостей и очереди исследовательских гипотез. Проект специально устроен так, чтобы основной поток работал обычным кодом без постоянных расходов на LLM.

## Уже работает

- Bitget UTA v3: spot + USDT futures, без API-ключа.
- Binance: spot + USDT-M futures, без API-ключа.
- Bybit V5: spot + linear futures, без API-ключа.
- OKX V5: spot + swaps + expiry futures, без API-ключа.
- MOEX ISS: акции + FORTS, без API-ключа.
- Twelve Data: опциональный адаптер для глобальных акций/ETF при наличии ключа.
- GDELT + произвольные RSS/Atom: новостной поток и первичная привязка к инструментам/темам.
- Унифицированная Quote schema и canonical_id `provider:market:symbol`.
- Cross-sectional anomaly engine: движение, оборот, OI, funding, spread.
- Relationship Miner: корреляции и one-bucket lead/lag по накопленным snapshots с минимальным sample gate.
- Русский браузерный терминал: Сейчас / Аномалии / Новости / Исследования / Источники.
- DuckDB: накопление snapshots, anomalies, news и идей.
- Отказ одного внешнего источника не останавливает остальные: health каждого источника виден отдельно.

## Windows — самый простой запуск

Можно двойным кликом запустить `install-windows.cmd`, затем `start-windows.cmd`.

Либо PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-windows.ps1
.\start-windows.ps1
```

Откроется `http://127.0.0.1:8787`.

Альтернатива через Docker Desktop:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

## Почему это только v0.1

Это уже runnable vertical slice, но не обещание, что все рынки мира и исторические исследования реализованы одним коммитом. Следующие слои должны добавляться без смены ядра:

1. Исторические candles/trades и Parquet lake; DuckDB/Polars research views.
2. Persistent WebSocket для Tier-A crypto, sequence integrity и gap recovery.
3. Historical baselines: robust z-score/percentiles по самому инструменту, режимам и времени суток.
4. Relationship Miner: lead/lag, conditional relationships, correlation breaks, sequence mining.
5. Research Engine: event study, OOS, walk-forward, bootstrap, multiple-testing control, fee/slippage stress.
6. Event/news intelligence: exchange announcements, macro calendar, token unlocks, listings/delistings, filings.
7. Optional LLM router только на shortlisted anomalies/research summaries; raw ticks никогда не отправляются в LLM.
8. Единый BriefingSnapshot, из которого питаются веб, эфир, Telegram, курс и презентации.

## API

- `GET /api/health`
- `POST /api/refresh`
- `GET /api/overview`
- `GET /api/anomalies?min_score=50&asset_class=crypto`
- `GET /api/quotes?q=BTC`
- `GET /api/news?symbol=BTC`
- `GET /api/relationships?min_samples=20`
- `POST /api/hypotheses`
- `GET /api/hypotheses`
- OpenAPI: `/docs`

## Cost architecture

Zero-key adapters first. Premium providers are optional. AI is intentionally not in the hot path. The engine computes and filters locally, and future AI calls receive compact MarketSnapshot/Anomaly packets instead of raw streams.

## Data caveats

Market providers have different definitions for volume, turnover, session windows, futures units and timestamps. The normalized schema preserves provider/market metadata and does not pretend these fields are perfectly interchangeable. Provider-specific contracts must remain tested as adapters grow.
